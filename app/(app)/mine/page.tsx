"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "../../components/StoreProvider";
import { TextInput, Btn } from "../../components/fields";
import Loading from "../../components/Loading";
import PageHelp from "../../components/PageHelp";
import { fileToDataUrl } from "../../components/imageUtil";
import { uid } from "@/lib/data";

function remain(lastDoneAt: string | null, cooldownMin: number, now: number) {
  if (!lastDoneAt || cooldownMin <= 0) return { ready: true, ms: -1, text: "채굴 가능" };
  const ms = new Date(lastDoneAt).getTime() + cooldownMin * 60_000 - now;
  if (ms <= 0) return { ready: true, ms: -1, text: "채굴 가능" };
  const sec = Math.floor(ms / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const text = h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
  return { ready: false, ms, text };
}

export default function MinePage() {
  const { data, update } = useStore();
  const [now, setNow] = useState(() => Date.now());
  const [zoom, setZoom] = useState(false);
  const [genCount, setGenCount] = useState(40);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!data) return <Loading />;
  const mine = data.mine;

  const sorted = [...mine.mines]
    .map((m) => ({ m, r: remain(m.lastDoneAt, m.cooldownMin, now) }))
    .sort((a, z) => a.r.ms - z.r.ms); // 채굴가능(-1) → 남은시간 적은 순

  const readyCount = sorted.filter((x) => x.r.ready).length;

  async function setMap(files: FileList | File[]) {
    const f = Array.from(files).find((x) => x.type.startsWith("image/"));
    if (!f) return;
    const url = await fileToDataUrl(f);
    update((d) => { d.mine.mapImage = url; });
  }

  function generate() {
    update((d) => {
      d.mine.mines = Array.from({ length: Math.max(1, genCount) }, (_, i) => ({
        id: uid(),
        name: `광산${i + 1}`,
        cooldownMin: d.mine.defaultCooldownMin,
        lastDoneAt: null,
      }));
    });
  }

  return (
    <div>
      <PageHelp>
        <b>완료</b>를 누르면 그 광산이 설정한 쿨타임만큼 잠기고, 목록은 <b>채굴 가능 → 쿨타임 적게 남은 순</b>으로 실시간 정렬됩니다.
        “광산 N개 생성”으로 한 번에 만들거나 개별 추가하세요. 우측 <b>지도</b>에는 캡처를 붙여넣기/드래그/첨부할 수 있고 클릭하면 크게 볼 수 있어요.
      </PageHelp>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 text-sm text-white/50">
          기본 쿨타임
          <TextInput type="number" value={mine.defaultCooldownMin} onChange={(v) => update((d) => { d.mine.defaultCooldownMin = Number(v) || 0; })} className="w-20" />
          분
        </label>
        <span className="h-4 w-px bg-white/10" />
        <label className="flex items-center gap-1.5 text-sm text-white/50">
          <TextInput type="number" value={genCount} onChange={(v) => setGenCount(Number(v) || 0)} className="w-16" />
          개 생성
        </label>
        <Btn onClick={generate}>광산 일괄 생성</Btn>
        <Btn
          variant="ghost"
          onClick={() => update((d) => { d.mine.mines.push({ id: uid(), name: `광산${d.mine.mines.length + 1}`, cooldownMin: d.mine.defaultCooldownMin, lastDoneAt: null }); })}
        >
          + 광산 추가
        </Btn>
        <div className="ml-auto rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-sm">
          <span className="text-white/60">채굴 가능</span> <b className="text-emerald-300">{readyCount}</b> / {mine.mines.length}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
        {/* 광산 리스트 */}
        <div className="space-y-2">
          {sorted.map(({ m, r }) => {
            const gi = mine.mines.findIndex((x) => x.id === m.id);
            return (
              <div
                key={m.id}
                className={`flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2 ${r.ready ? "border-emerald-400/50 bg-emerald-400/[0.06]" : "border-white/10 bg-[#15171c]"}`}
              >
                <TextInput value={m.name} onChange={(v) => update((d) => { d.mine.mines[gi].name = v; })} className="w-28 font-semibold" />
                <label className="flex items-center gap-1 text-xs text-white/45">
                  쿨
                  <TextInput type="number" value={m.cooldownMin} onChange={(v) => update((d) => { d.mine.mines[gi].cooldownMin = Number(v) || 0; })} className="w-16" />
                  분
                </label>
                <span className={`ml-auto min-w-24 text-right font-mono text-base font-bold ${r.ready ? "text-emerald-400" : "text-white"}`}>
                  {r.text}
                </span>
                <Btn variant="primary" onClick={() => update((d) => { d.mine.mines[gi].lastDoneAt = new Date().toISOString(); })} className="!py-1 !text-xs">
                  완료
                </Btn>
                <button onClick={() => update((d) => { d.mine.mines[gi].lastDoneAt = null; })} className="text-white/35 hover:text-white" title="쿨타임 리셋">↺</button>
                <button onClick={() => update((d) => { d.mine.mines.splice(gi, 1); })} className="text-red-300/50 hover:text-red-300" title="삭제">×</button>
              </div>
            );
          })}
          {mine.mines.length === 0 && (
            <p className="rounded-lg border border-dashed border-white/15 py-10 text-center text-sm text-white/30">
              광산이 없습니다. 위에서 “광산 일괄 생성”을 눌러보세요.
            </p>
          )}
        </div>

        {/* 광산 지도 */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <div className="mb-2 text-sm font-semibold text-white/70">🗺️ 광산 지도</div>
          <MapPanel
            image={mine.mapImage}
            onFiles={setMap}
            onZoom={() => setZoom(true)}
            onRemove={() => update((d) => { d.mine.mapImage = null; })}
          />
        </div>
      </div>

      {zoom && mine.mapImage && (
        <div onClick={() => setZoom(false)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mine.mapImage} alt="광산 지도" className="max-h-full max-w-full rounded-lg" />
        </div>
      )}
    </div>
  );
}

function MapPanel({
  image,
  onFiles,
  onZoom,
  onRemove,
}: {
  image: string | null;
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
      className={`rounded-xl border-2 border-dashed bg-[#15171c] p-2 outline-none transition ${focused ? "border-emerald-400/60" : "border-white/15"}`}
    >
      {image ? (
        <div className="group relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="광산 지도" onClick={onZoom} className="w-full cursor-zoom-in rounded-lg" />
          <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition group-hover:opacity-100">
            <button onClick={onZoom} className="rounded bg-black/60 px-2 py-1 text-xs text-white hover:bg-black/80">크게</button>
            <button onClick={() => inputRef.current?.click()} className="rounded bg-black/60 px-2 py-1 text-xs text-white hover:bg-black/80">교체</button>
            <button onClick={onRemove} className="rounded bg-red-500/80 px-2 py-1 text-xs text-white hover:bg-red-500">삭제</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          className="flex h-44 w-full flex-col items-center justify-center gap-1 text-center text-xs text-white/40"
        >
          <span className="text-2xl">📌</span>
          <span>여기를 클릭 후 <b className="text-white/60">Ctrl+V</b>로 붙여넣기</span>
          <span>또는 드래그&드롭 · 클릭해서 파일 선택</span>
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files && onFiles(e.target.files)} />
    </div>
  );
}
