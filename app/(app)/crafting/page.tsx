"use client";

import { useRef, useState } from "react";
import { useStore } from "../../components/StoreProvider";
import { TextInput, TextArea, Btn } from "../../components/fields";
import Loading from "../../components/Loading";
import PageHelp from "../../components/PageHelp";
import { confirmDelete } from "@/lib/confirmDelete";
import { fileToDataUrl } from "../../components/imageUtil";
import { uid } from "@/lib/data";

export default function CraftingPage() {
  const { data, update } = useStore();
  const [zoom, setZoom] = useState<string | null>(null);
  if (!data) return <Loading />;

  const cards = data.craftings;

  async function setImage(id: string, files: FileList | File[]) {
    const f = Array.from(files).find((x) => x.type.startsWith("image/"));
    if (!f) return;
    const url = await fileToDataUrl(f, 1600);
    update((d) => { const c = d.craftings.find((x) => x.id === id); if (c) c.image = url; });
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHelp>
        <b>제작 및 재료 정보</b>를 카드로 모아두는 곳이에요. <b>카드 생성</b> 후 카드 안을 클릭하고 <b>Ctrl+V</b>로 캡처를 붙여넣으세요(드래그·파일선택도 가능). 이미지는 카드 크기에 맞춰 비율대로 들어가고, <b>클릭하면 원본 크기</b>로 볼 수 있어요. 제목·메모도 적어두세요.
      </PageHelp>

      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm text-white/50">총 {cards.length}장</span>
        <Btn variant="primary" onClick={() => update((d) => { d.craftings.push({ id: uid(), title: "", image: "", memo: "" }); })}>
          + 카드 생성
        </Btn>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {cards.map((card) => {
          const ci = cards.findIndex((x) => x.id === card.id);
          return (
            <div key={card.id} className="overflow-hidden rounded-xl border border-white/10 bg-[#15171c]">
              <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
                <TextInput
                  value={card.title}
                  onChange={(v) => update((d) => { d.craftings[ci].title = v; })}
                  placeholder="제목 (예: 강철 제작 재료)"
                  className="!text-left flex-1 font-semibold"
                />
                <button onClick={() => { if (confirmDelete("이 카드를 삭제할까요?")) update((d) => { d.craftings.splice(ci, 1); }); }} className="text-red-300/60 hover:text-red-300" title="카드 삭제">삭제</button>
              </div>

              <CardImage image={card.image} onFiles={(f) => setImage(card.id, f)} onZoom={() => card.image && setZoom(card.image)} onRemove={() => { if (confirmDelete("이미지를 삭제할까요?")) update((d) => { d.craftings[ci].image = ""; }); }} />

              <div className="space-y-2 px-3 py-2">
                <TextArea
                  value={card.memo}
                  onChange={(v) => update((d) => { d.craftings[ci].memo = v; })}
                  placeholder="메모 (재료, 제작처, 수량 등)"
                  rows={2}
                />
              </div>
            </div>
          );
        })}
      </div>

      {cards.length === 0 && (
        <p className="mt-6 rounded-lg border border-dashed border-white/15 py-12 text-center text-sm text-white/30">
          카드가 없습니다. “카드 생성”을 눌러 캡처 이미지를 붙여넣어 보세요.
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
          <span>드래그&드롭 · 클릭해서 파일 선택 (권장 600×400)</span>
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files && onFiles(e.target.files)} />
    </div>
  );
}
