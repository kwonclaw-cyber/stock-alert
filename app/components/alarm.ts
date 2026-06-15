"use client";

/** WebAudio 비프음 (알람용) */
export function beep() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ac = new Ctx();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.001, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, ac.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.6);
    osc.start();
    osc.stop(ac.currentTime + 0.6);
    osc.onended = () => ac.close();
  } catch {
    // 무시
  }
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
