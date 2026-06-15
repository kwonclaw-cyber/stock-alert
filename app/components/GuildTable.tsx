"use client";

import { COLUMN_GROUPS, FLAT_COLUMNS, type Guild, type StatKey } from "@/lib/guilds";
import { CellInput } from "./fields";

type Props = {
  guild: Guild;
  large?: boolean;
  editable?: boolean;
  onCell?: (memberIdx: number, key: StatKey, value: string) => void;
  onPickaxe?: (starIdx: number, value: number) => void;
};

const STAT_COLS = FLAT_COLUMNS.filter((c) => c.key !== "mount");

/**
 * 한 컬럼의 평균을 구한다. 숫자로 해석 가능한 값들만 평균내고,
 * %/+/쉼표 표기는 자동으로 유지한다. 숫자가 없으면(텍스트 컬럼) 빈 값.
 */
function columnAverage(members: Guild["members"], key: StatKey): string {
  let sum = 0;
  let count = 0;
  let percent = false;
  let comma = false;
  let plus = false;
  for (const m of members) {
    const raw = (m[key] ?? "").trim();
    if (!raw) continue;
    if (raw.includes("%")) percent = true;
    if (raw.includes(",")) comma = true;
    if (raw.startsWith("+")) plus = true;
    const num = parseFloat(raw.replace(/[^0-9.\-]/g, ""));
    if (Number.isFinite(num)) {
      sum += num;
      count++;
    }
  }
  if (count === 0) return "";
  const avg = sum / count;
  let s = comma ? Math.round(avg).toLocaleString() : String(Math.round(avg * 10) / 10);
  if (plus && !s.startsWith("-")) s = "+" + s;
  if (percent) s += "%";
  return s;
}

/** 곡괭이 성급별 색상 (1성 → 5성) */
const STAR_COLOR = [
  "text-white/55",
  "text-emerald-300",
  "text-sky-300",
  "text-fuchsia-300",
  "text-amber-300",
];

/**
 * 길드 1개의 내실 현황 표. 깔끔한 다크 테이블 스타일.
 * editable=true 면 stat 셀과 곡괭이 개수를 직접 수정할 수 있다.
 */
export default function GuildTable({ guild, large = false, editable = false, onCell, onPickaxe }: Props) {
  const cellText = large ? "text-sm" : "text-xs";
  const headText = large ? "text-xs" : "text-[11px]";

  function renderCell(memberIdx: number, key: StatKey) {
    const value = guild.members[memberIdx][key];
    if (editable && onCell) {
      return <CellInput value={value} onChange={(v) => onCell(memberIdx, key, v)} />;
    }
    return <span className="text-white/85">{value}</span>;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-[#15171c]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1180px] border-collapse">
          <thead>
            <tr className={`${headText} font-semibold text-white/55`}>
              <th rowSpan={2} className="min-w-[7rem] whitespace-nowrap border-b border-r border-white/10 px-3 py-2 text-left">
                이름
              </th>
              {COLUMN_GROUPS.map((group, gi) => (
                <th
                  key={group.label}
                  colSpan={group.cols.length}
                  className={`border-b border-white/10 bg-white/[0.03] px-2 py-1.5 text-center ${gi > 0 ? "border-l border-white/10" : ""}`}
                >
                  {group.label}
                </th>
              ))}
              <th rowSpan={2} className="border-b border-l border-white/10 px-2 py-2 text-center">
                탈것
              </th>
            </tr>
            <tr className={`${headText} font-medium`}>
              {STAT_COLS.map((col, i) => (
                <th
                  key={col.key}
                  className={`border-b border-white/10 px-1.5 py-1.5 text-center ${col.color ?? "text-white/45"} ${i > 0 ? "border-l border-white/5" : ""} ${col.key === "job" ? "min-w-[6.5rem]" : ""}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {guild.members.map((m, idx) => (
              <tr key={idx} className={`${cellText} border-t border-white/5 transition hover:bg-white/[0.025]`}>
                <th
                  scope="row"
                  className="whitespace-nowrap border-r border-white/10 px-3 py-1 text-left font-medium text-white/80"
                >
                  {idx === 0 ? guild.name : m.name || idx + 1}
                </th>
                {STAT_COLS.map((col, i) => (
                  <td key={col.key} className={`px-0.5 py-0.5 text-center ${i > 0 ? "border-l border-white/5" : ""} ${col.key === "job" ? "min-w-[6.5rem]" : ""}`}>
                    {renderCell(idx, col.key)}
                  </td>
                ))}
                <td className="border-l border-white/5 px-0.5 py-0.5 text-center">{renderCell(idx, "mount")}</td>
              </tr>
            ))}

            {/* 평균 행 (숫자 컬럼 자동 평균) */}
            <tr className={`${cellText} border-t-2 border-white/15 bg-white/[0.04] font-semibold`}>
              <th
                scope="row"
                className="whitespace-nowrap border-r border-white/10 px-3 py-1.5 text-left text-amber-200/90"
              >
                평균
              </th>
              {STAT_COLS.map((col, i) => (
                <td
                  key={col.key}
                  className={`px-0.5 py-1.5 text-center text-emerald-200/90 ${i > 0 ? "border-l border-white/5" : ""}`}
                >
                  {columnAverage(guild.members, col.key)}
                </td>
              ))}
              <td className="border-l border-white/5 px-0.5 py-1.5 text-center text-emerald-200/90">
                {columnAverage(guild.members, "mount")}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 곡괭이 1성~5성 개수 */}
      <div className="flex flex-wrap items-center gap-2 border-t border-white/10 bg-white/[0.02] px-3 py-2.5">
        <span className="mr-1 text-xs font-semibold text-amber-300/90">⛏ 곡괭이</span>
        {guild.pickaxes.map((count, star) => (
          <div
            key={star}
            className="flex items-center gap-1 rounded-lg border border-white/10 bg-black/20 px-1.5 py-1"
          >
            <span className={`text-xs font-semibold ${STAR_COLOR[star]}`}>{star + 1}★</span>
            {editable && onPickaxe ? (
              <Stepper value={count} onChange={(v) => onPickaxe(star, v)} />
            ) : (
              <span className="w-5 text-center text-sm font-bold text-white">{count}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Stepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-0.5">
      <button
        onClick={() => onChange(Math.max(0, value - 1))}
        className="flex h-5 w-5 items-center justify-center rounded text-white/50 hover:bg-white/10 hover:text-white"
      >
        −
      </button>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        className="w-8 bg-transparent text-center text-sm font-bold text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
      />
      <button
        onClick={() => onChange(value + 1)}
        className="flex h-5 w-5 items-center justify-center rounded text-white/50 hover:bg-white/10 hover:text-white"
      >
        +
      </button>
    </div>
  );
}
