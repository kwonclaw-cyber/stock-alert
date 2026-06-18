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

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const finalRef = useRef("");
  const recordingRef = useRef(false);

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: SRConstructor; webkitSpeechRecognition?: SRConstructor };
    setSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

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
        body: JSON.stringify({ title, transcript: text, summarize: doSummary }),
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
        <span>🎙️ 회의록</span>
        <button className="btn btn-ghost" onClick={() => void logout()}>로그아웃</button>
      </h1>

      {!supported && (
        <div className="banner">
          이 브라우저는 음성인식을 지원하지 않습니다. <b>크롬</b> 또는 <b>엣지</b>를 사용하세요.
          (녹음·직접 입력·저장은 가능합니다)
        </div>
      )}

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
