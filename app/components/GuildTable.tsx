"use client";

import { COLUMN_GROUPS, FLAT_COLUMNS, type Guild, type StatKey } from "@/lib/guilds";
import { CellInput } from "./fields";

type Props = {
  guild: Guild;
  large?: boolean;
  editable?: boolean;
  onCell?: (memberIdx: number, key: StatKey, value: string) => void;
  onPickaxe?: (value: number) => void;
};

const STAT_COLS = FLAT_COLUMNS.filter((c) => c.key !== "mount");

/**
 * 길드 1개의 내실 현황 표. (스프레드시트 레이아웃 재현)
 * editable=true 면 stat 셀과 5성곡괭이를 직접 수정할 수 있다.
 * (멤버 이름/직업 일부는 '길드별 멤버현황' 탭에서 관리)
 */
export default function GuildTable({ guild, large = false, editable = false, onCell, onPickaxe }: Props) {
  const cellText = large ? "text-sm" : "text-[11px]";
  const headText = large ? "text-xs" : "text-[10px]";

  function renderCell(memberIdx: number, key: StatKey) {
    const value = guild.members[memberIdx][key];
    if (editable && onCell) {
      return <CellInput value={value} onChange={(v) => onCell(memberIdx, key, v)} />;
    }
    return value;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#1a1d24]">
      <table className="w-full border-collapse">
        <thead>
          <tr className={`${headText} font-semibold text-white/80`}>
            <th rowSpan={2} className="w-16 border border-white/10 bg-[#3a3f4b] px-2 py-1.5 text-center">
              로고
            </th>
            {COLUMN_GROUPS.map((group) => (
              <th
                key={group.label}
                colSpan={group.cols.length}
                className="border border-white/10 bg-[#3a3f4b] px-2 py-1.5 text-center"
              >
                {group.label}
              </th>
            ))}
            <th rowSpan={2} className="border border-white/10 bg-[#3a3f4b] px-2 py-1.5 text-center">
              탈것
            </th>
          </tr>
          <tr className={`${headText} font-semibold`}>
            {STAT_COLS.map((col) => (
              <th
                key={col.key}
                className={`border border-white/10 bg-[#2b2f38] px-1.5 py-1.5 text-center ${col.color ?? "text-white/70"}`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {guild.members.map((m, idx) => (
            <tr key={idx} className={cellText}>
              <th
                scope="row"
                className="border border-white/10 bg-[#2b2f38] px-2 py-1 text-center font-medium text-white/90"
              >
                {idx === 0 ? guild.name : m.name || idx + 1}
              </th>
              {STAT_COLS.map((col) => (
                <td key={col.key} className="border border-white/10 bg-white px-1 py-0.5 text-center text-gray-800">
                  {renderCell(idx, col.key)}
                </td>
              ))}
              <td className="border border-white/10 bg-white px-1 py-0.5 text-center text-gray-800">
                {renderCell(idx, "mount")}
              </td>
            </tr>
          ))}

          <tr className={`${cellText} font-semibold text-white/80`}>
            <th className="border border-white/10 bg-[#3a3f4b] px-2 py-1.5 text-center">평균</th>
            <td colSpan={STAT_COLS.length - 2} className="border border-white/10 bg-[#3a3f4b] px-2 py-1.5" />
            <td colSpan={2} className="border border-white/10 bg-[#3a3f4b] px-2 py-1.5 text-right text-amber-300">
              5성곡괭이
            </td>
            <td className="border border-white/10 bg-white px-1 py-0.5 text-center font-bold text-gray-800">
              {editable && onPickaxe ? (
                <CellInput
                  type="number"
                  value={guild.pickaxe5}
                  onChange={(v) => onPickaxe(Number(v) || 0)}
                />
              ) : (
                guild.pickaxe5
              )}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
