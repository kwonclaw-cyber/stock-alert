"use client";

/**
 * 알람 매니저: 종료를 누를 때까지 크게 반복되는 알림 소리.
 * - startAlarm(label): 소리 반복 시작(이미 울리는 중이면 라벨만 갱신)
 * - stopAlarm(): 정지
 * - subscribeAlarm(fn): 울림 상태 변화 구독 (UI 배너용)
 */

let ctx: AudioContext | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let ringing = false;
let label = "알림";
const listeners = new Set<() => void>();

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

/** 사용자 제스처 시 오디오를 미리 깨워두면, 이후 타이머 알림 소리가 잘 난다 */
export function primeAudio() {
  ensureCtx();
}

/** 크고 또렷한 삑- 소리 1회 */
function blast() {
  const ac = ensureCtx();
  if (!ac) return;
  const t = ac.currentTime;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.connect(g);
  g.connect(ac.destination);
  osc.type = "square";
  // 두 음 번갈아(삐뽀) 느낌
  osc.frequency.setValueAtTime(1046, t);
  osc.frequency.setValueAtTime(784, t + 0.18);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.7, t + 0.02);
  g.gain.setValueAtTime(0.7, t + 0.34);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
  osc.start(t);
  osc.stop(t + 0.42);
}

export function startAlarm(msg?: string) {
  if (msg) label = msg;
  if (ringing) {
    emit();
    return;
  }
  ringing = true;
  blast();
  timer = setInterval(blast, 800);
  emit();
}

export function stopAlarm() {
  ringing = false;
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  emit();
}

export function isAlarmRinging() {
  return ringing;
}
export function getAlarmLabel() {
  return label;
}
export function subscribeAlarm(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** 브라우저 알림 (권한 허용 시) */
export function notify(title: string, body: string) {
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    new Notification(title, { body });
  }
}

/** 알림 권한 요청 */
export async function requestNotifyPermission(): Promise<NotificationPermission> {
  if (typeof Notification === "undefined") return "denied";
  return Notification.requestPermission();
}
