"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PageHelp from "../../components/PageHelp";

type Item = { id: string; name: string; url: string; img: HTMLImageElement; w: number; h: number };
type Dir = "horizontal" | "vertical";
type Align = "start" | "center" | "end";

let seq = 0;

export default function ImageMergePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [dir, setDir] = useState<Dir>("horizontal");
  const [align, setAlign] = useState<Align>("center");
  const [gap, setGap] = useState(0);
  const [pad, setPad] = useState(0);
  const [bg, setBg] = useState("#0b0f14");
  const [transparent, setTransparent] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [over, setOver] = useState(false);

  const dragIndex = useRef<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<Item[]>([]);
  itemsRef.current = items;

  const addFiles = useCallback((files: FileList | File[]) => {
    const imgs = Array.from(files).filter((f) => f.type.startsWith("image/"));
    imgs.forEach((f) => {
      const url = URL.createObjectURL(f);
      const img = new Image();
      img.onload = () => {
        setItems((prev) => [...prev, { id: "i" + seq++, name: f.name || "image", url, img, w: img.naturalWidth, h: img.naturalHeight }]);
        setResultUrl(null);
      };
      img.onerror = () => URL.revokeObjectURL(url);
      img.src = url;
    });
  }, []);

  // 캡처 붙여넣기(Ctrl+V)
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (!e.clipboardData) return;
      const files = Array.from(e.clipboardData.items)
        .filter((i) => i.type.startsWith("image/"))
        .map((i) => i.getAsFile())
        .filter((f): f is File => Boolean(f));
      if (files.length) { e.preventDefault(); addFiles(files); }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [addFiles]);

  // 언마운트 시 objectURL 정리
  useEffect(() => () => { itemsRef.current.forEach((it) => URL.revokeObjectURL(it.url)); }, []);

  function removeAt(i: number) {
    setItems((prev) => { URL.revokeObjectURL(prev[i].url); return prev.filter((_, k) => k !== i); });
    setResultUrl(null);
  }
  function move(i: number, d: number) {
    setItems((prev) => {
      const j = i + d; if (j < 0 || j >= prev.length) return prev;
      const next = prev.slice(); [next[i], next[j]] = [next[j], next[i]]; return next;
    });
    setResultUrl(null);
  }
  function onDropCard(target: number) {
    const from = dragIndex.current;
    if (from == null || from === target) return;
    setItems((prev) => { const next = prev.slice(); const [m] = next.splice(from, 1); next.splice(target, 0, m); return next; });
    dragIndex.current = null;
    setResultUrl(null);
  }
  function clearAll() {
    items.forEach((it) => URL.revokeObjectURL(it.url));
    setItems([]); setResultUrl(null);
  }

  function generate() {
    if (!items.length) return;
    const horiz = dir === "horizontal";
    const g = Math.max(0, gap || 0);
    const p = Math.max(0, pad || 0);

    const crosses = items.map((it) => (horiz ? it.h : it.w));
    const mains = items.map((it) => (horiz ? it.w : it.h));
    const crossMax = Math.max(...crosses);
    const mainTotal = mains.reduce((a, b) => a + b, 0) + g * (items.length - 1);

    const totalW = (horiz ? mainTotal : crossMax) + p * 2;
    const totalH = (horiz ? crossMax : mainTotal) + p * 2;

    const canvas = document.createElement("canvas");
    canvas.width = totalW; canvas.height = totalH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (!transparent) { ctx.fillStyle = bg; ctx.fillRect(0, 0, totalW, totalH); }

    let cursor = p;
    items.forEach((it) => {
      const crossSize = horiz ? it.h : it.w;
      let crossOff = p;
      if (align === "center") crossOff = p + (crossMax - crossSize) / 2;
      else if (align === "end") crossOff = p + (crossMax - crossSize);
      const x = horiz ? cursor : crossOff;
      const y = horiz ? crossOff : cursor;
      ctx.drawImage(it.img, x, y, it.w, it.h);
      cursor += (horiz ? it.w : it.h) + g;
    });

    setResultUrl(canvas.toDataURL("image/png"));
  }

  function download() {
    if (!resultUrl) return;
    const a = document.createElement("a");
    a.href = resultUrl; a.download = "merged-" + Date.now() + ".png"; a.click();
  }

  const horiz = dir === "horizontal";
  const alignLabel = horiz ? "세로 정렬" : "가로 정렬";
  const alignOpts: { v: Align; label: string }[] = [
    { v: "start", label: horiz ? "위" : "왼쪽" },
    { v: "center", label: "가운데" },
    { v: "end", label: horiz ? "아래" : "오른쪽" },
  ];

  const seg = "rounded-md border px-3 py-1.5 text-sm transition";
  const segOn = "border-emerald-400/50 bg-emerald-400/10 text-emerald-300";
  const segOff = "border-white/15 text-white/55 hover:text-white";

  return (
    <div className="mx-auto max-w-4xl">
      <PageHelp>
        여러 이미지를 <b>가로</b>·<b>세로</b>로 이어붙여 한 장으로 만들어요. 파일선택·드래그·<b>Ctrl+V</b>로 추가하고, 카드를 <b>드래그</b>하거나 ◀▶로 순서를 바꾼 뒤 <b>합치기</b>를 누르세요. 정렬·간격·여백·배경색을 조절할 수 있어요. (결과는 내 브라우저에서만 처리되고 저장은 다운로드로)
      </PageHelp>

      {/* 드롭존 */}
      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); }}
        className={`mb-4 cursor-pointer rounded-xl border-2 border-dashed p-8 text-center text-sm transition ${over ? "border-emerald-400/50 text-emerald-200" : "border-white/20 text-white/45 hover:border-emerald-400/40"}`}
      >
        여기로 이미지를 <b className="text-white/70">드래그</b>하거나 클릭해서 선택 · <b className="text-white/70">Ctrl+V</b>로 캡처 붙여넣기
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
      </div>

      {/* 옵션 */}
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-3 rounded-xl border border-white/10 bg-[#15171c] px-4 py-3 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-white/45">방향</span>
          <div className="flex gap-1">
            <button className={`${seg} ${horiz ? segOn : segOff}`} onClick={() => { setDir("horizontal"); setResultUrl(null); }}>↔ 가로</button>
            <button className={`${seg} ${!horiz ? segOn : segOff}`} onClick={() => { setDir("vertical"); setResultUrl(null); }}>↕ 세로</button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white/45">{alignLabel}</span>
          <div className="flex gap-1">
            {alignOpts.map((o) => (
              <button key={o.v} className={`${seg} ${align === o.v ? segOn : segOff}`} onClick={() => { setAlign(o.v); setResultUrl(null); }}>{o.label}</button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-white/45">간격
          <input type="number" min={0} value={gap} onChange={(e) => { setGap(Math.max(0, Number(e.target.value) || 0)); setResultUrl(null); }} className="w-16 rounded-md border border-white/10 bg-black/30 px-2 py-1 text-center text-white outline-none focus:border-emerald-400/60" />px
        </label>
        <label className="flex items-center gap-2 text-white/45">여백
          <input type="number" min={0} value={pad} onChange={(e) => { setPad(Math.max(0, Number(e.target.value) || 0)); setResultUrl(null); }} className="w-16 rounded-md border border-white/10 bg-black/30 px-2 py-1 text-center text-white outline-none focus:border-emerald-400/60" />px
        </label>
        <div className="flex items-center gap-2 text-white/45">배경
          <input type="color" value={bg} disabled={transparent} onChange={(e) => { setBg(e.target.value); setResultUrl(null); }} className="h-7 w-9 cursor-pointer rounded border border-white/10 bg-transparent p-0.5 disabled:opacity-40" />
          <label className="flex items-center gap-1"><input type="checkbox" checked={transparent} onChange={(e) => { setTransparent(e.target.checked); setResultUrl(null); }} /> 투명</label>
        </div>
      </div>

      {/* 이미지 카드 목록 */}
      {items.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {items.map((it, i) => (
            <div
              key={it.id}
              draggable
              title="드래그해서 순서 이동"
              onDragStart={() => { dragIndex.current = i; }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDropCard(i)}
              className="group relative w-32 cursor-grab overflow-hidden rounded-lg border border-white/10 bg-black/30"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={it.url} alt="" className="h-24 w-full bg-black/40 object-contain" />
              <div className="flex justify-between px-1.5 py-1 text-[11px] text-white/45">
                <span>{it.w}×{it.h}</span><span>#{i + 1}</span>
              </div>
              <div className="absolute inset-x-0 top-0 flex justify-between bg-gradient-to-b from-black/70 to-transparent p-1 opacity-0 transition group-hover:opacity-100">
                <span className="flex gap-1">
                  <button onClick={(e) => { e.stopPropagation(); move(i, -1); }} className="rounded bg-black/60 px-1.5 text-xs text-white">◀</button>
                  <button onClick={(e) => { e.stopPropagation(); move(i, 1); }} className="rounded bg-black/60 px-1.5 text-xs text-white">▶</button>
                </span>
                <button onClick={(e) => { e.stopPropagation(); removeAt(i); }} className="rounded bg-red-600/75 px-1.5 text-xs text-white">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 액션 */}
      <div className="mb-5 flex items-center gap-2">
        <button onClick={generate} disabled={!items.length} className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40">
          🧩 합치기{items.length ? ` (${items.length})` : ""}
        </button>
        {resultUrl && (
          <button onClick={download} className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-emerald-400">⬇ 다운로드</button>
        )}
        {items.length > 0 && (
          <button onClick={clearAll} className="rounded-lg px-3 py-2 text-sm text-white/40 hover:text-white/80">전체 비우기</button>
        )}
      </div>

      {/* 결과 */}
      {resultUrl && (
        <div className="rounded-xl border border-white/10 bg-[#15171c] p-3">
          <p className="mb-2 text-xs text-white/45">결과 미리보기 (이미지를 우클릭하거나 다운로드 버튼으로 저장)</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={resultUrl} alt="합쳐진 이미지" className="max-h-[70vh] max-w-full object-contain" />
        </div>
      )}
    </div>
  );
}
