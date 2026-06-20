"use client";

import { useState } from "react";
import { useStore } from "../../components/StoreProvider";
import { TextInput, Btn } from "../../components/fields";
import Loading from "../../components/Loading";
import GuildSelect from "../../components/GuildSelect";
import PageHelp from "../../components/PageHelp";
import { confirmDelete } from "@/lib/confirmDelete";
import { resolveMembers } from "../../components/useMembers";
import { todayKey, uid } from "@/lib/data";

/** 날짜 문자열(YYYY-MM-DD)을 delta일 이동 */
function shiftDate(ds: string, delta: number): string {
  const d = new Date(ds + "T00:00:00");
  d.setDate(d.getDate() + delta);
  return todayKey(d);
}

export default function DailyPage() {
  const { data, update } = useStore();
  const [date, setDate] = useState(() => todayKey());
  if (!data) return <Loading />;

  const daily = data.daily;
  const members = resolveMembers(data, daily.guildId, daily.manualMembers);

  const isDone = (memberKey: string, taskId: string) =>
    Boolean(daily.checks[`${date}|${memberKey}|${taskId}`]);

  function toggle(memberKey: string, taskId: string) {
    update((d) => {
      const k = `${date}|${memberKey}|${taskId}`;
      if (d.daily.checks[k]) delete d.daily.checks[k];
      else d.daily.checks[k] = true;
    });
  }

  const memberDone = (memberKey: string) => daily.tasks.filter((t) => isDone(memberKey, t.id)).length;
  const fullyDone = members.filter((m) => daily.tasks.length > 0 && memberDone(m.key) === daily.tasks.length).length;

  // 누적: 전체 숙제를 완료한 날 수 (기록된 모든 날짜 기준)
  const allDates = Array.from(new Set(Object.keys(daily.checks).map((k) => k.split("|")[0])));
  const cumulativeFullDays = (memberKey: string) => {
    if (daily.tasks.length === 0) return 0;
    return allDates.reduce(
      (c, d) => (daily.tasks.every((t) => daily.checks[`${d}|${memberKey}|${t.id}`]) ? c + 1 : c),
      0,
    );
  };
  const isToday = date === todayKey();

  return (
    <div className="mx-auto max-w-5xl">
      <PageHelp>
        문파원별 <b>일일 숙제 완료</b>를 체크하는 표예요. 칸을 눌러 완료/미완료를 토글하고, 항목명은 자유롭게 추가·수정하세요. 체크는 <b>날짜별로 누적 저장</b>돼서 <b>◀ ▶ 또는 날짜 선택</b>으로 지난 날짜도 볼 수 있어요. 맨 오른쪽 <b>누적</b>은 전체 숙제를 끝낸 날 수예요. (명단은 멤버현황 연동 + 수동 추가)
      </PageHelp>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <GuildSelect guilds={data.guilds} value={daily.guildId} onChange={(id) => update((d) => { d.daily.guildId = id; })} />
        <div className="flex items-center gap-2 text-sm text-white/50">
          <button onClick={() => setDate((ds) => shiftDate(ds, -1))} className="rounded-md border border-white/15 px-2 py-1 text-white/60 hover:text-white" title="전날">◀</button>
          <input
            type="date"
            value={date}
            max={todayKey()}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="rounded-md border border-white/10 bg-black/30 px-2 py-1 text-sm text-white outline-none [color-scheme:dark]"
          />
          <button
            onClick={() => setDate((ds) => shiftDate(ds, 1))}
            disabled={isToday}
            className="rounded-md border border-white/15 px-2 py-1 text-white/60 hover:text-white disabled:opacity-30"
            title="다음날"
          >▶</button>
          {!isToday && (
            <button onClick={() => setDate(todayKey())} className="text-xs text-emerald-300 hover:underline">오늘</button>
          )}
          <span className="ml-1">전원완료 <b className="text-emerald-300">{fullyDone}</b>/{members.length}명</span>
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
              <th className="w-16 border-b border-l border-white/10 py-2 text-center" title="전체 숙제를 끝낸 날 수">누적</th>
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
                        <button onClick={() => { if (confirmDelete("이 인원을 삭제할까요?")) update((d) => { d.daily.manualMembers = d.daily.manualMembers.filter((x) => `m:${x.id}` !== m.key); }); }} className="text-red-300/50 hover:text-red-300" title="삭제">×</button>
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
                          className={`mx-auto flex h-6 w-6 items-center justify-center rounded-md border transition ${checked ? "border-emerald-400/50 bg-emerald-500/30 text-emerald-200" : "border-white/15 bg-white/5 text-transparent hover:border-white/30"}`}
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
                  <td className="border-l border-white/10 py-1.5 text-center text-xs font-bold text-amber-200/90" title="전체 숙제 완료한 날 수">
                    {cumulativeFullDays(m.key)}일
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
