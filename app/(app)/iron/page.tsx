"use client";

import { useEffect, useState } from "react";
import { useStore } from "../../components/StoreProvider";
import { TextInput, Btn } from "../../components/fields";
import Loading from "../../components/Loading";
import GuildSelect from "../../components/GuildSelect";
import { resolveMembers } from "../../components/useMembers";
import { todayKey, uid } from "@/lib/data";

function remainLabel(lastDoneAt: string | null, cooldownMin: number, now: number) {
  if (cooldownMin <= 0 || !lastDoneAt) return null;
  const ms = new Date(lastDoneAt).getTime() + cooldownMin * 60_000 - now;
  if (ms <= 0) return { ready: true, text: "가능" };
  const sec = Math.floor(ms / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return { ready: false, text: h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}` };
}

export default function IronPage() {
  const { data, update } = useStore();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!data) return <Loading />;

  const iron = data.iron;
  const today = todayKey();
  const members = resolveMembers(data, iron.guildId, iron.manualMembers);

  const rec = (key: string) => iron.records[key] ?? { lastDoneAt: null, daily: {} };
  const todayCount = (key: string) => rec(key).daily[today] ?? 0;
  const totalDoneToday = members.reduce((sum, m) => sum + todayCount(m.key), 0);

  function complete(key: string) {
    update((d) => {
      const r = d.iron.records[key] ?? { lastDoneAt: null, daily: {} };
      r.lastDoneAt = new Date().toISOString();
      r.daily[today] = (r.daily[today] ?? 0) + 1;
      d.iron.records[key] = r;
    });
  }
  function undo(key: string) {
    update((d) => {
      const r = d.iron.records[key];
      if (!r) return;
      r.daily[today] = Math.max(0, (r.daily[today] ?? 0) - 1);
    });
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <GuildSelect guilds={data.guilds} value={iron.guildId} onChange={(id) => update((d) => { d.iron.guildId = id; })} />
        <label className="flex items-center gap-1.5 text-sm text-white/50">
          철넣기 주기
          <TextInput type="number" value={iron.cooldownMin} onChange={(v) => update((d) => { d.iron.cooldownMin = Number(v) || 0; })} className="w-20" />
          분 <span className="text-xs text-white/30">(0=타이머 없음)</span>
        </label>
        <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-sm">
          <span className="text-white/60">오늘 누적 완료</span>{" "}
          <b className="text-emerald-300">{totalDoneToday}</b>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/10 bg-[#15171c]">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-[11px] font-medium text-white/45">
              <th className="w-10 border-b border-white/10 py-2 text-center">#</th>
              <th className="border-b border-white/10 py-2 text-left">문파원</th>
              <th className="border-b border-white/10 py-2 text-center">마지막 완료</th>
              {iron.cooldownMin > 0 && <th className="border-b border-white/10 py-2 text-center">다음 가능</th>}
              <th className="w-24 border-b border-white/10 py-2 text-center">오늘 횟수</th>
              <th className="w-40 border-b border-white/10 py-2 text-center">완료 체크</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m, i) => {
              const r = rec(m.key);
              const remain = remainLabel(r.lastDoneAt, iron.cooldownMin, now);
              const cnt = todayCount(m.key);
              return (
                <tr key={m.key} className="border-t border-white/5 transition hover:bg-white/[0.025]">
                  <td className="py-1.5 text-center text-[11px] text-white/35">{i + 1}</td>
                  <td className="py-1.5 pl-3 text-left">
                    {m.manual ? (
                      <ManualName
                        value={m.name}
                        onChange={(v) => update((d) => { const mm = d.iron.manualMembers.find((x) => `m:${x.id}` === m.key); if (mm) mm.name = v; })}
                        onRemove={() => update((d) => { d.iron.manualMembers = d.iron.manualMembers.filter((x) => `m:${x.id}` !== m.key); })}
                      />
                    ) : (
                      <span className="text-white/85">{m.name}</span>
                    )}
                  </td>
                  <td className="py-1.5 text-center text-xs text-white/45">
                    {r.lastDoneAt ? new Date(r.lastDoneAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) : "—"}
                  </td>
                  {iron.cooldownMin > 0 && (
                    <td className={`py-1.5 text-center font-mono text-xs ${remain?.ready ? "text-emerald-400" : "text-white/60"}`}>
                      {remain ? remain.text : "—"}
                    </td>
                  )}
                  <td className="py-1.5 text-center">
                    <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-sm font-bold ${cnt > 0 ? "bg-emerald-500/20 text-emerald-300" : "bg-white/5 text-white/40"}`}>
                      {cnt}
                    </span>
                  </td>
                  <td className="py-1.5 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <Btn variant="primary" onClick={() => complete(m.key)} className="!py-1 !text-xs">철넣기 완료</Btn>
                      <button onClick={() => undo(m.key)} className="px-1 text-white/35 hover:text-white" title="1회 취소">↺</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-2">
        <Btn variant="ghost" onClick={() => update((d) => { d.iron.manualMembers.push({ id: uid(), name: "" }); })}>
          + 문파원 수동 추가
        </Btn>
      </div>
    </div>
  );
}

function ManualName({ value, onChange, onRemove }: { value: string; onChange: (v: string) => void; onRemove: () => void }) {
  return (
    <span className="flex items-center gap-1">
      <TextInput value={value} onChange={onChange} placeholder="이름(수동)" className="w-28 !py-1" />
      <button onClick={onRemove} className="text-red-300/50 hover:text-red-300" title="삭제">×</button>
    </span>
  );
}
