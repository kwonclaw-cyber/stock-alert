"use client";

import { useStore } from "../../components/StoreProvider";
import { TextInput, Btn } from "../../components/fields";
import Loading from "../../components/Loading";
import GuildSelect from "../../components/GuildSelect";
import { resolveMembers } from "../../components/useMembers";
import { todayKey, uid } from "@/lib/data";

export default function DailyPage() {
  const { data, update } = useStore();
  if (!data) return <Loading />;

  const daily = data.daily;
  const today = todayKey();
  const members = resolveMembers(data, daily.guildId, daily.manualMembers);

  const ckey = (memberKey: string, taskId: string) => `${today}|${memberKey}|${taskId}`;
  const isDone = (memberKey: string, taskId: string) => Boolean(daily.checks[ckey(memberKey, taskId)]);

  function toggle(memberKey: string, taskId: string) {
    update((d) => {
      const k = `${today}|${memberKey}|${taskId}`;
      if (d.daily.checks[k]) delete d.daily.checks[k];
      else d.daily.checks[k] = true;
    });
  }

  const memberDone = (memberKey: string) => daily.tasks.filter((t) => isDone(memberKey, t.id)).length;
  const fullyDone = members.filter((m) => daily.tasks.length > 0 && memberDone(m.key) === daily.tasks.length).length;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <GuildSelect guilds={data.guilds} value={daily.guildId} onChange={(id) => update((d) => { d.daily.guildId = id; })} />
        <div className="text-sm text-white/50">
          기준일 <b className="text-white/80">{today}</b> · 전원완료{" "}
          <b className="text-emerald-300">{fullyDone}</b>/{members.length}명
        </div>
        <Btn variant="primary" onClick={() => update((d) => { d.daily.tasks.push({ id: uid(), name: "새 숙제" }); })}>
          + 숙제 항목 추가
        </Btn>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#15171c]">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-[11px] font-medium text-white/45">
              <th className="w-10 border-b border-white/10 py-2 text-center">#</th>
              <th className="sticky left-0 border-b border-r border-white/10 bg-[#15171c] py-2 pl-3 text-left">문파원</th>
              {daily.tasks.map((t, ti) => (
                <th key={t.id} className="min-w-24 border-b border-l border-white/5 px-1 py-1.5 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <TextInput
                      value={t.name}
                      onChange={(v) => update((d) => { d.daily.tasks[ti].name = v; })}
                      className="w-20 !px-1 !py-1 text-center text-xs"
                    />
                    <button
                      onClick={() => update((d) => { d.daily.tasks.splice(ti, 1); })}
                      className="text-red-300/40 hover:text-red-300"
                      title="항목 삭제"
                    >×</button>
                  </div>
                </th>
              ))}
              <th className="w-16 border-b border-l border-white/10 py-2 text-center">완료</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m, i) => {
              const done = memberDone(m.key);
              const all = daily.tasks.length > 0 && done === daily.tasks.length;
              return (
                <tr key={m.key} className={`border-t border-white/5 transition hover:bg-white/[0.025] ${all ? "bg-emerald-500/[0.06]" : ""}`}>
                  <td className="py-1.5 text-center text-[11px] text-white/35">{i + 1}</td>
                  <td className="sticky left-0 border-r border-white/10 bg-[#15171c] py-1.5 pl-3 text-left">
                    {m.manual ? (
                      <span className="flex items-center gap-1">
                        <TextInput
                          value={m.name}
                          onChange={(v) => update((d) => { const mm = d.daily.manualMembers.find((x) => `m:${x.id}` === m.key); if (mm) mm.name = v; })}
                          placeholder="이름(수동)"
                          className="w-28 !py-1"
                        />
                        <button onClick={() => update((d) => { d.daily.manualMembers = d.daily.manualMembers.filter((x) => `m:${x.id}` !== m.key); })} className="text-red-300/50 hover:text-red-300" title="삭제">×</button>
                      </span>
                    ) : (
                      <span className="text-white/85">{m.name}</span>
                    )}
                  </td>
                  {daily.tasks.map((t) => {
                    const checked = isDone(m.key, t.id);
                    return (
                      <td key={t.id} className="border-l border-white/5 py-1.5 text-center">
                        <button
                          onClick={() => toggle(m.key, t.id)}
                          className={`flex h-6 w-6 items-center justify-center rounded-md border transition ${checked ? "border-emerald-400/50 bg-emerald-500/30 text-emerald-200" : "border-white/15 bg-white/5 text-transparent hover:border-white/30"}`}
                          title={checked ? "완료" : "미완료"}
                        >
                          ✓
                        </button>
                      </td>
                    );
                  })}
                  <td className="border-l border-white/10 py-1.5 text-center text-xs font-semibold text-white/70">
                    {done}/{daily.tasks.length}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-2">
        <Btn variant="ghost" onClick={() => update((d) => { d.daily.manualMembers.push({ id: uid(), name: "" }); })}>
          + 문파원 수동 추가
        </Btn>
      </div>
    </div>
  );
}
