"use client";

import { useEffect, useState } from "react";
import { TextInput, CellInput, Btn } from "../../components/fields";
import PageHelp from "../../components/PageHelp";
import { uid } from "@/lib/data";
import { confirmDelete } from "@/lib/confirmDelete";

/**
 * 세팅 계산기 — 회피율·공격속도(최대 40 적용) + 내공 합산기.
 * 빌드는 사람마다 다르므로 공유하지 않고 개인 브라우저(localStorage)에만 저장한다.
 */

const CAP = 40; // 회피율·공격속도 상한
const STORE_KEY = "setting-calc-v1";

type Row = { id: string; name: string; eva: number; spd: number; nae: number };

function defaultRows(): Row[] {
  return [
    { id: "head", name: "잠재 - 머리", eva: 0, spd: 0, nae: 0 },
    { id: "body", name: "잠재 - 갑옷", eva: 0, spd: 0, nae: 0 },
    { id: "belt", name: "잠재 - 벨트", eva: 0, spd: 0, nae: 0 },
    { id: "shoes", name: "잠재 - 신발", eva: 0, spd: 0, nae: 0 },
    { id: "scroll", name: "주문서", eva: 0, spd: 0, nae: 0 },
    { id: "amulet", name: "부적", eva: 0, spd: 0, nae: 0 },
    { id: "refine", name: "재련", eva: 0, spd: 0, nae: 0 },
    { id: "ring", name: "반지 강화", eva: 0, spd: 0, nae: 0 },
    { id: "elixir", name: "영단", eva: 0, spd: 0, nae: 0 },
  ];
}

export default function SettingCalcPage() {
  const [rows, setRows] = useState<Row[]>(defaultRows);
  const [naeTarget, setNaeTarget] = useState(0);
  const [loaded, setLoaded] = useState(false);

  // 개인 저장 불러오기 (클라이언트에서만 → 하이드레이션 충돌 방지)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const v = JSON.parse(raw) as { rows?: Row[]; naeTarget?: number };
        if (Array.isArray(v.rows) && v.rows.length) setRows(v.rows);
        if (typeof v.naeTarget === "number") setNaeTarget(v.naeTarget);
      }
    } catch { /* 무시 */ }
    setLoaded(true);
  }, []);

  // 변경 시 저장
  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ rows, naeTarget })); } catch { /* 무시 */ }
  }, [rows, naeTarget, loaded]);

  const setCell = (i: number, key: keyof Row, v: string) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, [key]: key === "name" ? v : Number(v) || 0 } : r)));
  const addRow = () => setRows((rs) => [...rs, { id: uid(), name: "", eva: 0, spd: 0, nae: 0 }]);
  const removeRow = (i: number) => { if (confirmDelete("이 행을 삭제할까요?")) setRows((rs) => rs.filter((_, idx) => idx !== i)); };
  const resetAll = () => { if (confirmDelete("입력값을 모두 초기화할까요?")) { setRows(defaultRows()); setNaeTarget(0); } };

  const evaSum = rows.reduce((s, r) => s + (r.eva || 0), 0);
  const spdSum = rows.reduce((s, r) => s + (r.spd || 0), 0);
  const naeSum = rows.reduce((s, r) => s + (r.nae || 0), 0);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHelp>
        <b>세팅 계산기</b>예요. <b>회피율·공격속도는 최대 {CAP}까지만 적용</b>되니, 슬롯별 잠재·주문서·부적 등에서 얻는 수치를 적으면 <b>총합과 {CAP}캡 초과/부족</b>을 알려줘요. 내공도 합산해서 목표치와 비교할 수 있어요. (이 값은 <b className="text-white/70">내 브라우저에만 저장</b>되고 공유되지 않아요.)
      </PageHelp>

      {/* 결과 카드 */}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <CapCard label="회피율" total={evaSum} />
        <CapCard label="공격속도" total={spdSum} />
        <NaeCard total={naeSum} target={naeTarget} onTarget={setNaeTarget} />
      </div>

      {/* 입력 표 */}
      <div className="overflow-hidden rounded-xl border border-white/10 bg-[#15171c]">
        <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
          <h2 className="text-sm font-bold text-emerald-300">🧮 출처별 수치 입력</h2>
          <div className="flex items-center gap-2">
            <button onClick={addRow} className="rounded-md border border-white/15 px-2 py-1 text-xs text-white/55 hover:text-white">+ 행 추가</button>
            <button onClick={resetAll} className="rounded-md border border-white/15 px-2 py-1 text-xs text-white/45 hover:text-white" title="기본값으로 초기화">↩︎ 초기화</button>
          </div>
        </div>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-white/[0.04] text-[11px] text-white/50">
              <th className="px-2 py-2 text-left">출처</th>
              <th className="w-20 px-1 py-2 text-center">회피율</th>
              <th className="w-20 px-1 py-2 text-center">공격속도</th>
              <th className="w-20 px-1 py-2 text-center">내공</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className="border-t border-white/5 hover:bg-white/[0.025]">
                <td className="px-1 py-0.5"><CellInput value={r.name} className="!text-left" onChange={(v) => setCell(i, "name", v)} /></td>
                <td className="px-1 py-0.5"><CellInput type="number" value={r.eva || ""} onChange={(v) => setCell(i, "eva", v)} /></td>
                <td className="px-1 py-0.5"><CellInput type="number" value={r.spd || ""} onChange={(v) => setCell(i, "spd", v)} /></td>
                <td className="px-1 py-0.5"><CellInput type="number" value={r.nae || ""} onChange={(v) => setCell(i, "nae", v)} /></td>
                <td className="text-center"><button onClick={() => removeRow(i)} className="px-1 text-red-300/50 hover:text-red-300" title="삭제">×</button></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-white/10 bg-white/[0.03] font-bold">
              <td className="px-2 py-2 text-right text-white/60">합계</td>
              <td className={`px-1 py-2 text-center font-mono ${evaSum > CAP ? "text-rose-300" : "text-white/90"}`}>{evaSum}</td>
              <td className={`px-1 py-2 text-center font-mono ${spdSum > CAP ? "text-rose-300" : "text-white/90"}`}>{spdSum}</td>
              <td className="px-1 py-2 text-center font-mono text-white/90">{naeSum}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-white/40">
        ※ <b className="text-white/55">회피율·공격속도</b>는 합이 {CAP}을 넘어도 {CAP}까지만 적용돼요(초과분 낭비). 신발 주문서·잠재로 딱 맞추는 게 효율적.<br />
        ※ <b className="text-white/55">내공</b>은 PVE에서 몬스터 요구치보다 5 이상 낮으면 피해가 안 들어가요. 목표 내공을 적어두면 부족분을 알려줘요.
      </p>
    </div>
  );
}

