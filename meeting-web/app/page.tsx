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

type Segment = { text: string; speaker: number | null };

const SETTINGS_KEY = "meeting_notion_settings";
const PARTICIPANTS_KEY = "meeting_participants";
const emptySettings: NotionSettings = { token: "", mode: "page", pageId: "", dbId: "", titleProp: "이름" };
const SPK_COLORS = ["#41A595", "#E8A13C", "#5B8DEF", "#D6699A", "#9B6DD6", "#6FBF73"];

/** 전사 텍스트를 문장 단위로 분할 (문장부호/줄바꿈 기준) */
function splitSentences(text: string): string[] {
  return text
    .replace(/\r/g, "")
    .replace(/([.?!。…])\s+/g, "$1\n")
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

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

  // Notion 설정
  const [settings, setSettings] = useState<NotionSettings>(emptySettings);
  const [showSettings, setShowSettings] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  // 화자 지정
  const [participants, setParticipants] = useState<string[]>(["A", "B", "C"]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [showSpeaker, setShowSpeaker] = useState(false);
  const [useSpeakers, setUseSpeakers] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const finalRef = useRef("");
  const recordingRef = useRef(false);
  const firstP = useRef(true);

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: SRConstructor; webkitSpeechRecognition?: SRConstructor };
    setSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) setSettings({ ...emptySettings, ...JSON.parse(raw) });
      else setShowSettings(true);
      const rawP = localStorage.getItem(PARTICIPANTS_KEY);
      if (rawP) {
        const arr = JSON.parse(rawP);
        if (Array.isArray(arr) && arr.length) setParticipants(arr.map(String));
      }
    } catch {
      /* 무시 */
    }
  }, []);

  // 참가자 명칭은 브라우저에 기억
  useEffect(() => {
    if (firstP.current) { firstP.current = false; return; }
    try { localStorage.setItem(PARTICIPANTS_KEY, JSON.stringify(participants)); } catch { /* 무시 */ }
  }, [participants]);

  const configured = Boolean(settings.token && (settings.mode === "page" ? settings.pageId : settings.dbId));
  const plabel = (i: number) => participants[i]?.trim() || String.fromCharCode(65 + i);

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
    rec.onend = () => { if (recordingRef.current) { try { rec.start(); } catch { /* 무시 */ } } };
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

  // ── 화자 지정 ──
  function openSpeakerPanel() {
    if (!showSpeaker) {
      if (!segments.length) rebuildSegments();
      setShowSpeaker(true);
      setUseSpeakers(true);
    } else {
      setShowSpeaker(false);
    }
  }
  function rebuildSegments() {
    setSegments(splitSentences(transcript).map((t) => ({ text: t, speaker: null })));
  }
  function setSegSpeaker(i: number, spk: number) {
    setSegments((segs) => segs.map((s, idx) => (idx === i ? { ...s, speaker: s.speaker === spk ? null : spk } : s)));
  }
  function setSegText(i: number, val: string) {
    setSegments((segs) => segs.map((s, idx) => (idx === i ? { ...s, text: val } : s)));
  }
  function deleteSeg(i: number) {
    setSegments((segs) => segs.filter((_, idx) => idx !== i));
  }
  function addSeg() {
    setSegments((segs) => [...segs, { text: "", speaker: null }]);
  }
  function editParticipant(i: number, val: string) {
    setParticipants((p) => p.map((x, idx) => (idx === i ? val : x)));
  }
  function addParticipant() {
    setParticipants((p) => (p.length >= 6 ? p : [...p, String.fromCharCode(65 + p.length)]));
  }
  function removeParticipant(i: number) {
    setParticipants((p) => (p.length <= 1 ? p : p.filter((_, idx) => idx !== i)));
    setSegments((segs) => segs.map((s) => {
      if (s.speaker === i) return { ...s, speaker: null };
      if (s.speaker != null && s.speaker > i) return { ...s, speaker: s.speaker - 1 };
      return s;
    }));
  }

  /** 저장에 보낼 본문: 화자 모드면 '이름: 문장', 아니면 원문 */
  function buildTranscriptToSave(): string {
    if (useSpeakers && segments.length) {
      return segments
        .filter((s) => s.text.trim())
        .map((s) => (s.speaker != null ? `${plabel(s.speaker)}: ${s.text.trim()}` : s.text.trim()))
        .join("\n");
    }
    return transcript.trim();
  }

  async function save() {
    const text = buildTranscriptToSave();
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
          <input className="input" type="password" value={settings.token}
            onChange={(e) => setSettings({ ...settings, token: e.target.value })}
            placeholder="ntn_... 또는 secret_... (my-integrations에서 발급)" />
          <div className="row" style={{ marginTop: 12, marginBottom: 8 }}>
            <span className="label" style={{ margin: 0 }}>2. 저장 위치</span>
            <label className="check">
              <input type="radio" name="mode" checked={settings.mode === "page"} onChange={() => setSettings({ ...settings, mode: "page" })} /> 페이지
            </label>
            <label className="check">
              <input type="radio" name="mode" checked={settings.mode === "db"} onChange={() => setSettings({ ...settings, mode: "db" })} /> 데이터베이스
            </label>
          </div>
          {settings.mode === "page" ? (
            <input className="input" type="text" value={settings.pageId}
              onChange={(e) => setSettings({ ...settings, pageId: e.target.value })}
              placeholder="페이지 ID 또는 페이지 URL 붙여넣기" />
          ) : (
            <>
              <input className="input" type="text" value={settings.dbId}
                onChange={(e) => setSettings({ ...settings, dbId: e.target.value })}
                placeholder="데이터베이스 ID 또는 URL 붙여넣기" />
              <input className="input" type="text" style={{ marginTop: 8 }} value={settings.titleProp}
                onChange={(e) => setSettings({ ...settings, titleProp: e.target.value })}
                placeholder="제목 속성명 (기본: 이름)" />
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
                <li><a href="https://www.notion.so/my-integrations" target="_blank" rel="noreferrer">notion.so/my-integrations</a> → <b>New integration</b> 생성 → <b>액세스 토큰</b> 복사 → 위 <b>1번 칸</b>에 붙여넣기</li>
                <li>Notion에서 회의록 저장할 <b>페이지</b> 만들기 (예: ‘회의록’)</li>
                <li>그 페이지 <b>···</b> → <b>연결(Connections)</b> → 만든 통합 <b>추가</b> <span className="muted">(빼먹으면 권한 에러)</span></li>
                <li>그 페이지 URL을 <b>2번 칸</b>에 붙여넣기 (ID 자동 인식)</li>
                <li><b>설정 저장</b> → 끝! 녹음 후 저장하면 내 Notion에 쌓입니다.</li>
              </ol>
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
          <input className="input" type="text" value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="회의 제목 (비우면 날짜·시간 자동)" />
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
        <textarea className="textarea" value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="여기에 실시간으로 변환된 회의 내용이 표시됩니다. 직접 수정도 가능합니다." />
        <div className="row" style={{ marginTop: 10, marginBottom: 0 }}>
          <button className="btn btn-ghost" onClick={openSpeakerPanel} disabled={recording || !transcript.trim()}>
            {showSpeaker ? "🗣️ 화자 지정 닫기" : "🗣️ 문장별 화자 지정"}
          </button>
          {useSpeakers && segments.length > 0 && !showSpeaker && (
            <span className="muted">저장 시 화자 라벨이 적용됩니다</span>
          )}
        </div>
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

      {/* ===== 문장별 화자 지정 패널 ===== */}
      {showSpeaker && (
        <div className="card">
          <p className="section-title">🗣️ 문장별 화자 지정</p>
          <p className="muted" style={{ marginTop: -4, marginBottom: 10 }}>
            참가자 이름을 정하고, 각 문장에서 말한 사람을 눌러 지정하세요. 지정한 대로 <b>‘이름: 문장’</b> 형식으로 저장됩니다.
          </p>

          {/* 참가자 명칭 */}
          <label className="label">참가자 (이름 클릭해서 수정)</label>
          <div className="row" style={{ marginBottom: 6 }}>
            {participants.map((p, i) => (
              <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <input
                  className="input"
                  style={{ width: 110, borderColor: SPK_COLORS[i % 6], padding: "6px 8px" }}
                  value={p}
                  onChange={(e) => editParticipant(i, e.target.value)}
                  placeholder={String.fromCharCode(65 + i)}
                />
                {participants.length > 1 && (
                  <button className="x-btn" onClick={() => removeParticipant(i)} title="참가자 삭제">×</button>
                )}
              </span>
            ))}
            {participants.length < 6 && (
              <button className="btn btn-ghost" onClick={addParticipant}>+ 참가자</button>
            )}
          </div>

          <div className="row" style={{ marginTop: 12, marginBottom: 6 }}>
            <button className="btn btn-ghost" onClick={rebuildSegments} title="위 전사 내용으로 문장을 다시 나눕니다">↻ 문장 다시 나누기</button>
            <button className="btn btn-ghost" onClick={addSeg}>+ 문장 추가</button>
            <label className="check" style={{ marginLeft: "auto" }}>
              <input type="checkbox" checked={useSpeakers} onChange={(e) => setUseSpeakers(e.target.checked)} />
              저장에 화자 라벨 적용
            </label>
          </div>

          {/* 문장 목록 */}
          <div>
            {segments.length === 0 && (
              <p className="muted" style={{ padding: "10px 0" }}>나눌 문장이 없습니다. 위 전사 칸에 내용을 입력한 뒤 ‘문장 다시 나누기’를 누르세요.</p>
            )}
            {segments.map((s, i) => (
              <div className="seg-row" key={i}>
                <div className="seg-spk">
                  {participants.map((_, pi) => {
                    const on = s.speaker === pi;
                    const c = SPK_COLORS[pi % 6];
                    return (
                      <button
                        key={pi}
                        className="spk-chip"
                        onClick={() => setSegSpeaker(i, pi)}
                        style={{
                          borderColor: c,
                          color: on ? "#0e0f13" : c,
                          background: on ? c : "transparent",
                          fontWeight: on ? 700 : 500,
                        }}
                        title={plabel(pi)}
                      >
                        {plabel(pi)}
                      </button>
                    );
                  })}
                </div>
                <input className="input seg-text" value={s.text} onChange={(e) => setSegText(i, e.target.value)} />
                <button className="x-btn" onClick={() => deleteSeg(i)} title="문장 삭제">×</button>
              </div>
            ))}
          </div>

          <div className="row" style={{ marginTop: 14, marginBottom: 0 }}>
            <button className="btn btn-save" onClick={() => void save()} disabled={!canSave}>
              {saving ? "저장 중..." : "이 화자 지정으로 Notion에 저장"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
