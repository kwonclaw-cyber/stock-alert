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
const numOr = (s: string): number | null => {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
};
const hasCoords = (m: Mine) => numOr(m.cx) != null && numOr(m.cz) != null;
const hasMarker = (m: Mine) => m.x != null && m.y != null;

export default function MinePage() {
  const { data, update } = useStore();
  const [now, setNow] = useState(() => Date.now());
  const [zoom, setZoom] = useState(false);
  const [editMarkers, setEditMarkers] = useState(false);
  const [genCount, setGenCount] = useState(40);
  const [showRoute, setShowRoute] = useState(true);

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

  // 동선: 좌표(게임 X/Z)가 2곳 이상 있으면 좌표 기준, 아니면 지도 마커 기준으로
  // 가장 임박한 곳에서 출발해 가까운 순서로 잇는 추천 순회 경로(최근접 이웃, 시간 고려).
  // 목표가 선택돼 있으면 그 광산들만, 없으면 전체 기준.
  const targetCount = sorted.filter((s) => s.m.target).length;
  const usingTargets = targetCount > 0;
  const set = usingTargets ? sorted.filter((s) => s.m.target) : sorted;
  const coordCands = set.filter((s) => hasCoords(s.m));
  const useCoords = coordCands.length >= 2;
  const route = useCoords
    ? nnRoute(coordCands, (d) => ({ x: numOr(d.m.cx)!, y: numOr(d.m.cz)! }))
    : nnRoute(set.filter((s) => hasMarker(s.m)), (d) => ({ x: d.m.x as number, y: d.m.y as number }));
  const imgLine = route.filter((s) => hasMarker(s.m)).map((s) => ({ x: s.m.x as number, y: s.m.y as number }));
  const coordRouteIds = useCoords ? route.map((s) => s.m.id) : [];

  async function setMap(files: FileList | File[]) {
    const f = Array.from(files).find((x) => x.type.startsWith("image/"));
    if (!f) return;
    const url = await fileToDataUrl(f);
    update((d) => { d.mine.mapImage = url; });
  }
  function generate() {
    update((d) => {
      d.mine.mines = Array.from({ length: Math.max(1, genCount) }, (_, i) => ({
        id: uid(), name: `광산${i + 1}`, cooldownMin: d.mine.defaultCooldownMin, lastDoneAt: null, x: null, y: null, cx: "", cy: "", cz: "", target: false,
      }));
    });
  }
  const complete = (id: string) => update((d) => { const m = d.mine.mines.find((x) => x.id === id); if (m) m.lastDoneAt = new Date().toISOString(); });
  const toggleTarget = (id: string) => update((d) => { const m = d.mine.mines.find((x) => x.id === id); if (m) m.target = !m.target; });
  const clearTargets = () => update((d) => { d.mine.mines.forEach((m) => { m.target = false; }); });
  const moveMarker = (id: string, x: number, y: number) => update((d) => { const m = d.mine.mines.find((x2) => x2.id === id); if (m) { m.x = x; m.y = y; } });
  const toggleMarker = (id: string) => update((d) => {
    const m = d.mine.mines.find((x) => x.id === id);
    if (!m) return;
    if (m.x == null) { m.x = 50; m.y = 50; } else { m.x = null; m.y = null; }
  });

  return (
    <div>
      <PageHelp>
        <b>완료</b>를 누르면 쿨타임만큼 잠기고, 목록은 <b>채굴 가능 → 남은시간순</b> 정렬돼요. 각 광산에 <b>X·Y·Z 좌표</b>를 넣으면 지도 이미지가 없어도 <b>좌표 미니맵</b>에 위치·동선이 표시돼요(좌표 2곳↑이면 좌표 기준 동선). 지도 이미지가 있으면 <b>📍</b>로 마커도 올릴 수 있어요. <b>네비등록</b>(여러 개)을 누르면 그 광산만, 없으면 전체 기준으로 동선을 그려줘요.
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
        <Btn variant="ghost" onClick={() => update((d) => { d.mine.mines.push({ id: uid(), name: `광산${d.mine.mines.length + 1}`, cooldownMin: d.mine.defaultCooldownMin, lastDoneAt: null, x: null, y: null, cx: "", cy: "", cz: "", target: false }); })}>
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
                <div className="flex items-center gap-1 text-xs text-white/40">
                  <span className="text-amber-300/70">좌표</span>
                  <TextInput value={m.cx} onChange={(v) => update((d) => { d.mine.mines[gi].cx = v; })} placeholder="X" className="w-12 !px-1 !py-1" />
                  <TextInput value={m.cy} onChange={(v) => update((d) => { d.mine.mines[gi].cy = v; })} placeholder="Y" className="w-12 !px-1 !py-1" />
                  <TextInput value={m.cz} onChange={(v) => update((d) => { d.mine.mines[gi].cz = v; })} placeholder="Z" className="w-12 !px-1 !py-1" />
                </div>
                <span className={`ml-auto min-w-24 text-right font-mono text-base font-bold ${r.ready ? "text-emerald-400" : "text-white"}`}>{r.text}</span>
                <button
                  onClick={() => toggleTarget(m.id)}
                  title={m.target ? "네비 등록 해제" : "네비에 등록(동선)"}
                  className={`rounded-md border px-2 py-1 text-xs transition ${m.target ? "border-amber-400/60 bg-amber-400/15 text-amber-200" : "border-white/15 text-white/50 hover:text-white"}`}
                >
                  {m.target ? "★ 네비등록" : "네비등록"}
                </button>
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
            {showRoute && <RouteLayer coords={imgLine} />}
            <MarkerLayer mines={sorted} now={now} editMode={editMarkers} onMove={moveMarker} onComplete={complete} />
          </MapPanel>
          {editMarkers && <p className="mt-1.5 text-xs text-emerald-300/70">마커를 드래그해 위치를 맞추세요.</p>}

          {/* 좌표 미니맵 (지도 이미지 없어도 좌표로 위치/동선 표시) */}
          <div className="mt-3">
            <CoordMap mines={sorted} routeIds={coordRouteIds} />
          </div>

          {/* 네비게이션 / 추천 동선 */}
          <div className="mt-3 rounded-xl border border-white/10 bg-[#15171c] p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-white/70">
                🧭 추천 동선{" "}
                <span className={`text-xs font-medium ${usingTargets ? "text-amber-300" : "text-white/35"}`}>
                  {usingTargets ? `네비 ${targetCount}곳` : `전체 ${route.length}곳`}
                </span>
                <span className="ml-1 text-[10px] text-white/30">· {useCoords ? "좌표 기준" : "지도 기준"}</span>
              </span>
              <div className="flex items-center gap-2 text-xs text-white/45">
                {usingTargets && (
                  <button onClick={clearTargets} className="rounded-md border border-white/15 px-2 py-1 text-white/55 hover:text-white">
                    네비 해제
                  </button>
                )}
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
                지도에 마커가 있으면 동선을 추천해요. 광산의 <b className="text-amber-300">네비등록</b>을 누르면 그 광산들만 동선에 반영돼요.
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
            {showRoute && <RouteLayer coords={imgLine} />}
            <MarkerLayer mines={sorted} now={now} editMode={false} onMove={moveMarker} onComplete={complete} large />
            <button onClick={() => setZoom(false)} className="absolute right-2 top-2 rounded bg-black/60 px-2 py-1 text-xs text-white">닫기 ✕</button>
          </div>
        </div>
      )}
    </div>
  );
}

