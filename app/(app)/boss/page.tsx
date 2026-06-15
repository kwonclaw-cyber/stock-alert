"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "../../components/StoreProvider";
import { TextInput, Btn } from "../../components/fields";
import Loading from "../../components/Loading";
import PageHelp from "../../components/PageHelp";
import { uid } from "@/lib/data";

/** 남은 시간 계산 */
function spawnInfo(lastKill: string | null, respawnMin: number, now: number) {
  if (!lastKill) return { ready: true, label: "처치 기록 없음", ms: Number.MAX_SAFE_INTEGER };
  const next = new Date(lastKill).getTime() + respawnMin * 60_000;
  const ms = next - now;
  if (ms <= 0) return { ready: true, label: "젠 가능!", ms };
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const label = h > 0 ? `${h}시간 ${m}분 ${s}초` : `${m}분 ${s}초`;
  return { ready: false, label, ms };
}

/** WebAudio 비프음 */
function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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

export default function BossPage() {
  const { data, update } = useStore();
  const [now, setNow] = useState(() => Date.now());
  const [perm, setPerm] = useState<NotificationPermission>("default");
  const fired = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof Notification !== "undefined") setPerm(Notification.permission);
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // 알람 체크: 젠 시각을 지나면 1회 알림
  useEffect(() => {
    if (!data) return;
    for (const b of data.bossTimers) {
      if (!b.alarm || !b.lastKill) continue;
      const key = `${b.id}:${b.lastKill}`;
      const next = new Date(b.lastKill).getTime() + b.respawnMin * 60_000;
      if (Date.now() >= next && !fired.current.has(key)) {
        fired.current.add(key);
        beep();
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          new Notification("⚔️ 보스 젠!", { body: `${b.name} (${b.location || "위치 미지정"}) 젠 시간입니다.` });
        }
      }
    }
  }, [now, data]);

  if (!data) return <Loading />;

  async function requestPerm() {
    if (typeof Notification === "undefined") return;
    const p = await Notification.requestPermission();
    setPerm(p);
  }

  const sorted = [...data.bossTimers]
    .map((b) => ({ b, info: spawnInfo(b.lastKill, b.respawnMin, now) }))
    .sort((a, z) => a.info.ms - z.info.ms);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHelp>
        보스를 잡으면 <b>처치!</b>를 눌러 다음 젠까지 카운트다운을 시작하세요. 목록은 젠이 임박한 순으로 정렬돼요. 각 보스의 <b>🔔</b>을 켜고 “알림 권한 허용”을 누르면 젠 시각에 <b>소리·알림</b>이 옵니다. (탭이 열려 있어야 동작)
      </PageHelp>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-white/50">“처치!”를 누르면 다음 젠 타이머가 시작돼요. 🔔을 켜면 젠 시각에 소리·알림이 옵니다.</p>
        <div className="flex items-center gap-2">
          {perm !== "granted" && (
            <Btn onClick={requestPerm}>🔔 알림 권한 허용</Btn>
          )}
          <Btn
            variant="primary"
            onClick={() =>
              update((d) => {
                d.bossTimers.push({ id: uid(), name: "새 보스", location: "", respawnMin: 60, lastKill: null, alarm: false, memo: "" });
              })
            }
          >
            + 보스 추가
          </Btn>
        </div>
      </div>

      {perm === "denied" && (
        <p className="mb-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          브라우저 알림이 차단돼 있어요. 주소창 옆 자물쇠 아이콘에서 알림을 허용하면 팝업 알림이 옵니다. (소리는 차단과 무관하게 재생됩니다)
        </p>
      )}

      <div className="space-y-3">
        {sorted.map(({ b, info }) => {
          const gi = data.bossTimers.findIndex((x) => x.id === b.id);
          return (
            <div
              key={b.id}
              className={`rounded-xl border bg-[#15171c] p-4 ${info.ready && b.lastKill ? "border-emerald-400/50" : "border-white/10"}`}
            >
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => update((d) => { d.bossTimers[gi].alarm = !d.bossTimers[gi].alarm; })}
                  className={`text-xl transition ${b.alarm ? "opacity-100" : "opacity-30 grayscale"}`}
                  title={b.alarm ? "알람 켜짐" : "알람 꺼짐"}
                >
                  🔔
                </button>
                <TextInput value={b.name} onChange={(v) => update((d) => { d.bossTimers[gi].name = v; })} placeholder="보스 이름" className="w-36 font-semibold" />
                <TextInput value={b.location} onChange={(v) => update((d) => { d.bossTimers[gi].location = v; })} placeholder="위치" className="w-32" />
                <label className="flex items-center gap-1.5 text-xs text-white/50">
                  주기
                  <TextInput type="number" value={b.respawnMin} onChange={(v) => update((d) => { d.bossTimers[gi].respawnMin = Number(v) || 0; })} className="w-20" />
                  분
                </label>

                <div className="ml-auto flex items-center gap-3">
                  <span className={`min-w-32 text-right font-mono text-lg font-bold ${info.ready && b.lastKill ? "text-emerald-400" : "text-white"}`}>
                    {info.label}
                  </span>
                  <Btn variant="primary" onClick={() => update((d) => { d.bossTimers[gi].lastKill = new Date().toISOString(); })}>처치!</Btn>
                  <Btn variant="ghost" onClick={() => update((d) => { d.bossTimers[gi].lastKill = null; })}>리셋</Btn>
                  <button onClick={() => update((d) => { d.bossTimers.splice(gi, 1); })} className="text-red-300/60 hover:text-red-300" title="삭제">×</button>
                </div>
              </div>
              {b.lastKill && (
                <p className="mt-2 text-xs text-white/35">마지막 처치: {new Date(b.lastKill).toLocaleString("ko-KR")}</p>
              )}
            </div>
          );
        })}
        {data.bossTimers.length === 0 && (
          <p className="py-10 text-center text-sm text-white/30">등록된 보스가 없습니다. “보스 추가”를 눌러주세요.</p>
        )}
      </div>
    </div>
  );
}
