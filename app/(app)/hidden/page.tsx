"use client";

import { useRef, useState } from "react";
import { useStore } from "../../components/StoreProvider";
import { TextInput, TextArea, Btn } from "../../components/fields";
import Loading from "../../components/Loading";
import { emptyHidden } from "@/lib/data";
import type { HiddenStatus } from "@/lib/data";

const STATUS: HiddenStatus[] = ["후보", "유력", "제외", "확정"];
const STATUS_COLOR: Record<HiddenStatus, string> = {
  후보: "bg-white/10 text-white/70 border-white/15",
  유력: "bg-amber-500/20 text-amber-300 border-amber-400/30",
  제외: "bg-red-500/15 text-red-300 border-red-400/30",
  확정: "bg-emerald-500/20 text-emerald-300 border-emerald-400/30",
};

/** 캡처/이미지 파일을 다운스케일한 data URL로 변환 */
async function fileToDataUrl(file: File, maxW = 1100): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxW / bitmap.width);
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", 0.82);
}

export default function HiddenPage() {
  const { data, update } = useStore();
  const [zoom, setZoom] = useState<string | null>(null);
  if (!data) return <Loading />;

  async function addImages(ei: number, files: FileList | File[]) {
    const imgs: string[] = [];
    for (const f of Array.from(files)) {
      if (f.type.startsWith("image/")) imgs.push(await fileToDataUrl(f));
    }
    if (imgs.length) update((d) => { d.hidden[ei].images.push(...imgs); });
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-white/50">
          단서를 위에서부터 <b className="text-white/70">순서대로</b> 쌓아 유추하세요. 카드에 캡처 이미지를 <b className="text-white/70">Ctrl+V</b>로 붙여넣을 수 있어요.
        </p>
        <Btn variant="primary" onClick={() => update((d) => { d.hidden.push(emptyHidden()); })}>
          + 단서 추가
        </Btn>
      </div>

      {/* 종합 유추 결론 */}
      <div className="mb-5 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.04] p-4">
        <div className="mb-2 text-sm font-semibold text-emerald-300">🧩 종합 유추 / 결론</div>
        <TextArea
          value={data.hiddenConclusion}
          onChange={(v) => update((d) => { d.hiddenConclusion = v; })}
          placeholder="모은 단서들을 토대로 추리한 결론을 적어두세요."
          rows={3}
        />
      </div>

      <div className="space-y-3">
        {data.hidden.map((entry, ei) => (
          <article
            key={entry.id}
            onPaste={(e) => {
              const files = Array.from(e.clipboardData.files);
              if (files.length) { e.preventDefault(); addImages(ei, files); }
            }}
            className="rounded-xl border border-white/10 bg-[#15171c] p-4"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-bold text-white/70">
                {ei + 1}
              </span>
              <TextInput
                value={entry.title}
                onChange={(v) => update((d) => { d.hidden[ei].title = v; })}
                placeholder="대상 / 단계 제목"
                className="flex-1 font-semibold"
              />
              <select
                value={entry.status}
                onChange={(e) => update((d) => { d.hidden[ei].status = e.target.value as HiddenStatus; })}
                className={`rounded-md border px-2 py-1.5 text-xs font-semibold outline-none ${STATUS_COLOR[entry.status]}`}
              >
                {STATUS.map((s) => (
                  <option key={s} value={s} className="bg-[#23262e] text-white">{s}</option>
                ))}
              </select>
              {/* 순서 이동 */}
              <div className="flex flex-col">
                <button
                  onClick={() => ei > 0 && update((d) => { [d.hidden[ei - 1], d.hidden[ei]] = [d.hidden[ei], d.hidden[ei - 1]]; })}
                  disabled={ei === 0}
                  className="px-1 text-white/40 hover:text-white disabled:opacity-20"
                  title="위로"
                >▲</button>
                <button
                  onClick={() => ei < data.hidden.length - 1 && update((d) => { [d.hidden[ei + 1], d.hidden[ei]] = [d.hidden[ei], d.hidden[ei + 1]]; })}
                  disabled={ei === data.hidden.length - 1}
                  className="px-1 text-white/40 hover:text-white disabled:opacity-20"
                  title="아래로"
                >▼</button>
              </div>
              <button
                onClick={() => update((d) => { d.hidden.splice(ei, 1); })}
                className="px-1 text-red-300/50 hover:text-red-300"
                title="삭제"
              >×</button>
            </div>

            <TextArea
              value={entry.content}
              onChange={(v) => update((d) => { d.hidden[ei].content = v; })}
              placeholder="단서 내용 / 관찰한 정보를 적으세요."
              rows={2}
              className="mt-2"
            />

            {/* 이미지 영역 */}
            {entry.images.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {entry.images.map((src, ii) => (
                  <div key={ii} className="group relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt=""
                      onClick={() => setZoom(src)}
                      className="h-24 w-auto cursor-zoom-in rounded-lg border border-white/10 object-cover"
                    />
                    <button
                      onClick={() => update((d) => { d.hidden[ei].images.splice(ii, 1); })}
                      className="absolute -right-1.5 -top-1.5 hidden h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white group-hover:flex"
                      title="이미지 삭제"
                    >×</button>
                  </div>
                ))}
              </div>
            )}

            <PasteZone onFiles={(files) => addImages(ei, files)} />
          </article>
        ))}

        {data.hidden.length === 0 && (
          <p className="py-10 text-center text-sm text-white/30">단서가 없습니다. “단서 추가”를 눌러주세요.</p>
        )}
      </div>

      {/* 확대 보기 */}
      {zoom && (
        <div
          onClick={() => setZoom(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt="" className="max-h-full max-w-full rounded-lg" />
        </div>
      )}
    </div>
  );
}

function PasteZone({ onFiles }: { onFiles: (files: FileList | File[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div
      onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files); }}
      onDragOver={(e) => e.preventDefault()}
      className="mt-2 flex items-center justify-center gap-2 rounded-lg border border-dashed border-white/15 py-2 text-xs text-white/35"
    >
      <span>📋 캡처를 Ctrl+V로 붙여넣기 · 드래그&드롭</span>
      <button onClick={() => inputRef.current?.click()} className="text-emerald-400 hover:underline">
        또는 파일 선택
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => e.target.files && onFiles(e.target.files)}
      />
    </div>
  );
}