type Decorated = { m: Mine; idx: number; r: { ready: boolean; ms: number; text: string } };

/** 좌표(게임 X·Z) 기반 미니맵. 지도 이미지가 없어도 좌표로 위치/동선을 표시한다. */
function CoordMap({ mines, routeIds }: { mines: Decorated[]; routeIds: string[] }) {
  const pts = mines.filter((s) => hasCoords(s.m)).map((s) => ({ s, gx: numOr(s.m.cx)!, gz: numOr(s.m.cz)! }));
  if (pts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/15 bg-[#15171c] p-4 text-center text-xs text-white/35">
        광산에 <b className="text-amber-300/80">좌표(X·Z)</b>를 입력하면 지도 이미지가 없어도 여기 <b>좌표 미니맵</b>에 위치·동선이 표시돼요.
      </div>
    );
  }
  const xs = pts.map((p) => p.gx);
  const zs = pts.map((p) => p.gz);
  let minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
  const padX = (maxX - minX) * 0.12 || 16;
  const padZ = (maxZ - minZ) * 0.12 || 16;
  minX -= padX; maxX += padX; minZ -= padZ; maxZ += padZ;
  const toX = (gx: number) => ((gx - minX) / (maxX - minX || 1)) * 100;
  const toY = (gz: number) => ((gz - minZ) / (maxZ - minZ || 1)) * 100;
  const lookup = new Map(pts.map((p) => [p.s.m.id, p]));
  const lineP = routeIds
    .map((id) => lookup.get(id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .map((p) => `${toX(p.gx)},${toY(p.gz)}`)
    .join(" ");

  return (
    <div className="rounded-xl border border-white/10 bg-[#15171c] p-2">
      <div className="mb-1 flex items-center justify-between px-1 text-xs">
        <span className="font-semibold text-white/70">🧭 좌표 미니맵</span>
        <span className="text-white/30">X {Math.round(minX)}~{Math.round(maxX)} · Z {Math.round(minZ)}~{Math.round(maxZ)}</span>
      </div>
      <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-white/10 bg-[#0e1014]">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          {[25, 50, 75].map((g) => (
            <g key={g} stroke="#ffffff14" strokeWidth="0.4">
              <line x1={g} y1="0" x2={g} y2="100" />
              <line x1="0" y1={g} x2="100" y2={g} />
            </g>
          ))}
          {lineP && (
            <polyline points={lineP} fill="none" stroke="#34d399" strokeOpacity="0.9" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeDasharray="6 4" />
          )}
        </svg>
        {pts.map(({ s, gx, gz }) => (
          <div
            key={s.m.id}
            style={{ left: `${toX(gx)}%`, top: `${toY(gz)}%` }}
            title={`${s.m.name} (X ${gx} · Z ${gz}) · ${s.r.text}`}
            className={`absolute flex h-5 min-w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border px-1 text-[10px] font-bold ${s.r.ready ? "bg-emerald-500 border-emerald-200 text-black" : "bg-amber-500/90 border-amber-200 text-black"} ${s.m.target ? "ring-2 ring-amber-300" : ""} ${s.r.ready ? "animate-pulse" : ""}`}
          >
            {label(s.m, s.idx)}
          </div>
        ))}
        <span className="absolute bottom-1 right-1 text-[9px] text-white/30">X→ · Z↓</span>
      </div>
    </div>
  );
}

/** 가장 임박한 광산에서 출발해 최근접 이웃으로 잇는 추천 순회 경로 (위치는 pos로 지정) */
function nnRoute(items: Decorated[], pos: (d: Decorated) => { x: number; y: number }): Decorated[] {
  const remaining = items.slice();
  if (remaining.length === 0) return [];
  let startIdx = 0;
  for (let i = 1; i < remaining.length; i++) {
    if (remaining[i].r.ms < remaining[startIdx].r.ms) startIdx = i;
  }
  let cur = remaining.splice(startIdx, 1)[0];
  const route: Decorated[] = [cur];
  while (remaining.length) {
    let best = 0;
    let bestD = Infinity;
    const cp = pos(cur);
    for (let j = 0; j < remaining.length; j++) {
      const p = pos(remaining[j]);
      const d = (p.x - cp.x) ** 2 + (p.y - cp.y) ** 2;
      if (d < bestD) { bestD = d; best = j; }
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
            className={`pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border px-1 font-bold shadow ${size} ${color} ${editMode ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"} ${m.target ? "ring-2 ring-amber-300 ring-offset-1 ring-offset-black/40" : editMode ? "ring-2 ring-white/40" : ""} ${r.ready ? "animate-pulse" : ""} flex`}
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
