"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "../../components/StoreProvider";
import { TextInput, Btn } from "../../components/fields";
import Loading from "../../components/Loading";
import PageHelp from "../../components/PageHelp";
import { fileToDataUrl } from "../../components/imageUtil";
import { uid, type Mine } from "@/lib/data";

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

const label = (m: Mine, idx: number) => m.name.match(/\d+/)?.[0] ?? String(idx + 1);
const clamp = (v: number) => Math.min(100, Math.max(0, v));

export default function MinePage() {
  const { data, update } = useStore();
  const [now, setNow] = useState(() => Date.now());
  const [zoom, setZoom] = useState(false);
  const [editMarkers, setEditMarkers] = useState(false);
  const [genCount, setGenCount] = useState(40);
  const [showRoute, setShowRoute] = useState(true);
  const [routeMin, setRouteMin] = useState(10);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!data) return <Loading />;
  const mine = data.mine;

  const sorted = [...mine.mines]
    .map((m, idx) => ({ m, idx, r: remain(m.lastDoneAt, m.cooldownMin, now) }))
    .sort((a, z) => a.r.ms - z.r.ms);

  const readyCount = sorted.filter((x) => x.r.ready).length;
  const placedCount = mine.mines.filter((m) => m.x != null).length;

  // 시간 고려 동선: 마커가 있고 채굴 가능/임박(routeMin분 이내)한 광산을, 가장 임박한 곳에서 출발해
  // 가까운 순서로 잇는 추천 순회 경로(최근접 이웃).
  const candidates = sorted.filter(
    (s) => s.m.x != null && s.m.y != null && s.r.ms <= routeMin * 60_000,
  );
  const route = planRoute(candidates);
  const routeCoords = route.map((c) => ({ x: c.m.x as number, y: c.m.y as number }));

  async function setMap(files: FileList | File[]) {
    const f = Array.from(files).find((x) => x.type.startsWith("image/"));
    if (!f) return;
    const url = await fileToDataUrl(f);
    update((d) => { d.mine.mapImage = url; });
  }
  function generate() {
    update((d) => {
      d.mine.mines = Array.from({ length: Math.max(1, genCount) }, (_, i) => ({
        id: uid(), name: `광산${i + 1}`, cooldownMin: d.mine.defaultCooldownMin, lastDoneAt: null, x: null, y: null,
      }));
    });
  }
  const complete = (id: string) => update((d) => { const m = d.mine.mines.find((x) => x.id === id); if (m) m.lastDoneAt = new Date().toISOString(); });
  const moveMarker = (id: string, x: number, y: number) => update((d) => { const m = d.mine.mines.find((x2) => x2.id === id); if (m) { m.x = x; m.y = y; } });
  const toggleMarker = (id: string) => update((d) => {
    const m = d.mine.mines.find((x) => x.id === id);
    if (!m) return;
    if (m.x == null) { m.x = 50; m.y = 50; } else { m.x = null; m.y = null; }
  });

  return (
    <div>
      <PageHelp>
        <b>완료</b>를 누르면 그 광산이 쿨타임만큼 잠기고, 목록은 <b>채굴 가능 → 남은시간 적은 순</b>으로 실시간 정렬돼요.
        우측 지도에 캡처를 붙여넣고, 각 광산의 <b>📍</b>로 지도에 마커를 올린 뒤 <b>마커 편집</b>에서 드래그해 위치를 맞추세요. 평소엔 마커를 <b>클릭하면 바로 완료</b>됩니다.
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
        <Btn variant="ghost" onClick={() => update((d) => { d.mine.mines.push({ id: uid(), name: `광산${d.mine.mines.length + 1}`, cooldownMin: d.mine.defaultCooldownMin, lastDoneAt: null, x: null, y: null }); })}>
          + 광산 추가
        </Btn>
        <div className="ml-auto rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-sm">
          <span className="text-white/60">채굴 가능</span> <b className="text-emerald-300">{readyCount}</b> / {mine.mines.length}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_400px]">
        {/* 광산 리스트 */}
        <div className="space-y-2">
          {sorted.map(({ m, idx, r }) => {
            const gi = mine.mines.findIndex((x) => x.id === m.id);
            return (
              <div key={m.id} className={`flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2 ${r.ready ? "border-emerald-400/50 bg-emerald-400/[0.06]" : "border-white/10 bg-[#15171c]"}`}>
                <button
                  onClick={() => toggleMarker(m.id)}
                  className={`text-base transition ${m.x != null ? "opacity-100" : "opacity-30 grayscale hover:opacity-60"}`}
                  title={m.x != null ? "지도에서 제거" : "지도에 마커 올리기"}
                >📍</button>
                <TextInput value={m.name} onChange={(v) => update((d) => { d.mine.mines[gi].name = v; })} className="w-24 font-semibold" />
                <label className="flex items-center gap-1 text-xs text-white/45">
                  쿨<TextInput type="number" value={m.cooldownMin} onChange={(v) => update((d) => { d.mine.mines[gi].cooldownMin = Number(v) || 0; })} className="w-14" />분
                </label>
                <span className={`ml-auto min-w-24 text-right font-mono text-base font-bold ${r.ready ? "text-emerald-400" : "text-white"}`}>{r.text}</span>
                <Btn variant="primary" onClick={() => complete(m.id)} className="!py-1 !text-xs">완료</Btn>
                <Btn onClick={() => update((d) => { d.mine.mines[gi].lastDoneAt = null; })} className="!py-1 !text-xs">리셋</Btn>
                <button onClick={() => update((d) => { d.mine.mines.splice(gi, 1); })} className="text-red-300/50 hover:text-red-300" title="삭제">×</button>
              </div>
            );
          })}
          {mine.mines.length === 0 && (
            <p className="rounded-lg border border-dashed border-white/15 py-10 text-center text-sm text-white/30">광산이 없습니다. “광산 일괄 생성”을 눌러보세요.</p>
          )}
        </div>

        {/* 광산 지도 */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-white/70">🗺️ 광산 지도 <span className="text-xs font-normal text-white/35">(마커 {placedCount}/{mine.mines.length})</span></span>
            {mine.mapImage && (
              <button
                onClick={() => setEditMarkers((v) => !v)}
                className={`rounded-md border px-2 py-1 text-xs transition ${editMarkers ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-300" : "border-white/15 text-white/55 hover:text-white"}`}
              >
                {editMarkers ? "편집 완료" : "📍 마커 편집"}
              </button>
            )}
          </div>
          <MapPanel
            image={mine.mapImage}
            onFiles={setMap}
            onZoom={() => setZoom(true)}
            onRemove={() => update((d) => { d.mine.mapImage = null; })}
          >
            {showRoute && <RouteLayer coords={routeCoords} />}
            <MarkerLayer mines={sorted} now={now} editMode={editMarkers} onMove={moveMarker} onComplete={complete} />
          </MapPanel>
          {editMarkers && <p className="mt-1.5 text-xs text-emerald-300/70">마커를 드래그해 위치를 맞추세요.</p>}

          {/* 네비게이션 / 추천 동선 */}
          <div className="mt-3 rounded-xl border border-white/10 bg-[#15171c] p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-white/70">🧭 추천 동선 <span className="text-xs font-normal text-white/35">(시간 고려)</span></span>
              <div className="flex items-center gap-2 text-xs text-white/45">
                <label className="flex items-center gap-1">
                  <TextInput type="number" value={routeMin} onChange={(v) => setRouteMin(Number(v) || 0)} className="w-12 !py-0.5" />분 이내 포함
                </label>
                <button
                  onClick={() => setShowRoute((v) => !v)}
                  className={`rounded-md border px-2 py-1 transition ${showRoute ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-300" : "border-white/15 text-white/55 hover:text-white"}`}
                >
                  지도선 {showRoute ? "ON" : "OFF"}
                </button>
              </div>
            </div>
            {route.length === 0 ? (
              <p className="py-3 text-center text-xs text-white/30">
                마커가 있고 채굴 가능/임박한 광산이 있으면 가까운 순서로 동선을 추천해요.
              </p>
            ) : (
              <ol className="space-y-1">
                {route.map((c, i) => (
                  <li key={c.m.id} className="flex items-center gap-2 text-sm">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[11px] font-bold text-emerald-300">
                      {i + 1}
                    </span>
                    <button onClick={() => complete(c.m.id)} className="truncate font-medium text-white/85 hover:text-white" title="도착해서 캤으면 클릭(완료)">
                      {c.m.name}
                    </button>
                    <span className={`ml-auto shrink-0 text-xs ${c.r.ready ? "text-emerald-400" : "text-amber-300"}`}>
                      {c.r.ready ? "채굴 가능" : `약 ${Math.ceil(c.r.ms / 60000)}분 후`}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>

      {/* 확대 보기 (마커 표시) */}
      {zoom && mine.mapImage && (
        <div onClick={() => setZoom(false)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-6">
          <div className="relative max-h-full max-w-full" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mine.mapImage} alt="광산 지도" className="max-h-[88vh] max-w-full rounded-lg" />
            {showRoute && <RouteLayer coords={routeCoords} />}
            <MarkerLayer mines={sorted} now={now} editMode={false} onMove={moveMarker} onComplete={complete} large />
            <button onClick={() => setZoom(false)} className="absolute right-2 top-2 rounded bg-black/60 px-2 py-1 text-xs text-white">닫기 ✕</button>
          </div>
        </div>
      )}
    </div>
  );
}

type Decorated = { m: Mine; idx: number; r: { ready: boolean; ms: number; text: string } };

/** 가장 임박한 광산에서 출발해 최근접 이웃으로 잇는 추천 순회 경로 */
function planRoute(items: Decorated[]): Decorated[] {
  const remaining = items.slice();
  if (remaining.length === 0) return [];
  // 출발: 가장 임박(ms 최소)한 곳
  let startIdx = 0;
  for (let i = 1; i < remaining.length; i++) {
    if (remaining[i].r.ms < remaining[startIdx].r.ms) startIdx = i;
  }
  let cur = remaining.splice(startIdx, 1)[0];
  const route: Decorated[] = [cur];
  while (remaining.length) {
    let best = 0;
    let bestD = Infinity;
    for (let j = 0; j < remaining.length; j++) {
      const dx = (remaining[j].m.x as number) - (cur.m.x as number);
      const dy = (remaining[j].m.y as number) - (cur.m.y as number);
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = j;
      }
    }
    cur = remaining.splice(best, 1)[0];
    route.push(cur);
  }
  return route;
}

/** 추천 동선을 지도 위에 점선으로 그린다 */
function RouteLayer({ coords }: { coords: { x: number; y: number }[] }) {
  if (coords.length < 2) return null;
  const pts = coords.map((p) => `${p.x},${p.y}`).join(" ");
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      <polyline
        points={pts}
        fill="none"
        stroke="#34d399"
        strokeOpacity="0.9"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
        strokeDasharray="6 4"
      />
    </svg>
  );
}

function MarkerLayer({
  mines, now, editMode, onMove, onComplete, large = false,
}: {
  mines: Decorated[];
  now: number;
  editMode: boolean;
  onMove: (id: string, x: number, y: number) => void;
  onComplete: (id: string) => void;
  large?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  void now;

  function toPct(clientX: number, clientY: number) {
    const r = ref.current!.getBoundingClientRect();
    return { x: clamp(((clientX - r.left) / r.width) * 100), y: clamp(((clientY - r.top) / r.height) * 100) };
  }

  return (
    <div ref={ref} className="pointer-events-none absolute inset-0">
      {mines.map(({ m, idx, r }) => {
        if (m.x == null || m.y == null) return null;
        const x = drag?.id === m.id ? drag.x : m.x;
        const y = drag?.id === m.id ? drag.y : m.y;
        const size = large ? "h-7 min-w-7 text-xs" : "h-5 min-w-5 text-[10px]";
        const color = r.ready
          ? "bg-emerald-500 border-emerald-200 text-black"
          : "bg-amber-500/90 border-amber-200 text-black";
        return (
          <button
            key={m.id}
            style={{ left: `${x}%`, top: `${y}%` }}
            title={`${m.name} · ${r.text}${editMode ? " (드래그로 이동)" : " (클릭=완료)"}`}
            onPointerDown={(e) => {
              if (!editMode) return;
              e.preventDefault();
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              setDrag({ id: m.id, x: m.x!, y: m.y! });
            }}
            onPointerMove={(e) => { if (drag?.id === m.id) setDrag({ id: m.id, ...toPct(e.clientX, e.clientY) }); }}
            onPointerUp={(e) => {
              if (drag?.id === m.id) { onMove(m.id, drag.x, drag.y); setDrag(null); }
              (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
            }}
            onClick={() => { if (!editMode) onComplete(m.id); }}
            className={`pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border px-1 font-bold shadow ${size} ${color} ${editMode ? "cursor-grab active:cursor-grabbing ring-2 ring-white/40" : "cursor-pointer"} ${r.ready ? "animate-pulse" : ""} flex`}
          >
            {label(m, idx)}
          </button>
        );
      })}
    </div>
  );
}

function MapPanel({
  image, onFiles, onZoom, onRemove, children,
}: {
  image: string | null;
  onFiles: (files: FileList | File[]) => void;
  onZoom: () => void;
  onRemove: () => void;
  children?: React.ReactNode;
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
          {children}
          <div className="absolute right-2 top-2 z-10 flex gap-1 opacity-0 transition group-hover:opacity-100">
            <button onClick={onZoom} className="rounded bg-black/60 px-2 py-1 text-xs text-white hover:bg-black/80">크게</button>
            <button onClick={() => inputRef.current?.click()} className="rounded bg-black/60 px-2 py-1 text-xs text-white hover:bg-black/80">교체</button>
            <button onClick={onRemove} className="rounded bg-red-500/80 px-2 py-1 text-xs text-white hover:bg-red-500">삭제</button>
          </div>
        </div>
      ) : (
        <button onClick={() => inputRef.current?.click()} className="flex h-44 w-full flex-col items-center justify-center gap-1 text-center text-xs text-white/40">
          <span className="text-2xl">📌</span>
          <span>여기를 클릭 후 <b className="text-white/60">Ctrl+V</b>로 붙여넣기</span>
          <span>또는 드래그&드롭 · 클릭해서 파일 선택</span>
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files && onFiles(e.target.files)} />
    </div>
  );
}
