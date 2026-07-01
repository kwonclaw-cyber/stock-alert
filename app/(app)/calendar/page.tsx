"use client";

import { useState } from "react";
import { useStore } from "../../components/StoreProvider";
import { TextInput, Btn } from "../../components/fields";
import Loading from "../../components/Loading";
import PageHelp from "../../components/PageHelp";
import { confirmDelete } from "@/lib/confirmDelete";
import { todayKey, uid } from "@/lib/data";

const COLORS: { key: string; label: string; dot: string; chip: string }[] = [
  { key: "emerald", label: "초록", dot: "bg-emerald-400", chip: "bg-emerald-500/25 text-emerald-200 border-emerald-400/30" },
  { key: "sky", label: "파랑", dot: "bg-sky-400", chip: "bg-sky-500/25 text-sky-200 border-sky-400/30" },
  { key: "amber", label: "노랑", dot: "bg-amber-400", chip: "bg-amber-500/25 text-amber-200 border-amber-400/30" },
  { key: "fuchsia", label: "보라", dot: "bg-fuchsia-400", chip: "bg-fuchsia-500/25 text-fuchsia-200 border-fuchsia-400/30" },
  { key: "red", label: "빨강", dot: "bg-red-400", chip: "bg-red-500/25 text-red-200 border-red-400/30" },
];
const chipOf = (c: string) => COLORS.find((x) => x.key === c) ?? COLORS[0];
const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

export default function CalendarPage() {
  const { data, update } = useStore();
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() }); // m: 0-11
  const [form, setForm] = useState({ date: todayKey(), time: "", title: "", color: "emerald" });
  if (!data) return <Loading />;

  const events = data.events;
  const first = new Date(ym.y, ym.m, 1);
  const startBlank = first.getDay();
  const daysInMonth = new Date(ym.y, ym.m + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(startBlank).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const dkey = (d: number) => `${ym.y}-${String(ym.m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const eventsOn = (d: number) => events.filter((e) => e.date === dkey(d));
  const monthLabel = `${ym.y}년 ${ym.m + 1}월`;
  const todayStr = todayKey();

  function shiftMonth(delta: number) {
    setYm(({ y, m }) => {
      const d = new Date(y, m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  }
  function addEvent() {
    if (!form.title.trim() || !form.date) return;
    update((d) => {
      d.events.push({ id: uid(), title: form.title.trim(), date: form.date, time: form.time, memo: "", color: form.color });
    });
    setForm((f) => ({ ...f, title: "", time: "" }));
  }

  const monthEvents = events
    .filter((e) => e.date.startsWith(`${ym.y}-${String(ym.m + 1).padStart(2, "0")}`))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  return (
    <div className="mx-auto max-w-5xl">
      <PageHelp>
        문파 <b>일정/이벤트</b>를 공유하는 캘린더예요. 날짜 칸을 누르면 그 날짜로 입력되고, 아래에서 제목·시간·색을 넣어 추가하세요. 모두에게 실시간 공유됩니다.
      </PageHelp>

      <div className="mb-3 flex items-center justify-center gap-4">
        <button onClick={() => shiftMonth(-1)} className="rounded-md border border-white/15 px-3 py-1 text-white/70 hover:text-white">◀</button>
        <span className="text-lg font-bold">{monthLabel}</span>
        <button onClick={() => shiftMonth(1)} className="rounded-md border border-white/15 px-3 py-1 text-white/70 hover:text-white">▶</button>
        <button onClick={() => { setYm({ y: now.getFullYear(), m: now.getMonth() }); }} className="text-xs text-emerald-300 hover:underline">오늘</button>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/10 bg-[#15171c]">
        <div className="grid grid-cols-7 border-b border-white/10 text-center text-xs text-white/45">
          {WEEK.map((w, i) => (
            <div key={w} className={`py-1.5 ${i === 0 ? "text-red-300/70" : i === 6 ? "text-sky-300/70" : ""}`}>{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((d, i) => {
            const isToday = d != null && dkey(d) === todayStr;
            const selected = d != null && dkey(d) === form.date;
            return (
              <button
                key={i}
                disabled={d == null}
                onClick={() => d != null && setForm((f) => ({ ...f, date: dkey(d) }))}
                className={`min-h-20 border-b border-r border-white/5 p-1 text-left align-top transition ${d == null ? "bg-black/20" : "hover:bg-white/[0.03]"} ${selected ? "ring-1 ring-inset ring-emerald-400/60" : ""}`}
              >
                {d != null && (
                  <>
                    <div className={`text-xs ${isToday ? "font-bold text-emerald-300" : i % 7 === 0 ? "text-red-300/70" : "text-white/55"}`}>
                      {d}{isToday && " ·오늘"}
                    </div>
                    <div className="mt-0.5 space-y-0.5">
                      {eventsOn(d).slice(0, 3).map((e) => (
                        <div key={e.id} className={`truncate rounded border px-1 text-[10px] ${chipOf(e.color).chip}`}>
                          {e.time && <span className="opacity-70">{e.time} </span>}{e.title}
                        </div>
                      ))}
                      {eventsOn(d).length > 3 && <div className="text-[10px] text-white/35">+{eventsOn(d).length - 3}</div>}
                    </div>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 추가 폼 */}
      <div className="mt-4 flex flex-wrap items-end gap-2 rounded-xl border border-white/10 bg-[#15171c] p-3">
        <label className="flex flex-col gap-1 text-xs text-white/45">날짜
          <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className="rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white outline-none [color-scheme:dark]" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-white/45">시간
          <input type="time" value={form.time} onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))} className="rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white outline-none [color-scheme:dark]" />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-xs text-white/45">제목
          <TextInput value={form.title} onChange={(v) => setForm((f) => ({ ...f, title: v }))} placeholder="이벤트 제목" className="!text-left" />
        </label>
        <div className="flex gap-1">
          {COLORS.map((c) => (
            <button key={c.key} onClick={() => setForm((f) => ({ ...f, color: c.key }))} title={c.label}
              className={`h-6 w-6 rounded-full ${c.dot} ${form.color === c.key ? "ring-2 ring-white/70" : "opacity-60"}`} />
          ))}
        </div>
        <Btn variant="primary" onClick={addEvent}>+ 일정 추가</Btn>
      </div>

      {/* 이 달 일정 목록 */}
      <div className="mt-4">
        <div className="mb-2 text-sm font-semibold text-white/70">{monthLabel} 일정 ({monthEvents.length})</div>
        <div className="space-y-1.5">
          {monthEvents.map((e) => {
            const ei = events.findIndex((x) => x.id === e.id);
            return (
              <div key={e.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-[#15171c] px-3 py-2">
                <span className={`h-2.5 w-2.5 rounded-full ${chipOf(e.color).dot}`} />
                <span className="w-24 text-xs text-white/50">{e.date.slice(5)} {e.time}</span>
                <TextInput value={e.title} onChange={(v) => update((d) => { d.events[ei].title = v; })} className="!text-left flex-1 font-medium" />
                <TextInput value={e.memo} onChange={(v) => update((d) => { d.events[ei].memo = v; })} placeholder="메모" className="!text-left w-40" />
                <button onClick={() => { if (confirmDelete("이 일정을 삭제할까요?")) update((d) => { d.events.splice(ei, 1); }); }} className="text-red-300/50 hover:text-red-300" title="삭제">×</button>
              </div>
            );
          })}
          {monthEvents.length === 0 && <p className="py-6 text-center text-sm text-white/30">이 달 일정이 없습니다.</p>}
        </div>
      </div>
    </div>
  );
}
