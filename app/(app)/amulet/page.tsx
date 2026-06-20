"use client";

import { useRef, useState } from "react";
import { useStore } from "../../components/StoreProvider";
import { TextInput, TextArea, CellInput, Btn } from "../../components/fields";
import Loading from "../../components/Loading";
import PageHelp from "../../components/PageHelp";
import { fileToDataUrl } from "../../components/imageUtil";
import { uid } from "@/lib/data";
import { confirmDelete } from "@/lib/confirmDelete";

const won = (n: number) => (Number.isFinite(n) ? Math.round(n).toLocaleString() : "-");

export default function AmuletPage() {
  const { data, update } = useStore();
  const [zoom, setZoom] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  if (!data) return <Loading />;

  const a = data.amulet;
  const N = a.combineCount || 10;
  const price = a.pullCostNormal || 0;
  const q = Math.max(1, qty);

  // 등급별: 일반 → 고급(N개) → 희귀(N²개)
  const tiers = [
    { grade: "고급", per: N, color: "text-sky-300" },
    { grade: "희귀", per: N * N, color: "text-fuchsia-300" },
  ];

  async function addImage(files: FileList | File[]) {
    const f = Array.from(files).find((x) => x.type.startsWith("image/"));
    if (!f) return;
    const url = await fileToDataUrl(f, 1600);
    update((d) => { d.amulet.images.push({ id: uid(), title: "", image: url, memo: "" }); });
  }
  async function setCardImage(id: string, files: FileList | File[]) {
    const f = Array.from(files).find((x) => x.type.startsWith("image/"));
    if (!f) return;
    const url = await fileToDataUrl(f, 1600);
    update((d) => { const c = d.amulet.images.find((x) => x.id === id); if (c) c.image = url; });
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHelp>
        <b>부적 시스템</b> 정보와 <b>계산기</b>예요. 아래 <b>계산기</b>에서 조합 개수·뽑기 가격을 맞추면 등급별로 필요한 <b>일반 부적 수·비용(전)</b>이 계산돼요. 옵션 효과표와 수치는 칸을 눌러 직접 수정할 수 있고, 참고 이미지도 붙여넣을 수 있어요. (모두에게 공유됨)
      </PageHelp>

      {/* 계산기 */}
      <section className="mb-6 rounded-xl border border-white/10 bg-[#15171c] p-4">
        <h2 className="mb-3 text-base font-bold text-emerald-300">🧮 부적 계산기</h2>

        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Param label="조합 개수 (→상위 1개)" value={a.combineCount} onChange={(v) => update((d) => { d.amulet.combineCount = Number(v) || 0; })} />
          <Param label="일반 뽑기 가격(전)" value={a.pullCostNormal} onChange={(v) => update((d) => { d.amulet.pullCostNormal = Number(v) || 0; })} />
          <Param label="리롤 비용(티켓)" value={a.rerollCostTicket} onChange={(v) => update((d) => { d.amulet.rerollCostTicket = Number(v) || 0; })} />
          <Param label="희귀 뽑기(티켓)" value={a.pullCostRareTicket} onChange={(v) => update((d) => { d.amulet.pullCostRareTicket = Number(v) || 0; })} />
        </div>

        <div className="mb-3 flex items-center gap-2 text-sm">
          <span className="text-white/60">목표 개수</span>
          <input
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
            className="w-24 rounded-md border border-white/10 bg-black/30 px-2.5 py-1.5 text-center text-white outline-none focus:border-emerald-400/60"
          />
          <span className="text-white/40">개 만들기</span>
        </div>

        <div className="overflow-hidden rounded-lg border border-white/10">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-white/[0.04] text-xs text-white/55">
                <th className="px-3 py-2 text-left">목표 등급</th>
                <th className="px-3 py-2 text-right">필요 일반 부적</th>
                <th className="px-3 py-2 text-right">비용 (전)</th>
              </tr>
            </thead>
            <tbody>
              {tiers.map((t) => {
                const need = t.per * q;
                return (
                  <tr key={t.grade} className="border-t border-white/5">
                    <td className={`px-3 py-2 font-bold ${t.color}`}>{t.grade} 부적 × {q}</td>
                    <td className="px-3 py-2 text-right font-mono text-white/85">{won(need)}개</td>
                    <td className="px-3 py-2 text-right font-mono text-amber-200/90">{won(need * price)}전</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-white/40">
          ※ 같은 등급 {N}개를 조합하면 상위 등급 1개가 돼요. (고급 = 일반 {N}개 · 희귀 = 일반 {won(N * N)}개) 일반 부적만으로 올린 기준이에요.
        </p>
      </section>

      {/* 옵션 효과표 */}
      <div className="mb-6 grid grid-cols-1 gap-5 md:grid-cols-2">
        <OptionTable
          title="고급 부적 옵션"
          accent="text-sky-300"
          rows={a.advanced}
          onCell={(i, key, v) => update((d) => { d.amulet.advanced[i][key] = v; })}
          onAdd={() => update((d) => { d.amulet.advanced.push({ id: uid(), name: "", effect: "" }); })}
          onRemove={(i) => { if (confirmDelete("이 행을 삭제할까요?")) update((d) => { d.amulet.advanced.splice(i, 1); }); }}
        />
        <OptionTable
          title="희귀 부적 옵션"
          accent="text-fuchsia-300"
          rows={a.rare}
          onCell={(i, key, v) => update((d) => { d.amulet.rare[i][key] = v; })}
          onAdd={() => update((d) => { d.amulet.rare.push({ id: uid(), name: "", effect: "" }); })}
          onRemove={(i) => { if (confirmDelete("이 행을 삭제할까요?")) update((d) => { d.amulet.rare.splice(i, 1); }); }}
        />
      </div>

      {/* 참고 이미지 */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-bold text-white/80">🖼️ 참고 이미지</h2>
        <Btn variant="primary" onClick={() => update((d) => { d.amulet.images.push({ id: uid(), title: "", image: "", memo: "" }); })}>
          + 카드 생성
        </Btn>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {a.images.map((card) => {
          const ci = a.images.findIndex((x) => x.id === card.id);
          return (
            <div key={card.id} className="overflow-hidden rounded-xl border border-white/10 bg-[#15171c]">
              <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
                <TextInput
                  value={card.title}
                  onChange={(v) => update((d) => { d.amulet.images[ci].title = v; })}
                  placeholder="제목 (예: 부적 조합/리롤 안내)"
                  className="!text-left flex-1 font-semibold"
                />
                <button onClick={() => { if (confirmDelete("이 카드를 삭제할까요?")) update((d) => { d.amulet.images.splice(ci, 1); }); }} className="text-red-300/60 hover:text-red-300" title="카드 삭제">삭제</button>
              </div>
              <CardImage image={card.image} onFiles={(f) => setCardImage(card.id, f)} onZoom={() => card.image && setZoom(card.image)} onRemove={() => { if (confirmDelete("이미지를 삭제할까요?")) update((d) => { d.amulet.images[ci].image = ""; }); }} />
              <div className="px-3 py-2">
                <TextArea
                  value={card.memo}
                  onChange={(v) => update((d) => { d.amulet.images[ci].memo = v; })}
                  placeholder="메모"
                  rows={2}
                />
              </div>
            </div>
          );
        })}
      </div>

      {a.images.length === 0 && (
        <p
          tabIndex={0}
          onPaste={(e) => { if (e.clipboardData.files.length) { e.preventDefault(); addImage(e.clipboardData.files); } }}
          className="mt-2 rounded-lg border border-dashed border-white/15 py-12 text-center text-sm text-white/30 outline-none focus:border-emerald-400/50"
        >
          참고 이미지가 없습니다. “카드 생성” 후 <b className="text-white/50">Ctrl+V</b>로 캡처를 붙여넣어 보세요.
        </p>
      )}

      {zoom && (
        <div onClick={() => setZoom(null)} className="fixed inset-0 z-50 overflow-auto bg-black/90 p-6">
          <button onClick={() => setZoom(null)} className="fixed right-4 top-4 z-10 rounded bg-black/60 px-3 py-1.5 text-sm text-white hover:bg-black/80">닫기 ✕</button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt="" onClick={(e) => e.stopPropagation()} className="mx-auto rounded-lg" />
        </div>
      )}
    </div>
  );
}

function Param({ label, value, onChange }: { label: string; value: number; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-white/45">
      {label}
      <TextInput type="number" value={value} onChange={onChange} className="w-full !py-1.5 text-center" />
    </label>
  );
}

function OptionTable({
  title, accent, rows, onCell, onAdd, onRemove,
}: {
  title: string;
  accent: string;
  rows: { id: string; name: string; effect: string }[];
  onCell: (i: number, key: "name" | "effect", v: string) => void;
  onAdd: () => void;
  onRemove: (i: number) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-[#15171c]">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <h3 className={`text-sm font-bold ${accent}`}>{title}</h3>
        <button onClick={onAdd} className="rounded-md border border-white/15 px-2 py-1 text-xs text-white/55 hover:text-white">+ 행 추가</button>
      </div>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-[11px] text-white/45">
            <th className="border-b border-white/10 px-2 py-1.5 text-left">부적명</th>
            <th className="border-b border-white/10 px-2 py-1.5 text-left">옵션(효과)</th>
            <th className="w-8 border-b border-white/10"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id} className="border-t border-white/5 hover:bg-white/[0.025]">
              <td className="px-1 py-0.5 align-middle">
                <CellInput value={r.name} className="!text-left" onChange={(v) => onCell(i, "name", v)} />
              </td>
              <td className="px-1 py-0.5 align-middle">
                <CellInput value={r.effect} className="!text-left" onChange={(v) => onCell(i, "effect", v)} />
              </td>
              <td className="text-center">
                <button onClick={() => { if (confirmDelete("이 사진을 삭제할까요?")) onRemove(i); }} className="px-1 text-red-300/50 hover:text-red-300" title="삭제">×</button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={3} className="py-6 text-center text-xs text-white/30">행이 없습니다. “+ 행 추가”</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function CardImage({
  image, onFiles, onZoom, onRemove,
}: {
  image: string;
  onFiles: (files: FileList | File[]) => void;
  onZoom: () => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);

  return (
    <div
      tabIndex={0}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPaste={(e) => { if (e.clipboardData.files.length) { e.preventDefault(); onFiles(e.clipboardData.files); } }}
      onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files); }}
      onDragOver={(e) => e.preventDefault()}
      className={`relative aspect-[3/2] w-full bg-black/30 outline-none ${focused ? "ring-2 ring-inset ring-emerald-400/60" : ""}`}
    >
      {image ? (
        <div className="group h-full w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="" onClick={onZoom} className="h-full w-full cursor-zoom-in object-contain" />
          <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition group-hover:opacity-100">
            <button onClick={onZoom} className="rounded bg-black/60 px-2 py-1 text-xs text-white hover:bg-black/80">크게</button>
            <button onClick={() => inputRef.current?.click()} className="rounded bg-black/60 px-2 py-1 text-xs text-white hover:bg-black/80">교체</button>
            <button onClick={onRemove} className="rounded bg-red-500/80 px-2 py-1 text-xs text-white hover:bg-red-500">삭제</button>
          </div>
        </div>
      ) : (
        <button onClick={() => inputRef.current?.click()} className="flex h-full w-full flex-col items-center justify-center gap-1 text-center text-xs text-white/40">
          <span className="text-2xl">🖼️</span>
          <span>여기를 클릭 후 <b className="text-white/60">Ctrl+V</b>로 캡처 붙여넣기</span>
          <span>드래그&드롭 · 클릭해서 파일 선택</span>
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files && onFiles(e.target.files)} />
    </div>
  );
}