function CapCard({ label, total }: { label: string; total: number }) {
  const over = total - CAP;
  let tone = "border-amber-400/30 bg-amber-400/5", badge = "text-amber-300", msg = `${CAP}까지 ${CAP - total} 부족`;
  if (total === CAP) { tone = "border-emerald-400/40 bg-emerald-400/10"; badge = "text-emerald-300"; msg = `딱 ${CAP} 달성 👍`; }
  else if (total > CAP) { tone = "border-rose-400/40 bg-rose-400/10"; badge = "text-rose-300"; msg = `${over} 낭비 (${CAP}캡 초과)`; }
  return (
    <div className={`rounded-xl border p-4 ${tone}`}>
      <div className="text-xs text-white/55">{label} <span className="text-white/35">(최대 {CAP})</span></div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className={`text-3xl font-bold ${badge}`}>{Math.min(total, CAP)}</span>
        <span className="text-sm text-white/40">/ {total}</span>
      </div>
      <div className={`mt-1 text-xs font-semibold ${badge}`}>{msg}</div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full ${total >= CAP ? "bg-emerald-400" : "bg-amber-400"}`} style={{ width: `${Math.min(100, (total / CAP) * 100)}%` }} />
      </div>
    </div>
  );
}

function NaeCard({ total, target, onTarget }: { total: number; target: number; onTarget: (v: number) => void }) {
  const short = target - total;
  return (
    <div className="rounded-xl border border-sky-400/30 bg-sky-400/5 p-4">
      <div className="text-xs text-white/55">내공 합계</div>
      <div className="mt-1 text-3xl font-bold text-sky-300">{total}</div>
      <label className="mt-2 flex items-center gap-1.5 text-xs text-white/45">
        목표
        <TextInput type="number" value={target || ""} onChange={(v) => onTarget(Number(v) || 0)} className="w-20 !py-1 text-center" />
      </label>
      {target > 0 && (
        <div className={`mt-1 text-xs font-semibold ${short > 0 ? "text-rose-300" : "text-emerald-300"}`}>
          {short > 0 ? `${short} 부족` : `목표 달성 (+${-short})`}
        </div>
      )}
    </div>
  );
}
