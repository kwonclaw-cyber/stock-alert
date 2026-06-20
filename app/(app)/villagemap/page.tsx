"use client";

import { useRef, useState } from "react";
import { useStore } from "../../components/StoreProvider";
import Loading from "../../components/Loading";
import PageHelp from "../../components/PageHelp";
import { fileToDataUrl } from "../../components/imageUtil";

export default function VillageMapPage() {
  const { data, update } = useStore();
  const [zoom, setZoom] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  if (!data) return <Loading />;

  const image = data.villageMap;

  async function setImage(files: FileList | File[]) {
    const f = Array.from(files).find((x) => x.type.startsWith("image/"));
    if (!f) return;
    const url = await fileToDataUrl(f, 2400);
    update((d) => { d.villageMap = url; });
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHelp>
        <b>마을지도</b>를 올려두는 곳이에요. 아래 카드를 클릭하고 <b>Ctrl+V</b>로 캡처를 붙여넣으세요(드래그·파일선택도 가능). <b>클릭하면 원본 크기</b>로 크게 볼 수 있어요.
      </PageHelp>

      <div
        tabIndex={0}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onPaste={(e) => { if (e.clipboardData.files.length) { e.preventDefault(); setImage(e.clipboardData.files); } }}
        onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length) setImage(e.dataTransfer.files); }}
        onDragOver={(e) => e.preventDefault()}
        className={`relative w-full overflow-hidden rounded-xl border border-white/10 bg-[#15171c] outline-none ${focused ? "ring-2 ring-inset ring-emerald-400/60" : ""}`}
      >
        {image ? (
          <div className="group relative w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="마을지도" onClick={() => setZoom(true)} className="max-h-[78vh] w-full cursor-zoom-in object-contain" />
            <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition group-hover:opacity-100">
              <button onClick={() => setZoom(true)} className="rounded bg-black/60 px-2 py-1 text-xs text-white hover:bg-black/80">크게</button>
              <button onClick={() => inputRef.current?.click()} className="rounded bg-black/60 px-2 py-1 text-xs text-white hover:bg-black/80">교체</button>
              <button onClick={() => update((d) => { d.villageMap = ""; })} className="rounded bg-red-500/80 px-2 py-1 text-xs text-white hover:bg-red-500">삭제</button>
            </div>
          </div>
        ) : (
          <button onClick={() => inputRef.current?.click()} className="flex aspect-[16/10] w-full flex-col items-center justify-center gap-2 text-center text-sm text-white/40">
            <span className="text-4xl">🗺️</span>
            <span>여기를 클릭 후 <b className="text-white/60">Ctrl+V</b>로 마을지도 붙여넣기</span>
            <span className="text-xs">드래그&드롭 · 클릭해서 파일 선택</span>
          </button>
        )}
        <input ref={inputRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files && setImage(e.target.files)} />
      </div>

      {zoom && image && (
        <div onClick={() => setZoom(false)} className="fixed inset-0 z-50 overflow-auto bg-black/90 p-6">
          <button onClick={() => setZoom(false)} className="fixed right-4 top-4 z-10 rounded bg-black/60 px-3 py-1.5 text-sm text-white hover:bg-black/80">닫기 ✕</button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="마을지도" onClick={(e) => e.stopPropagation()} className="mx-auto rounded-lg" />
        </div>
      )}
    </div>
  );
}
