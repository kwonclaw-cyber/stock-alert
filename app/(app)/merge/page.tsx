"use client";

import { useEffect, useRef, useState } from "react";
import { Btn } from "../../components/fields";
import PageHelp from "../../components/PageHelp";

type Dir = "horizontal" | "vertical";
type Align = "start" | "center" | "end";

type Item = {
  id: string;
  name: string;
  url: string; // object URL (미리보기/그리기 공용)
  w: number;
  h: number;
};

let _seq = 0;
const uid = () => `img-${Date.now()}-${_seq++}`;

/** File → 디코딩된 이미지 정보(원본 크기 유지) */
function loadItem(file: File): Promise<Item> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () =>
      resolve({ id: uid(), name: file.name || "image", url, w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("이미지를 읽을 수 없어요")); };
    img.src = url;
  });
}

export default function MergePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [dir, setDir] = useState<Dir>("horizontal");
  const [align, setAlign] = useState<Align>("center");
  const [gap, setGap] = useState(0);
  const [pad, setPad] = useState(0);
  const [bg, setBg] = useState("#0b0f14");
  const [transparent, setTransparent] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dragIndex = useRef<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // object URL 정리
  useEffect(() => () => { items.forEach((it) => URL.revokeObjectURL(it.url)); }, [items]);

  async function addFiles(files: FileList | File[]) {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!list.length) return;
    const loaded = await Promise.all(list.map(loadItem));
    setItems((prev) => [...prev, ...loaded]);
    setResult(null);
  }

  // 붙여넣기(Ctrl+V)로 캡처 추가
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const files = Array.from(e.clipboardData?.items || [])
        .filter((i) => i.type.startsWith("image/"))
        .map((i) => i.getAsFile())
        .filter((f): f is File => !!f);
      if (files.length) { e.preventDefault(); addFiles(files); }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  function remove(id: string) {
    setItems((prev) => {
      const t = prev.find((i) => i.id === id);
      if (t) URL.revokeObjectURL(t.url);
      return prev.filter((i) => i.id !== id);
    });
    setResult(null);
  }
  function move(i: number, delta: number) {
    setItems((prev) => {
      const j = i + delta;
      if (j < 0 || j >= prev.length) return prev;
      const next = prev.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    setResult(null);
  }
  function onDrop(target: number) {
    const from = dragIndex.current;
    dragIndex.current = null;
    if (from == null || from === target) return;
    setItems((prev) => {
      const next = prev.slice();
      const [moved] = next.splice(from, 1);
      next.splice(target, 0, moved);
      return next;
    });
    setResult(null);
  }

  async function generate() {
    if (!items.length) return;
    setBusy(true);
    try {
      const horiz = dir === "horizontal";
      // 합치는 축(main)과 교차축(cross) 크기 계산
      const mains = items.map((it) => (horiz ? it.w : it.h));
      const crosses = items.map((it) => (horiz ? it.h : it.w));
      const crossMax = Math.max(...crosses);
      const mainTotal = mains.reduce((a, b) => a + b, 0) + gap * (items.length - 1);

      const totalW = (horiz ? mainTotal : crossMax) + pad * 2;
      const totalH = (horiz ? crossMax : mainTotal) + pad * 2;

      const canvas = document.createElement("canvas");
      canvas.width = totalW;
      canvas.height = totalH;
      const ctx = canvas.getContext("2d")!;
      if (!transparent) { ctx.fillStyle = bg; ctx.fillRect(0, 0, totalW, totalH); }

      let cursor = pad;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const img = await loadImage(it.url);
        const crossSize = horiz ? it.h : it.w;
        let crossOff = pad;
        if (align === "center") crossOff = pad + (crossMax - crossSize) / 2;
        else if (align === "end") crossOff = pad + (crossMax - crossSize);
        const x = horiz ? cursor : crossOff;
        const y = horiz ? crossOff : cursor;
        ctx.drawImage(img, x, y, it.w, it.h);
        cursor += (horiz ? it.w : it.h) + gap;
      }
      setResult(canvas.toDataURL(transparent ? "image/png" : "image/png"));
    } finally {
      setBusy(false);
    }
  }

  function download() {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result;
    a.download = `merged-${Date.now()}.png`;
    a.click();
  }

  const dirBtn = (d: Dir, label: string) => (
    <button
      onClick={() => { setDir(d); setResult(null); }}
      className={`rounded-md border px-3 py-1.5 text-sm transition ${dir === d ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-300" : "border-white/15 text-white/50 hover:text-white"}`}
    >
      {label}
    </button>
  );
  const alignBtn = (a: Align, label: string) => (
    <button
      onClick={() => { setAlign(a); setResult(null); }}
      className={`rounded-md border px-3 py-1.5 text-sm transition ${align === a ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-300" : "border-white/15 text-white/50 hover:text-white"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="mx-auto max-w-4xl">
      <PageHelp>
        여러 이미지를 <b>가로</b> 또는 <b>세로</b>로 이어붙여 하나의 이미지로 만들어요. 파일 선택·드래그·<b>Ctrl+V</b>(캡처 붙여넣기)로 추가하고, 카드를 <b>드래그</b>하거나 ◀▶로 순서를 바꾼 뒤 <b>합치기</b>를 누르세요. 정렬·간격·여백·배경색을 조절할 수 있어요.
      </PageHelp>

      {/* 추가 영역 */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); }}
        onClick={() => fileInput.current?.click()}
        className="mb-4 cursor-pointer rounded-xl border border-dashed border-white/20 bg-white/[0.02] px-4 py-8 text-center text-sm text-white/45 transition hover:border-emerald-400/40 hover:text-white/70"
      >
        여기로 이미지를 <b>드래그</b>하거나 클릭해서 선택하세요 · <b>Ctrl+V</b>로 캡처 붙여넣기도 돼요
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
        />
      </div>

      {/* 옵션 */}
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm">
        <label className="flex items-center gap-2">
          <span className="text-white/45">방향</span>
          <span className="flex gap-1">{dirBtn("horizontal", "↔ 가로")}{dirBtn("vertical", "↕ 세로")}</span>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-white/45">{dir === "horizontal" ? "세로 정렬" : "가로 정렬"}</span>
          <span className="flex gap-1">
            {alignBtn("start", dir === "horizontal" ? "위" : "왼쪽")}
            {alignBtn("center", "가운데")}
            {alignBtn("end", dir === "horizontal" ? "아래" : "오른쪽")}
          </span>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-white/45">간격</span>
          <input type="number" min={0} value={gap}
            onChange={(e) => { setGap(Math.max(0, +e.target.value || 0)); setResult(null); }}
            className="w-16 rounded-md border border-white/10 bg-black/30 px-2 py-1 text-white outline-none focus:border-emerald-400/60" />
          <span className="text-white/30">px</span>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-white/45">여백</span>
          <input type="number" min={0} value={pad}
            onChange={(e) => { setPad(Math.max(0, +e.target.value || 0)); setResult(null); }}
            className="w-16 rounded-md border border-white/10 bg-black/30 px-2 py-1 text-white outline-none focus:border-emerald-400/60" />
          <span className="text-white/30">px</span>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-white/45">배경</span>
          <input type="color" value={bg} disabled={transparent}
            onChange={(e) => { setBg(e.target.value); setResult(null); }}
            className="h-7 w-9 cursor-pointer rounded border border-white/10 bg-transparent disabled:opacity-30" />
          <label className="flex cursor-pointer items-center gap-1 text-white/45">
            <input type="checkbox" checked={transparent}
              onChange={(e) => { setTransparent(e.target.checked); setResult(null); }} />
            투명
          </label>
        </label>
      </div>

      {/* 이미지 목록 */}
      {items.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {items.map((it, i) => (
            <div
              key={it.id}
              draggable
              onDragStart={() => { dragIndex.current = i; }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(i)}
              className="group relative w-32 cursor-grab overflow-hidden rounded-lg border border-white/10 bg-black/30 active:cursor-grabbing"
              title="드래그해서 순서 이동"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={it.url} alt={it.name} className="h-24 w-full object-contain bg-black/40" />
              <div className="flex items-center justify-between px-1.5 py-1 text-[11px] text-white/40">
                <span>{it.w}×{it.h}</span>
                <span>#{i + 1}</span>
              </div>
              <div className="absolute inset-x-0 top-0 flex justify-between bg-gradient-to-b from-black/70 to-transparent p-1 opacity-0 transition group-hover:opacity-100">
                <div className="flex gap-0.5">
                  <button onClick={() => move(i, -1)} disabled={i === 0}
                    className="rounded bg-black/60 px-1.5 text-white/80 hover:bg-black/80 disabled:opacity-30">◀</button>
                  <button onClick={() => move(i, 1)} disabled={i === items.length - 1}
                    className="rounded bg-black/60 px-1.5 text-white/80 hover:bg-black/80 disabled:opacity-30">▶</button>
                </div>
                <button onClick={() => remove(it.id)}
                  className="rounded bg-red-600/70 px-1.5 text-white hover:bg-red-600">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 액션 */}
      <div className="mb-5 flex items-center gap-2">
        <Btn variant="primary" onClick={generate} disabled={!items.length || busy}>
          {busy ? "합치는 중…" : `🧩 합치기 (${items.length})`}
        </Btn>
        {result && <Btn variant="primary" onClick={download}>⬇ 다운로드</Btn>}
        {items.length > 0 && (
          <Btn variant="ghost" onClick={() => { items.forEach((it) => URL.revokeObjectURL(it.url)); setItems([]); setResult(null); }}>
            전체 비우기
          </Btn>
        )}
      </div>

      {/* 결과 미리보기 */}
      {result && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <p className="mb-2 text-xs text-white/45">결과 미리보기 (이미지를 우클릭하거나 다운로드 버튼으로 저장)</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={result} alt="합쳐진 이미지" className="max-h-[70vh] w-full object-contain" />
        </div>
      )}
    </div>
  );
}

/** data/object URL → HTMLImageElement */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("이미지 로드 실패"));
    img.src = src;
  });
}
