"use client";

import { useStore } from "../../components/StoreProvider";
import { CellInput, Btn } from "../../components/fields";
import Loading from "../../components/Loading";
import { uid } from "@/lib/data";
import type { HiddenRow } from "@/lib/data";

const STATUS: HiddenRow["status"][] = ["후보", "유력", "제외", "확정"];
const STATUS_COLOR: Record<HiddenRow["status"], string> = {
  후보: "bg-white/10 text-white/70",
  유력: "bg-amber-500/20 text-amber-300",
  제외: "bg-red-500/15 text-red-300 line-through",
  확정: "bg-emerald-500/20 text-emerald-300",
};

export default function HiddenPage() {
  const { data, update } = useStore();
  if (!data) return <Loading />;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-white/50">
          히든 추리 정리용 보드입니다. 대상·단서·상태·메모를 자유롭게 기록하세요.
        </p>
        <Btn
          variant="primary"
          onClick={() =>
            update((d) => {
              d.hidden.push({ id: uid(), target: "", clue: "", status: "후보", memo: "" });
            })
          }
        >
          + 행 추가
        </Btn>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#1a1d24]">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-xs text-white/60">
              <th className="w-40 border border-white/10 bg-[#2b2f38] px-2 py-2">대상</th>
              <th className="border border-white/10 bg-[#2b2f38] px-2 py-2">단서</th>
              <th className="w-28 border border-white/10 bg-[#2b2f38] px-2 py-2">상태</th>
              <th className="border border-white/10 bg-[#2b2f38] px-2 py-2">메모</th>
              <th className="w-10 border border-white/10 bg-[#2b2f38] px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {data.hidden.map((row, ri) => (
              <tr key={row.id}>
                <td className="border border-white/10 bg-white px-1 py-0.5">
                  <CellInput
                    value={row.target}
                    onChange={(v) => update((d) => { d.hidden[ri].target = v; })}
                    className="!text-left px-1"
                  />
                </td>
                <td className="border border-white/10 bg-white px-1 py-0.5">
                  <CellInput
                    value={row.clue}
                    onChange={(v) => update((d) => { d.hidden[ri].clue = v; })}
                    className="!text-left px-1"
                  />
                </td>
                <td className="border border-white/10 bg-[#23262e] px-1 py-0.5 text-center">
                  <select
                    value={row.status}
                    onChange={(e) => update((d) => { d.hidden[ri].status = e.target.value as HiddenRow["status"]; })}
                    className={`w-full rounded px-2 py-1 text-xs font-medium outline-none ${STATUS_COLOR[row.status]}`}
                  >
                    {STATUS.map((s) => (
                      <option key={s} value={s} className="bg-[#23262e] text-white">
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="border border-white/10 bg-white px-1 py-0.5">
                  <CellInput
                    value={row.memo}
                    onChange={(v) => update((d) => { d.hidden[ri].memo = v; })}
                    className="!text-left px-1"
                  />
                </td>
                <td className="border border-white/10 bg-[#23262e] text-center">
                  <button
                    onClick={() => update((d) => { d.hidden.splice(ri, 1); })}
                    className="px-1 text-red-300/70 hover:text-red-300"
                    title="삭제"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
            {data.hidden.length === 0 && (
              <tr>
                <td colSpan={5} className="bg-[#1a1d24] py-10 text-center text-sm text-white/30">
                  비어 있습니다. “행 추가”를 눌러주세요.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
