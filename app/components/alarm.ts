"use client";

/**
 * 알람 매니저: 여러 알림음 중 선택 + 미리듣기, 종료를 누를 때까지 반복.
 */

let ctx: AudioContext | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let ringing = false;
let label = "알림";
const listeners = new Set<() => void>();
let selectedId = "beepbo";
let loaded = false;

function emit() {
  listeners.forEach((l) => l());
}

function ensureCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new Ctx();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

export function primeAudio() {
  ensureCtx();
}

/** 단순 톤 1개 */
function tone(ac: AudioContext, t: number, freq: number, dur: number, type: OscillatorType = "square", vol = 0.6) {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.connect(g);
  g.connect(ac.destination);
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.setValueAtTime(vol, t + Math.max(0.02, dur - 0.03));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.start(t);
  o.stop(t + dur + 0.02);
}

type Sound = { id: string; label: string; interval: number; play: (ac: AudioContext, t: number) => void };

const SOUNDS: Sound[] = [
  {
    id: "beepbo", label: "삐뽀 (기본)", interval: 800,
    play: (ac, t) => { tone(ac, t, 1046, 0.16); tone(ac, t + 0.18, 784, 0.22); },
  },
  {
    id: "rapid", label: "연속 비프", interval: 700,
    play: (ac, t) => { for (let i = 0; i < 3; i++) tone(ac, t + i * 0.13, 1320, 0.08, "square", 0.6); },
  },
  {
    id: "clock", label: "알람시계", interval: 750,
    play: (ac, t) => { for (let i = 0; i < 7; i++) tone(ac, t + i * 0.085, 1000, 0.05, "square", 0.5); },
  },
  {
    id: "dingdong", label: "딩동", interval: 1300,
    play: (ac, t) => { tone(ac, t, 880, 0.35, "sine", 0.6); tone(ac, t + 0.4, 659, 0.5, "sine", 0.6); },
  },
  {
    id: "siren", label: "사이렌", interval: 900,
    play: (ac, t) => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.connect(g); g.connect(ac.destination);
      o.type = "sawtooth";
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.45, t + 0.02);
      o.frequency.setValueAtTime(600, t);
      o.frequency.linearRampToValueAtTime(1200, t + 0.4);
      o.frequency.linearRampToValueAtTime(600, t + 0.8);
      g.gain.setValueAtTime(0.45, t + 0.78);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.82);
      o.start(t); o.stop(t + 0.84);
    },
  },
];

function ensureLoaded() {
  if (loaded) return;
  loaded = true;
  try {
    const s = localStorage.getItem("alarm-sound");
    if (s && SOUNDS.some((x) => x.id === s)) selectedId = s;
  } catch {
    // 무시
  }
}

function currentSound(): Sound {
  ensureLoaded();
  return SOUNDS.find((s) => s.id === selectedId) ?? SOUNDS[0];
}

export function listSounds() {
  return SOUNDS.map((s) => ({ id: s.id, label: s.label }));
}
export function getAlarmSound() {
  ensureLoaded();
  return selectedId;
}
export function setAlarmSound(id: string) {
  selectedId = id;
  loaded = true;
  try { localStorage.setItem("alarm-sound", id); } catch { /* 무시 */ }
}
export function previewSound(id?: string) {
  const ac = ensureCtx();
  if (!ac) return;
  const s = SOUNDS.find((x) => x.id === (id ?? getAlarmSound())) ?? SOUNDS[0];
  s.play(ac, ac.currentTime + 0.02);
}

export function startAlarm(msg?: string) {
  if (msg) label = msg;
  if (ringing) { emit(); return; }
  ringing = true;
  const s = currentSound();
  const ac = ensureCtx();
  if (ac) s.play(ac, ac.currentTime + 0.02);
  timer = setInterval(() => {
    const cur = currentSound();
    const a = ensureCtx();
    if (a) cur.play(a, a.currentTime + 0.02);
  }, currentSound().interval);
  emit();
}

export function stopAlarm() {
  ringing = false;
  if (timer) { clearInterval(timer); timer = null; }
  emit();
}

export function isAlarmRinging() { return ringing; }
export function getAlarmLabel() { return label; }
export function subscribeAlarm(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** 브라우저 알림 (권한 허용 시) */
export function notify(title: string, body: string) {
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    new Notification(title, { body });
  }
}
export async function requestNotifyPermission(): Promise<NotificationPermission> {
  if (typeof Notification === "undefined") return "denied";
  return Notification.requestPermission();
}
