"use client";

import { useEffect, useState } from "react";
import { useStore } from "../../components/StoreProvider";
import { TextInput, Btn } from "../../components/fields";
import Loading from "../../components/Loading";
import PageHelp from "../../components/PageHelp";
import { sendDiscord } from "../../components/discord";
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

export default function BossPage() {
  const { data, update } = useStore();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // 디스코드 자동 알림: 웹훅이 설정돼 있으면 젠 시각에 1회 전송(중복 방지 notifiedKill)
  useEffect(() => {
    if (!data?.discordWebhook) return;
    for (const b of data.bossTimers) {
      if (!b.lastKill) continue;
      const next = new Date(b.lastKill).getTime() + b.respawnMin * 60_000;
      if (Date.now() >= next && b.notifiedKill !== b.lastKill) {
        update((d) => { const bb = d.bossTimers.find((x) => x.id === b.id); if (bb) bb.notifiedKill = bb.lastKill; });
        sendDiscord(data.discordWebhook, `⚔️ **${b.name}** 젠! (${b.location || "위치 미지정"})`);
      }
    }
  }, [now, data, update]);

  if (!data) return <Loading />;
  const webhook = data.discordWebhook;

  const sorted = [...data.bossTimers]
    .map((b) => ({ b, info: spawnInfo(b.lastKill, b.respawnMin, now) }))
    .sort((a, z) => a.info.ms - z.info.ms);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHelp>
        보스를 잡으면 <b>처치!</b>를 눌러 다음 젠까지 카운트다운을 시작하세요. 목록은 젠 임박순 정렬돼요. <b>정보공유 탭</b>에 디스코드 웹훅을 등록하면 젠 시각에 <b>디스코드 채널로 자동 푸시</b>되고, 각 보스의 <b>디스코드</b> 버튼으로 수동 전송도 돼요.
      </PageHelp>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-white/50">“처치!”를 누르면 다음 젠 타이머가 시작돼요.</p>
        <Btn
          variant="primary"
          onClick={() =>
            update((d) => {
              d.bossTimers.push({ id: uid(), name: "새 보스", location: "", respawnMin: 60, lastKill: null, alarm: false, notifiedKill: null, memo: "" });
            })
          }
        >
          + 보스 추가
        </Btn>
      </div>

      <div className="space-y-3">
        {sorted.map(({ b, info }) => {
          const gi = data.bossTimers.findIndex((x) => x.id === b.id);
          return (
            <div
              key={b.id}
              className={`rounded-xl border bg-[#15171c] p-4 ${info.ready && b.lastKill ? "border-emerald-400/50" : "border-white/10"}`}
            >
              <div className="flex flex-wrap items-center gap-3">
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
                  {webhook && (
                    <Btn onClick={() => { void sendDiscord(webhook, `⚔️ **${b.name}** ${info.ready && b.lastKill ? "젠!" : "젠 알림"} (${b.location || "위치 미지정"})`); }} className="!text-xs" title="디스코드로 전송">
                      디스코드
                    </Btn>
                  )}
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
