"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// --- Web Speech API 최소 타입 (표준 DOM lib에 없음) ---
interface SRAlternative { transcript: string }
interface SRResult { isFinal: boolean; 0: SRAlternative }
interface SRResultList { length: number; [index: number]: SRResult }
interface SREvent { resultIndex: number; results: SRResultList }
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type SRConstructor = new () => SpeechRecognitionLike;

type Result = { ok: boolean; url?: string; title?: string; error?: string; note?: string | null };

type NotionSettings = {
  token: string;
  mode: "page" | "db";
  pageId: string;
  dbId: string;
  titleProp: string;
};

const SETTINGS_KEY = "meeting_notion_settings";
const emptySettings: NotionSettings = { token: "", mode: "page", pageId: "", dbId: "", titleProp: "이름" };

export default function MeetingPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [transcript, setTranscript] = useState("");
  const [recording, setRecording] = useState(false);
  const [status, setStatus] = useState("대기 중");
  const [saving, setSaving] = useState(false);
  const [doSummary, setDoSummary] = useState(true);
  const [result, setResult] = useState<Result | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);

  // Notion 설정 (본인 브라우저에 저장)
  const [settings, setSettings] = useState<NotionSettings>(emptySettings);
  const [showSettings, setShowSettings] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const finalRef = useRef("");
  const recordingRef = useRef(false);

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: SRConstructor; webkitSpeechRecognition?: SRConstructor };
    setSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) setSettings({ ...emptySettings, ...JSON.parse(raw) });
      else setShowSettings(true); // 최초 사용자는 설정 패널을 펼쳐서 안내
    } catch {
      /* 무시 */
    }
  }, []);

  const configured = Boolean(settings.token && (settings.mode === "page" ? settings.pageId : settings.dbId));

  function saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      setSavedMsg("저장됨 ✓ (이 브라우저에만 보관)");
      setTimeout(() => setSavedMsg(""), 2500);
    } catch {
      setSavedMsg("저장 실패 — 브라우저 설정을 확인하세요");
    }
  }

  function startRecognition() {
    const w = window as unknown as { SpeechRecognition?: SRConstructor; webkitSpeechRecognition?: SRConstructor };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) return;

    const rec = new SR();
    rec.lang = "ko-KR";
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e: SREvent) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const txt = r[0].transcript;
        if (r.isFinal) finalRef.current += txt + " ";
        else interim += txt;
      }
      setTranscript(finalRef.current + interim);
    };
    rec.onerror = (e: { error: string }) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      setStatus(`인식 오류: ${e.error}`);
    };
    rec.onend = () => {
      if (recordingRef.current) {
        try { rec.start(); } catch { /* 무시 */ }
      }
    };

    recognitionRef.current = rec;
    try { rec.start(); } catch { /* 무시 */ }
  }

  async function startRecording() {
    setResult(null);
    finalRef.current = transcript ? transcript.replace(/\s+$/, "") + " " : "";
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      recorderRef.current = mr;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setResult({ ok: false, error: `마이크 접근 실패: ${msg}` });
      return;
    }
    startRecognition();
    recordingRef.current = true;
    setRecording(true);
    setStatus("녹음 중...");
  }

  function stopRecording() {
    recordingRef.current = false;
    setRecording(false);
    recognitionRef.current?.stop();
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
    finalRef.current = transcript.replace(/\s+$/, "") + " ";
    setStatus("녹음 종료 — 저장 가능");
  }

  async function save() {
    const text = transcript.trim();
    if (!text) return;
    setSaving(true);
    setResult(null);
    setStatus(doSummary ? "Claude 요약 + Notion 업로드 중..." : "Notion 업로드 중...");
    try {
      const res = await fetch("/api/meeting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          transcript: text,
          summarize: doSummary,
          notionToken: settings.token,
          notionPageId: settings.mode === "page" ? settings.pageId : "",
          notionDbId: settings.mode === "db" ? settings.dbId : "",
          notionTitleProp: settings.titleProp,
        }),
      });
      const data = (await res.json()) as Result;
      setResult(data);
      setStatus(data.ok ? "완료" : "실패");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setResult({ ok: false, error: `요청 실패: ${msg}` });
      setStatus("실패");
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  const canSave = !recording && !saving && transcript.trim().length > 0;

  return (
    <main className="wrap">
      <h1 className="h1">
        <span>🎙️ 미팅비서</span>
        <span style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" onClick={() => setShowSettings((v) => !v)}>⚙️ Notion 설정</button>
          <button className="btn btn-ghost" onClick={() => void logout()}>로그아웃</button>
        </span>
      </h1>

      <div className="muted" style={{ marginTop: 8 }}>
        Notion 저장 위치:{" "}
        {configured
          ? <span className="tag-ok">설정됨 ✓ ({settings.mode === "page" ? "페이지" : "데이터베이스"})</span>
          : <span className="tag-warn">미설정 — 오른쪽 위 ‘⚙️ Notion 설정’에서 먼저 지정하세요</span>}
      </div>

      {/* ===== Notion 설정 패널 ===== */}
      {showSettings && (
        <div className="card">
          <p className="section-title">⚙️ 내 Notion 연결 설정</p>
          <p className="muted" style={{ marginTop: -4, marginBottom: 12 }}>
            사람마다 저장할 Notion이 다르므로, 본인 토큰과 저장 위치를 지정하세요.
            이 값은 <b>이 브라우저에만</b> 저장되고 회의 저장 시에만 사용됩니다.
          </p>

          <label className="label">1. Notion 통합 토큰</label>
          <input
            className="input"
            type="password"
            value={settings.token}
            onChange={(e) => setSettings({ ...settings, token: e.target.value })}
            placeholder="ntn_... 또는 secret_... (my-integrations에서 발급)"
          />

          <div className="row" style={{ marginTop: 12, marginBottom: 8 }}>
            <span className="label" style={{ margin: 0 }}>2. 저장 위치</span>
            <label className="check">
              <input type="radio" name="mode" checked={settings.mode === "page"} onChange={() => setSettings({ ...settings, mode: "page" })} />
              페이지
            </label>
            <label className="check">
              <input type="radio" name="mode" checked={settings.mode === "db"} onChange={() => setSettings({ ...settings, mode: "db" })} />
              데이터베이스
            </label>
          </div>

          {settings.mode === "page" ? (
            <input
              className="input"
              type="text"
              value={settings.pageId}
              onChange={(e) => setSettings({ ...settings, pageId: e.target.value })}
              placeholder="페이지 ID 또는 페이지 URL 붙여넣기"
            />
          ) : (
            <>
              <input
                className="input"
                type="text"
                value={settings.dbId}
                onChange={(e) => setSettings({ ...settings, dbId: e.target.value })}
                placeholder="데이터베이스 ID 또는 URL 붙여넣기"
              />
              <input
                className="input"
                type="text"
                style={{ marginTop: 8 }}
                value={settings.titleProp}
                onChange={(e) => setSettings({ ...settings, titleProp: e.target.value })}
                placeholder="제목 속성명 (기본: 이름)"
              />
            </>
          )}

          <div className="row" style={{ marginTop: 14, marginBottom: 0 }}>
            <button className="btn btn-save" onClick={saveSettings}>설정 저장</button>
            <button className="btn btn-ghost" onClick={() => setShowGuide((v) => !v)}>
              {showGuide ? "가이드 닫기" : "📘 설정 방법 가이드"}
            </button>
            {savedMsg && <span className="tag-ok" style={{ marginLeft: "auto" }}>{savedMsg}</span>}
          </div>

          {showGuide && (
            <div className="guide">
              <b>처음 한 번만 설정하면 됩니다.</b>
              <ol>
                <li>
                  <a href="https://www.notion.so/my-integrations" target="_blank" rel="noreferrer">notion.so/my-integrations</a> 접속 →
                  <b> New integration</b> 생성 → <b>액세스 토큰(Internal Integration Secret)</b> 복사 → 위 <b>1번 칸</b>에 붙여넣기
                </li>
                <li>Notion에서 회의록을 저장할 <b>페이지</b>(또는 데이터베이스)를 하나 만들기 (예: ‘회의록’)</li>
                <li>
                  그 페이지 우측 상단 <b>···</b> → <b>연결(Connections)</b> → 방금 만든 통합을 <b>추가</b>
                  <span className="muted"> (이걸 빼먹으면 저장 시 ‘권한 없음/object_not_found’ 에러)</span>
                </li>
                <li>그 페이지 URL을 복사해서 위 <b>2번 칸</b>에 붙여넣기 (ID만 자동 인식됩니다)</li>
                <li><b>설정 저장</b> 클릭 → 끝! 이제 녹음 후 <b>Notion에 저장</b>하면 내 Notion에 쌓입니다.</li>
              </ol>
              <div className="muted" style={{ marginTop: 8 }}>
                ※ 토큰은 비밀값입니다. 공용 PC라면 사용 후 토큰 칸을 비우고 저장하세요.
              </div>
            </div>
          )}
        </div>
      )}

      {!supported && (
        <div className="banner">
          이 브라우저는 음성인식을 지원하지 않습니다. <b>크롬</b> 또는 <b>엣지</b>를 사용하세요.
          (녹음·직접 입력·저장은 가능합니다)
        </div>
      )}

      {/* ===== 녹음/저장 ===== */}
      <div className="card">
        <div className="row">
          <input
            className="input"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="회의 제목 (비우면 날짜·시간 자동)"
          />
        </div>

        <div className="row">
          <label className="check">
            <input type="checkbox" checked={doSummary} onChange={(e) => setDoSummary(e.target.checked)} />
            AI 요약 포함 <span style={{ color: "rgba(255,255,255,.35)" }}>(끄면 전문만 저장)</span>
          </label>
        </div>

        <div className="row">
          {recording ? (
            <button className="btn btn-stop" onClick={stopRecording}>■ 녹음 종료</button>
          ) : (
            <button className="btn btn-rec" onClick={() => void startRecording()}>● 녹음 시작</button>
          )}
          <button className="btn btn-save" onClick={() => void save()} disabled={!canSave}>
            {saving ? "저장 중..." : "Notion에 저장"}
          </button>
          <span className="status">
            <span className={`dot${recording ? " live" : ""}`} />
            {status}
          </span>
        </div>

        <textarea
          className="textarea"
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="여기에 실시간으로 변환된 회의 내용이 표시됩니다. 직접 수정도 가능합니다."
        />

        <div className="hint">
          ⚠️ 음성인식은 <b>크롬 · 엣지</b>에서 가장 잘 동작합니다. 녹음 종료 후 텍스트를 다듬은 뒤 저장하면 더 정확한 회의록이 됩니다.
        </div>

        {audioUrl && <audio controls src={audioUrl} />}

        {result && (
          <div className={`result ${result.ok ? "ok" : "err"}`}>
            {result.ok ? (
              <>
                ✅ 저장 완료:{" "}
                <a href={result.url} target="_blank" rel="noreferrer">{result.title} — Notion에서 열기 ↗</a>
                {result.note && <div className="warn" style={{ marginTop: 6 }}>⚠️ {result.note}</div>}
              </>
            ) : (
              <>❌ {result.error}</>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
