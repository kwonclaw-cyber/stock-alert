"use client";

import { useRef, useState } from "react";
import { useStore } from "../../components/StoreProvider";
import Board from "../../components/Board";
import Loading from "../../components/Loading";
import PageHelp from "../../components/PageHelp";
import { TextInput, TextArea, Btn } from "../../components/fields";
import { fileToDataUrl } from "../../components/imageUtil";
import { uid } from "@/lib/data";
import { confirmDelete } from "@/lib/confirmDelete";

export default function DwellingPage() {
  const { data, update } = useStore();
  const [zoom, setZoom] = useState<string | null>(null);
  if (!data) return <Loading />;

  const list = data.youngdan;

  async function setIcon(id: string, files: FileList | File[]) {
    const f = Array.from(files).find((x) => x.type.startsWith("image/"));
    if (!f) return;
    const url = await fileToDataUrl(f, 256);
    update((d) => { const y = d.youngdan.find((x) => x.id === id); if (y) y.icon = url; });
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHelp>
        <b>영단</b>(추가 내실) 효과·획득처예요. <b>효과·획득처는 칸을 눌러 직접 수정</b>할 수 있고(획득처는 추후 변경될 수 있어요), 아이콘은 <b>이미지 자리에 Ctrl+V</b>로 영단 캡쳐를 넣으면 동그라미 대신 표시돼요. (모두에게 공유)
      </PageHelp>

      {/* 영단 핵심 정보 */}
      <section className="mb-5 rounded-xl border border-emerald-400/25 bg-emerald-400/[0.04] p-4">
        <h2 className="mb-2 text-base font-bold text-emerald-300">📌 영단이란? (추가 내실)</h2>
        <ul className="space-y-1 text-sm text-white/80">
          <li>• 기존 코창의 <b className="text-white">‘무인의 거처’ 삭제 후 영단 시스템 추가</b> — 추가 내실(능력치)을 올리는 수단.</li>
          <li>• 획득: <b className="text-white">레이드 · 사냥 · 제작 · 탐험 · 퀘스트</b> 등. <b className="text-white">테크 선택</b> 가능, 각 영단 <b className="text-white">0~10레벨</b>.</li>
        </ul>
      </section>

      {/* 영단 효과·획득처 (수정 가능) */}
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-base font-bold text-white/80">🧩 영단 효과 &amp; 획득처 <span className="text-xs font-normal text-white/40">({list.length}종)</span></h2>
        <Btn variant="primary" onClick={() => update((d) => { d.youngdan.push({ id: uid(), name: "", color: "bg-white/30", effect: "", source: "", icon: "" }); })}>
          + 영단 추가
        </Btn>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((y) => {
          const i = list.findIndex((x) => x.id === y.id);
          return (
            <div key={y.id} className="flex gap-3 rounded-lg border border-white/10 bg-[#15171c] p-3">
              <IconSlot
                icon={y.icon}
                color={y.color}
                onFiles={(f) => setIcon(y.id, f)}
                onZoom={() => y.icon && setZoom(y.icon)}
                onRemove={() => { if (confirmDelete("아이콘을 지울까요?")) update((d) => { d.youngdan[i].icon = ""; }); }}
              />
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-1">
                  <TextInput
                    value={y.name}
                    onChange={(v) => update((d) => { d.youngdan[i].name = v; })}
                    placeholder="영단명"
                    className="!text-left flex-1 font-bold"
                  />
                  <button onClick={() => { if (confirmDelete("이 영단을 삭제할까요?")) update((d) => { d.youngdan.splice(i, 1); }); }} className="shrink-0 px-1 text-red-300/50 hover:text-red-300" title="삭제">×</button>
                </div>
                <label className="block text-[11px] text-white/40">효과
                  <TextArea value={y.effect} onChange={(v) => update((d) => { d.youngdan[i].effect = v; })} placeholder="효과" rows={2} />
                </label>
                <label className="mt-1 block text-[11px] text-white/40">획득
                  <TextArea value={y.source} onChange={(v) => update((d) => { d.youngdan[i].source = v; })} placeholder="획득처" rows={2} />
                </label>
              </div>
            </div>
          );
        })}
      </div>

      {/* 영단 화면 캡쳐 · 메모 (공유) */}
      <h2 className="mb-2 mt-6 text-base font-bold text-white/80">📷 영단 화면 · 메모</h2>
      <Board
        posts={data.dwellings}
        mutate={(recipe) => update((d) => recipe(d.dwellings))}
        help={
          <>
            영단 트리·세팅 <b>스크린샷</b>을 <b>Ctrl+V</b>로 붙여넣거나, 추천 테크·우선순위 등을 글로 정리해 두세요. (모두에게 공유)
          </>
        }
      />

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

function IconSlot({
  icon, color, onFiles, onZoom, onRemove,
}: {
  icon: string;
  color: string;
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
      title={icon ? "클릭=크게 · Ctrl+V로 교체" : "클릭/붙여넣기로 아이콘 추가"}
      className={`group relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-black/30 outline-none ${focused ? "ring-2 ring-emerald-400/60" : ""}`}
    >
      {icon ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={icon} alt="" onClick={onZoom} className="h-full w-full cursor-zoom-in object-contain" />
          <button onClick={onRemove} className="absolute right-0 top-0 hidden rounded-bl bg-red-500/80 px-1 text-[10px] text-white group-hover:block" title="아이콘 삭제">×</button>
        </>
      ) : (
        <button onClick={() => inputRef.current?.click()} className="flex h-full w-full items-center justify-center" title="아이콘 추가">
          <span className={`h-5 w-5 rounded-full ${color} ring-1 ring-white/25`} />
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files && onFiles(e.target.files)} />
    </div>
  );
}
