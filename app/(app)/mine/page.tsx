"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "../../components/StoreProvider";
import { TextInput, Btn } from "../../components/fields";
import Loading from "../../components/Loading";
import PageHelp from "../../components/PageHelp";
import { fileToDataUrl } from "../../components/imageUtil";
import { uid, type Mine } from "@/lib/data";
import { confirmDelete } from "@/lib/confirmDelete";

function remain(lastDoneAt: string | null, cooldownMin: number, now: number) {
  if (!lastDoneAt || cooldownMin <= 0) return { ready: true, ms: -1, text: "가능" };
  const ms = new Date(lastDoneAt).getTime() + cooldownMin * 60_000 - now;
  if (ms <= 0) return { ready: true, ms: -1, text: "가능" };
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

// 네비 동선 그룹(1·2·3) 색상. 3명이 나눠 쓸 때 각자 색으로 구분된다.
const NAV_GROUPS = [1, 2, 3] as const;
const NAV_COLOR: Record<number, string> = { 1: "#34d399", 2: "#38bdf8", 3: "#fbbf24", 4: "#a78bfa", 5: "#fb923c" }; // 초록·파랑·주황·보라·오렌지
const NAV_BADGE: Record<number, string> = {
  1: "border-emerald-400/60 bg-emerald-400/15 text-emerald-200",
  2: "border-sky-400/60 bg-sky-400/15 text-sky-200",
  3: "border-amber-400/60 bg-amber-400/15 text-amber-200",
  4: "border-violet-400/60 bg-violet-400/15 text-violet-200",
  5: "border-orange-400/60 bg-orange-400/15 text-orange-200",
};

// 종류별 색 테마. 광산=초록, 채집장=분홍(rose), 양조장=금색(amber), 전초=청록(teal).
type Kind = "mine" | "gather" | "brew" | "outpost";
const KIND: Record<Kind, {
  label: string; icon: string;
  markerReady: string; // 지도 마커(완료 가능) 배경
  rowReady: string; // 리스트 행(완료 가능) 테두리/배경
  text: string; // 완료 가능 상태 글자색
  pill: string; // 종류 배지
  readyWord: string; // 완료 가능 문구
}> = {
  mine: {
    label: "광산", icon: "⛏",
    markerReady: "bg-emerald-500 border-emerald-200",
    rowReady: "border-emerald-400/50 bg-emerald-400/[0.06]",
    text: "text-emerald-400",
    pill: "border-emerald-400/50 bg-emerald-400/15 text-emerald-200",
    readyWord: "채굴 가능",
  },
  gather: {
    label: "채집", icon: "🌿",
    markerReady: "bg-rose-500 border-rose-200",
    rowReady: "border-rose-400/50 bg-rose-400/[0.06]",
    text: "text-rose-400",
    pill: "border-rose-400/50 bg-rose-400/15 text-rose-200",
    readyWord: "채집 가능",
  },
  brew: {
    label: "양조장", icon: "🍶",
    markerReady: "bg-amber-400 border-amber-100",
    rowReady: "border-amber-400/40 bg-amber-400/[0.06]",
    text: "text-amber-300",
    pill: "border-amber-400/60 bg-amber-400/15 text-amber-200",
    readyWord: "양조장",
  },
  outpost: {
    label: "전초", icon: "🚩",
    markerReady: "bg-teal-400 border-teal-100",
    rowReady: "border-teal-400/40 bg-teal-400/[0.06]",
    text: "text-teal-300",
    pill: "border-teal-400/60 bg-teal-400/15 text-teal-200",
    readyWord: "전초",
  },
};
const kindOf = (m: Mine): (typeof KIND)[Kind] => KIND[(m.kind ?? "mine") as Kind] ?? KIND.mine;

// 네비는 쿨타임(appdata)과 별도 키(/api/nav?party=)로 파티별 공유한다.
// → 쿨타임 저장이 네비를 덮어쓰지 않고, 파티마다 별도 동선을 가진다.
const PARTIES = ["1", "2", "3", "4"] as const;

export default function MinePage() {
  const { data, update } = useStore();
  const [now, setNow] = useState(() => Date.now());
  const [zoom, setZoom] = useState(false);
  const [editMarkers, setEditMarkers] = useState(false);
  const [genCount, setGenCount] = useState(40);
  const [showRoute, setShowRoute] = useState(true);
  // 출발: 전초(또는 내 위치)에서 광산/채집장 한 바퀴 동선 생성
  const [myX, setMyX] = useState("");
  const [myZ, setMyZ] = useState("");
  const [startOutpostId, setStartOutpostId] = useState("");
  const [tripKind, setTripKind] = useState<"" | "mine" | "gather">("");
  const [navMap, setNavMap] = useState<Record<string, number>>({}); // 파티 공유 네비(/api/nav)
  const [party, setParty] = useState("1"); // 내가 속한 파티(로컬 선택)
  const navEditedAt = useRef(0); // 최근 네비 편집 시각(편집 직후 폴링 덮어쓰기 방지)

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  // 저장된 파티 선택 불러오기
  useEffect(() => {
    try { const p = localStorage.getItem("mine-party"); if (p && /^[1-6]$/.test(p)) setParty(p); } catch { /* 무시 */ }
  }, []);
  // 선택한 파티의 공유 네비 로드 + 주기 폴링 (편집 직후 1.5초는 폴링 결과 무시)
  useEffect(() => {
    let alive = true;
    setNavMap({}); // 파티 전환 시 잠깐 비움
    const pull = async () => {
      if (Date.now() - navEditedAt.current < 1500) return;
      try {
        const r = await fetch(`/api/nav?party=${party}`);
        const m = (await r.json()) as Record<string, number>;
        if (alive && Date.now() - navEditedAt.current >= 1500) setNavMap(m || {});
      } catch { /* 무시 */ }
    };
    pull();
    const id = setInterval(pull, 3000);
    return () => { alive = false; clearInterval(id); };
  }, [party]);

  if (!data) return <Loading />;
  const mine = data.mine;

  // 네비(nav)는 로컬 navMap에서 덮어쓴다. (KV의 m.nav는 사용하지 않음)
  const decoratedAll = mine.mines.map((m, idx) => ({ m: { ...m, nav: navMap[m.id] ?? 0 }, idx, r: remain(m.lastDoneAt, m.cooldownMin, now) }));
  // 타이머 대상(광산·채집장)만 시간순 정렬. 양조장·전초는 위치 지점이라 타이머에서 제외.
  const sorted = decoratedAll.filter((s) => s.m.kind === "mine" || s.m.kind === "gather").sort((a, z) => a.r.ms - z.r.ms);
  // 목록은 광산/채집장을 각각 임박순으로 따로 정렬해 구분 표시
  const mineList = decoratedAll.filter((s) => s.m.kind === "mine").sort((a, z) => a.r.ms - z.r.ms);
  const gatherList = decoratedAll.filter((s) => s.m.kind === "gather").sort((a, z) => a.r.ms - z.r.ms);
  const brews = decoratedAll.filter((s) => s.m.kind === "brew");
  const outposts = decoratedAll.filter((s) => s.m.kind === "outpost");

  const readyCount = sorted.filter((x) => x.r.ready).length;
  const placedCount = mine.mines.filter((m) => m.x != null && !hasCoords(m)).length;

  // 출발지(전초 우선, 없으면 내 위치) 좌표/마커 계산
  const startOutpost = outposts.find((o) => o.m.id === startOutpostId)?.m;
  const startGame: { x: number; y: number } | null =
    startOutpost && hasCoords(startOutpost)
      ? { x: numOr(startOutpost.cx)!, y: numOr(startOutpost.cz)! }
      : numOr(myX) != null && numOr(myZ) != null
      ? { x: numOr(myX)!, y: numOr(myZ)! }
      : null;
  const startMarker: { x: number; y: number } | null =
    startOutpost && hasMarker(startOutpost)
      ? { x: startOutpost.x as number, y: startOutpost.y as number }
      : null;
  const startName = startOutpost ? startOutpost.name : startGame ? "내 위치" : "";

  // 동선: 좌표(게임 X/Z)가 2곳 이상 있으면 좌표 기준, 아니면 지도 마커 기준.
  // 출발지가 지정되면 그 지점에서 가장 가까운 곳부터, 아니면 가장 임박한 곳부터 잇는다.
  // 채집장이 포함된 동선은 마지막 지점에서 가장 가까운 '양조장'을 종착지로 추가한다.
  function buildRoute(items: Decorated[], sGame: { x: number; y: number } | null, sMarker: { x: number; y: number } | null) {
    const coordCands = items.filter((s) => hasCoords(s.m));
    const useCoords = coordCands.length >= 2;
    const pos = useCoords
      ? (d: Decorated) => ({ x: numOr(d.m.cx)!, y: numOr(d.m.cz)! })
      : (d: Decorated) => ({ x: d.m.x as number, y: d.m.y as number });
    const startPt = useCoords ? sGame : sMarker;
    let r = useCoords
      ? nnRoute(coordCands, pos, startPt)
      : nnRoute(items.filter((s) => hasMarker(s.m)), pos, startPt);

    // 채집장이 하나라도 있으면 → 마지막 지점에서 가까운 양조장으로 복귀
    const hasGather = items.some((s) => s.m.kind === "gather");
    const brewCands = brews.filter((b) => (useCoords ? hasCoords(b.m) : hasMarker(b.m)));
    if (hasGather && r.length > 0 && brewCands.length > 0) {
      const lp = pos(r[r.length - 1]);
      let best = brewCands[0];
      let bestD = Infinity;
      for (const b of brewCands) {
        const p = pos(b);
        const d = (p.x - lp.x) ** 2 + (p.y - lp.y) ** 2;
        if (d < bestD) { bestD = d; best = b; }
      }
      r = [...r, best];
    }
    const imgStart = !useCoords && sMarker ? [{ x: sMarker.x, y: sMarker.y }] : [];
    return {
      route: r,
      imgLine: [...imgStart, ...r.filter((s) => hasMarker(s.m) && !hasCoords(s.m)).map((s) => ({ x: s.m.x as number, y: s.m.y as number }))],
      coordIds: useCoords ? r.map((s) => s.m.id) : [],
      coordStart: useCoords && sGame ? sGame : null,
    };
  }

  const usedGroups = NAV_GROUPS.filter((g) => sorted.some((s) => s.m.nav === g));
  // 출발(전초→광산/채집 한바퀴) 모드면 단일 동선, 아니면 네비 그룹별 동선
  type RouteGroup = { nav: number; color: string; startName: string } & ReturnType<typeof buildRoute>;
  let routeGroups: RouteGroup[];
  const usingNav = !tripKind && usedGroups.length > 0;
  if (tripKind) {
    const items = tripKind === "mine" ? mineList : gatherList;
    routeGroups = [{ nav: 0, color: tripKind === "gather" ? "#fb7185" : "#34d399", startName, ...buildRoute(items, startGame, startMarker) }];
  } else if (usedGroups.length > 0) {
    routeGroups = usedGroups.map((g) => ({ nav: g as number, color: NAV_COLOR[g], startName: "", ...buildRoute(sorted.filter((s) => s.m.nav === g), null, null) }));
  } else {
    routeGroups = [{ nav: 0, color: "#34d399", startName: "", ...buildRoute(sorted, null, null) }];
  }
  const totalRouteCount = routeGroups.reduce((n, g) => n + g.route.length, 0);
  // 좌표맵/지도에 넘길 색상별 동선
  const coordRoutes = routeGroups.map((g) => ({ color: g.color, ids: g.coordIds, start: g.coordStart }));
  const imgRoutes = routeGroups.map((g) => ({ color: g.color, line: g.imgLine }));

  async function setMap(files: FileList | File[]) {
    const f = Array.from(files).find((x) => x.type.startsWith("image/"));
    if (!f) return;
    const url = await fileToDataUrl(f);
    update((d) => { d.mine.mapImage = url; });
  }
  function generate() {
    update((d) => {
      const gathers = d.mine.mines.filter((m) => m.kind === "gather"); // 채집장은 유지
      d.mine.mines = [
        ...Array.from({ length: Math.max(1, genCount) }, (_, i) => ({
          id: uid(), name: `광산${i + 1}`, kind: "mine" as const, cooldownMin: d.mine.defaultCooldownMin, lastDoneAt: null, x: null, y: null, cx: "", cy: "", cz: "", nav: 0,
        })),
        ...gathers,
      ];
    });
  }
  const complete = (id: string) => update((d) => { const m = d.mine.mines.find((x) => x.id === id); if (m) m.lastDoneAt = new Date().toISOString(); });
  // 네비는 별도 키(/api/nav?party=)로 파티별 공유 저장 — 쿨타임 저장과 충돌하지 않음
  const saveNav = (next: Record<string, number>) => {
    navEditedAt.current = Date.now();
    setNavMap(next);
    fetch(`/api/nav?party=${party}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) }).catch(() => {});
  };
  const pickParty = (p: string) => { setParty(p); try { localStorage.setItem("mine-party", p); } catch { /* 무시 */ } };
  const setNav = (id: string, g: number) => saveNav({ ...navMap, [id]: (navMap[id] ?? 0) === g ? 0 : g });
  const clearNav = () => saveNav({});
  const moveMarker = (id: string, x: number, y: number) => update((d) => { const m = d.mine.mines.find((x2) => x2.id === id); if (m) { m.x = x; m.y = y; } });
  const toggleMarker = (id: string) => update((d) => {
    const m = d.mine.mines.find((x) => x.id === id);
    if (!m) return;
    if (m.x == null) { m.x = 50; m.y = 50; } else { m.x = null; m.y = null; }
  });

  // 광산·채집장 타이머 행 (목록에서 종류별 섹션으로 재사용)
  function timerRow({ m, idx, r }: Decorated) {
    const gi = mine.mines.findIndex((x) => x.id === m.id);
    const k = kindOf(m);
    void idx;
    return (
      <div key={m.id} className={`flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2 ${r.ready ? k.rowReady : "border-white/10 bg-[#15171c]"}`}>
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
        <span className={`ml-auto min-w-24 text-right font-mono text-base font-bold ${r.ready ? k.text : "text-white"}`}>{r.ready ? k.readyWord : r.text}</span>
        <div className="flex items-center gap-1" title="네비 동선 그룹(1~5)에 등록 / 다시 누르면 해제">
          <span className="text-[10px] text-white/35">네비</span>
          {NAV_GROUPS.map((g) => (
            <button
              key={g}
              onClick={() => setNav(m.id, g)}
              title={m.nav === g ? `네비${g} 해제` : `네비${g}에 등록`}
              className={`h-7 w-7 rounded-md border text-xs transition ${m.nav === g ? NAV_BADGE[g] : "border-white/15 text-white/40 hover:text-white"}`}
            >
              {g}
            </button>
          ))}
        </div>
        <Btn variant="primary" onClick={() => complete(m.id)} className="!py-1 !text-xs">완료</Btn>
        <button onClick={() => update((d) => { d.mine.mines[gi].lastDoneAt = null; })} className="text-sm text-white/40 hover:text-white" title="리셋(쿨타임 초기화)">↩️</button>
        <button onClick={() => { if (confirmDelete("삭제할까요?")) update((d) => { d.mine.mines.splice(gi, 1); }); }} className="text-red-300/50 hover:text-red-300" title="삭제">×</button>
      </div>
    );
  }

  return (
    <div>
      <PageHelp>
        <b className="text-emerald-300">⛏ 광산</b>·<b className="text-rose-300">🌿 채집장</b>을 함께 관리해요. <b>완료</b>를 누르면 쿨타임만큼 잠기고 <b>가능 → 남은시간순</b> 정렬돼요. <b>위치는 좌표(X·Z)가 최우선</b>(좌표 미니맵에 표시), 좌표가 없으면 <b>지도 이미지의 📍마커</b>로 표시돼요(차선). <b>쿨타임(완료)</b>도 <b>네비</b>도 길드/파티에 <b>실시간 공유</b>돼요(서로 따로 저장돼 충돌 없음). <b>네비 1~3</b>으로 동선을 나누면 <b>광산·채집장이 섞여</b> 한 동선에 나오고, <b className="text-amber-300">🍶 양조장</b>을 지정하면 채집 동선은 <b>가장 가까운 양조장</b>이 도착지로 붙어요.
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
        <Btn variant="ghost" onClick={() => update((d) => { const n = d.mine.mines.filter((m) => m.kind !== "gather").length + 1; d.mine.mines.push({ id: uid(), name: `광산${n}`, kind: "mine", cooldownMin: d.mine.defaultCooldownMin, lastDoneAt: null, x: null, y: null, cx: "", cy: "", cz: "", nav: 0 }); })}>
          + 광산 추가
        </Btn>
        <Btn variant="ghost" onClick={() => update((d) => { const n = d.mine.mines.filter((m) => m.kind === "gather").length + 1; d.mine.mines.push({ id: uid(), name: `채집장${n}`, kind: "gather", cooldownMin: d.mine.defaultCooldownMin, lastDoneAt: null, x: null, y: null, cx: "", cy: "", cz: "", nav: 0 }); })}>
          + 채집장 추가
        </Btn>
        <Btn variant="ghost" onClick={() => update((d) => { const n = d.mine.mines.filter((m) => m.kind === "brew").length + 1; d.mine.mines.push({ id: uid(), name: `양조장${n}`, kind: "brew", cooldownMin: 0, lastDoneAt: null, x: null, y: null, cx: "", cy: "", cz: "", nav: 0 }); })}>
          + 양조장 추가
        </Btn>
        <Btn variant="ghost" onClick={() => update((d) => { const n = d.mine.mines.filter((m) => m.kind === "outpost").length + 1; d.mine.mines.push({ id: uid(), name: `전초${n}`, kind: "outpost", cooldownMin: 0, lastDoneAt: null, x: null, y: null, cx: "", cy: "", cz: "", nav: 0 }); })}>
          + 전초 추가
        </Btn>
        <div className="ml-auto rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm">
          <span className="text-white/60">완료 가능</span> <b className="text-emerald-300">{readyCount}</b> / {sorted.length}
        </div>
      </div>

      {/* 내 파티 선택 (파티별로 네비가 따로 공유됨) */}
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-sky-400/25 bg-sky-400/[0.05] px-3 py-2 text-sm">
        <span className="font-semibold text-sky-200">👥 내 파티</span>
        {PARTIES.map((p) => (
          <button
            key={p}
            onClick={() => pickParty(p)}
            className={`h-7 w-9 rounded-md border text-xs font-bold transition ${party === p ? "border-sky-400/60 bg-sky-400/15 text-sky-200" : "border-white/15 text-white/50 hover:text-white"}`}
          >
            {p}
          </button>
        ))}
        <span className="text-[11px] text-white/35">파티마다 네비가 따로 공유돼요. 같은 파티원끼리 같은 번호를 고르면 네비를 함께 봐요. (쿨타임은 전체 공유)</span>
      </div>

      {/* 출발: 전초(또는 내 위치) 선택 후 광산/채집장 한바퀴 동선 생성 */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-teal-400/25 bg-teal-400/[0.05] px-3 py-2 text-sm">
        <span className="font-semibold text-teal-200">🚩 출발 전초</span>
        {outposts.length === 0 ? (
          <span className="text-xs text-white/35">‘+ 전초 추가’로 출발점을 만들어 좌표/마커를 지정하세요.</span>
        ) : (
          outposts.map((o) => (
            <button
              key={o.m.id}
              onClick={() => setStartOutpostId((id) => (id === o.m.id ? "" : o.m.id))}
              className={`rounded-md border px-2 py-1 text-xs transition ${startOutpostId === o.m.id ? "border-teal-400/60 bg-teal-400/15 text-teal-200" : "border-white/15 text-white/50 hover:text-white"}`}
            >
              {o.m.name}
            </button>
          ))
        )}
        <span className="flex items-center gap-1 text-xs text-white/40">
          또는 내 위치 X<TextInput value={myX} onChange={setMyX} placeholder="X" className="w-14 !px-1 !py-1" />
          Z<TextInput value={myZ} onChange={setMyZ} placeholder="Z" className="w-14 !px-1 !py-1" />
        </span>
        <span className="mx-1 h-4 w-px bg-white/10" />
        <button
          onClick={() => setTripKind((k) => (k === "mine" ? "" : "mine"))}
          className={`rounded-md border px-2.5 py-1 text-xs font-bold transition ${tripKind === "mine" ? "border-emerald-400/60 bg-emerald-400/15 text-emerald-200" : "border-white/15 text-white/55 hover:text-white"}`}
        >
          ⛏ 광산 출발
        </button>
        <button
          onClick={() => setTripKind((k) => (k === "gather" ? "" : "gather"))}
          className={`rounded-md border px-2.5 py-1 text-xs font-bold transition ${tripKind === "gather" ? "border-rose-400/60 bg-rose-400/15 text-rose-200" : "border-white/15 text-white/55 hover:text-white"}`}
        >
          🌿 채집장 출발
        </button>
        {tripKind && <button onClick={() => setTripKind("")} className="rounded-md border border-white/15 px-2 py-1 text-xs text-white/45 hover:text-white">동선 끄기</button>}
        {tripKind && !startName && <span className="text-[11px] text-amber-300/80">전초를 선택하거나 내 위치를 입력하면 출발지부터 동선이 그려져요.</span>}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* 광산 리스트 */}
        <div className="space-y-2">
          {mineList.length > 0 && (
            <>
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">⛏ 광산 <span className="font-normal text-white/35">임박순 · {mineList.length}곳</span></div>
              {mineList.map(timerRow)}
            </>
          )}
          {gatherList.length > 0 && (
            <>
              <div className="mt-3 flex items-center gap-2 text-xs font-bold text-rose-300">🌿 채집장 <span className="font-normal text-white/35">임박순 · {gatherList.length}곳</span></div>
              {gatherList.map(timerRow)}
            </>
          )}
          {mineList.length === 0 && gatherList.length === 0 && (
            <p className="rounded-lg border border-dashed border-white/15 py-10 text-center text-sm text-white/30">광산·채집장이 없습니다. “광산 일괄 생성” 또는 “+ 채집장 추가”를 눌러보세요.</p>
          )}

          {/* 양조장 (도착지) */}
          {brews.length > 0 && (
            <div className="mt-4 space-y-2">
              <div className="text-xs font-bold text-amber-300">🍶 양조장 (채집장 동선의 도착지)</div>
              {brews.map(({ m }) => {
                const gi = mine.mines.findIndex((x) => x.id === m.id);
                return (
                  <div key={m.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-400/30 bg-amber-400/[0.05] px-3 py-2">
                    <span className="shrink-0 rounded-md border border-amber-400/60 bg-amber-400/15 px-1.5 py-0.5 text-[11px] font-bold text-amber-200">🍶 양조장</span>
                    <button
                      onClick={() => toggleMarker(m.id)}
                      className={`text-base transition ${m.x != null ? "opacity-100" : "opacity-30 grayscale hover:opacity-60"}`}
                      title={m.x != null ? "지도에서 제거" : "지도에 마커 올리기"}
                    >📍</button>
                    <TextInput value={m.name} onChange={(v) => update((d) => { d.mine.mines[gi].name = v; })} className="w-28 font-semibold" />
                    <div className="flex items-center gap-1 text-xs text-white/40">
                      <span className="text-amber-300/70">좌표</span>
                      <TextInput value={m.cx} onChange={(v) => update((d) => { d.mine.mines[gi].cx = v; })} placeholder="X" className="w-12 !px-1 !py-1" />
                      <TextInput value={m.cy} onChange={(v) => update((d) => { d.mine.mines[gi].cy = v; })} placeholder="Y" className="w-12 !px-1 !py-1" />
                      <TextInput value={m.cz} onChange={(v) => update((d) => { d.mine.mines[gi].cz = v; })} placeholder="Z" className="w-12 !px-1 !py-1" />
                    </div>
                    <button onClick={() => { if (confirmDelete("삭제할까요?")) update((d) => { d.mine.mines.splice(gi, 1); }); }} className="ml-auto text-red-300/50 hover:text-red-300" title="삭제">×</button>
                  </div>
                );
              })}
            </div>
          )}

          {/* 전초 (출발점) */}
          {outposts.length > 0 && (
            <div className="mt-4 space-y-2">
              <div className="text-xs font-bold text-teal-300">🚩 전초 (동선 출발점)</div>
              {outposts.map(({ m }) => {
                const gi = mine.mines.findIndex((x) => x.id === m.id);
                return (
                  <div key={m.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-teal-400/30 bg-teal-400/[0.05] px-3 py-2">
                    <span className="shrink-0 rounded-md border border-teal-400/60 bg-teal-400/15 px-1.5 py-0.5 text-[11px] font-bold text-teal-200">🚩 전초</span>
                    <button
                      onClick={() => toggleMarker(m.id)}
                      className={`text-base transition ${m.x != null ? "opacity-100" : "opacity-30 grayscale hover:opacity-60"}`}
                      title={m.x != null ? "지도에서 제거" : "지도에 마커 올리기"}
                    >📍</button>
                    <TextInput value={m.name} onChange={(v) => update((d) => { d.mine.mines[gi].name = v; })} className="w-28 font-semibold" />
                    <div className="flex items-center gap-1 text-xs text-white/40">
                      <span className="text-teal-300/70">좌표</span>
                      <TextInput value={m.cx} onChange={(v) => update((d) => { d.mine.mines[gi].cx = v; })} placeholder="X" className="w-12 !px-1 !py-1" />
                      <TextInput value={m.cy} onChange={(v) => update((d) => { d.mine.mines[gi].cy = v; })} placeholder="Y" className="w-12 !px-1 !py-1" />
                      <TextInput value={m.cz} onChange={(v) => update((d) => { d.mine.mines[gi].cz = v; })} placeholder="Z" className="w-12 !px-1 !py-1" />
                    </div>
                    <button onClick={() => { if (confirmDelete("삭제할까요?")) update((d) => { d.mine.mines.splice(gi, 1); }); }} className="ml-auto text-red-300/50 hover:text-red-300" title="삭제">×</button>
                  </div>
                );
              })}
            </div>
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
            onRemove={() => { if (confirmDelete("지도 이미지를 삭제할까요?")) update((d) => { d.mine.mapImage = null; }); }}
          >
            {showRoute && imgRoutes.map((g, i) => <RouteLayer key={i} coords={g.line} color={g.color} />)}
            <MarkerLayer mines={decoratedAll} now={now} editMode={editMarkers} onMove={moveMarker} onComplete={complete} />
          </MapPanel>
          {editMarkers && <p className="mt-1.5 text-xs text-emerald-300/70">마커를 드래그해 위치를 맞추세요.</p>}

          {/* 좌표 미니맵 (지도 이미지 없어도 좌표로 위치/동선 표시) */}
          <div className="mt-3">
            <CoordMap mines={decoratedAll} routes={coordRoutes} />
          </div>

          {/* 네비게이션 / 추천 동선 */}
          <div className="mt-3 rounded-xl border border-white/10 bg-[#15171c] p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-white/70">
                🧭 추천 동선{" "}
                <span className={`text-xs font-medium ${tripKind ? "text-teal-300" : usingNav ? "text-amber-300" : "text-white/35"}`}>
                  {tripKind
                    ? `${tripKind === "mine" ? "광산" : "채집장"} 출발${startName ? ` · ${startName}부터` : ""} · ${totalRouteCount}곳`
                    : usingNav ? `네비 ${usedGroups.length}개 · ${totalRouteCount}곳` : `전체 ${totalRouteCount}곳`}
                </span>
              </span>
              <div className="flex items-center gap-2 text-xs text-white/45">
                {usingNav && (
                  <button onClick={clearNav} className="rounded-md border border-white/15 px-2 py-1 text-white/55 hover:text-white">
                    네비 전체해제
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
            {totalRouteCount === 0 ? (
              <p className="py-3 text-center text-xs text-white/30">
                각 광산·채집장의 <b className="text-amber-300">네비 1~3</b> 버튼을 누르면 사람별로 동선을 나눠 그려줘요. (없으면 전체 기준)
              </p>
            ) : (
              <div className="space-y-3">
                {routeGroups.map((g) =>
                  g.route.length === 0 ? null : (
                    <div key={g.nav}>
                      {usingNav && (
                        <div className="mb-1 flex items-center gap-1.5 text-xs font-bold" style={{ color: g.color }}>
                          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: g.color }} />
                          네비{g.nav} · {g.route.length}곳
                        </div>
                      )}
                      <ol className="space-y-1">
                        {g.startName && (
                          <li className="flex items-center gap-2 text-sm">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-400 text-[11px] font-bold text-black">🚩</span>
                            <span className="truncate font-bold text-teal-200">{g.startName} <span className="text-teal-300/70">(출발)</span></span>
                          </li>
                        )}
                        {g.route.map((c, i) => {
                          const isBrew = c.m.kind === "brew";
                          return (
                          <li key={c.m.id} className="flex items-center gap-2 text-sm">
                            <span
                              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-black"
                              style={{ backgroundColor: isBrew ? "#fbbf24" : g.color }}
                            >
                              {isBrew ? "🍶" : i + 1}
                            </span>
                            {isBrew ? (
                              <span className="truncate font-bold text-amber-200">{c.m.name} <span className="text-amber-300/70">(도착지)</span></span>
                            ) : (
                              <button onClick={() => complete(c.m.id)} className="truncate font-medium text-white/85 hover:text-white" title="도착해서 완료했으면 클릭">
                                <span className="mr-0.5">{kindOf(c.m).icon}</span>{c.m.name}
                              </button>
                            )}
                            <span className={`ml-auto shrink-0 text-xs ${isBrew ? "text-amber-300" : c.r.ready ? kindOf(c.m).text : "text-amber-300"}`}>
                              {isBrew ? "🍶 양조장" : c.r.ready ? kindOf(c.m).readyWord : `약 ${Math.ceil(c.r.ms / 60000)}분 후`}
                            </span>
                          </li>
                          );
                        })}
                      </ol>
                    </div>
                  ),
                )}
              </div>
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
            {showRoute && imgRoutes.map((g, i) => <RouteLayer key={i} coords={g.line} color={g.color} />)}
            <MarkerLayer mines={decoratedAll} now={now} editMode={false} onMove={moveMarker} onComplete={complete} large />
            <button onClick={() => setZoom(false)} className="absolute right-2 top-2 rounded bg-black/60 px-2 py-1 text-xs text-white">닫기 ✕</button>
          </div>
        </div>
      )}
    </div>
  );
}

type Decorated = { m: Mine; idx: number; r: { ready: boolean; ms: number; text: string } };

/** 좌표(게임 X·Z) 기반 미니맵. 지도 이미지가 없어도 좌표로 위치/동선을 표시한다. */
function CoordMap({ mines, routes }: { mines: Decorated[]; routes: { color: string; ids: string[]; start: { x: number; y: number } | null }[] }) {
  const pts = mines.filter((s) => hasCoords(s.m)).map((s) => ({ s, gx: numOr(s.m.cx)!, gz: numOr(s.m.cz)! }));
  const starts = routes.map((r) => r.start).filter((s): s is { x: number; y: number } => Boolean(s));
  if (pts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/15 bg-[#15171c] p-4 text-center text-xs text-white/35">
        광산·채집장에 <b className="text-amber-300/80">좌표(X·Z)</b>를 입력하면 지도 이미지가 없어도 여기 <b>좌표 미니맵</b>에 위치·동선이 표시돼요.
      </div>
    );
  }
  const xs = [...pts.map((p) => p.gx), ...starts.map((s) => s.x)];
  const zs = [...pts.map((p) => p.gz), ...starts.map((s) => s.y)];
  let minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
  const padX = (maxX - minX) * 0.12 || 16;
  const padZ = (maxZ - minZ) * 0.12 || 16;
  minX -= padX; maxX += padX; minZ -= padZ; maxZ += padZ;
  const toX = (gx: number) => ((gx - minX) / (maxX - minX || 1)) * 100;
  const toY = (gz: number) => ((gz - minZ) / (maxZ - minZ || 1)) * 100;
  const lookup = new Map(pts.map((p) => [p.s.m.id, p]));
  const lines = routes.map((rt) => {
    const pp = rt.ids
      .map((id) => lookup.get(id))
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .map((p) => `${toX(p.gx)},${toY(p.gz)}`);
    if (rt.start) pp.unshift(`${toX(rt.start.x)},${toY(rt.start.y)}`); // 출발지에서 선 시작
    return { color: rt.color, pts: pp.join(" ") };
  });

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
          {lines.map((ln, i) =>
            ln.pts ? (
              <polyline key={i} points={ln.pts} fill="none" stroke={ln.color} strokeOpacity="0.9" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeDasharray="6 4" />
            ) : null,
          )}
        </svg>
        {pts.map(({ s, gx, gz }) => {
          const isLoc = s.m.kind === "brew" || s.m.kind === "outpost";
          const fill = s.m.kind === "brew" ? "bg-amber-400 border-amber-100 text-black"
            : s.m.kind === "outpost" ? "bg-teal-400 border-teal-100 text-black"
            : s.r.ready ? `${kindOf(s.m).markerReady} text-black` : "bg-amber-500/90 border-amber-200 text-black";
          const glyph = s.m.kind === "brew" ? "🍶" : s.m.kind === "outpost" ? "🚩" : label(s.m, s.idx);
          return (
            <div
              key={s.m.id}
              style={{ left: `${toX(gx)}%`, top: `${toY(gz)}%`, boxShadow: s.m.nav ? `0 0 0 2px ${NAV_COLOR[s.m.nav]}` : undefined }}
              title={`${kindOf(s.m).label} · ${s.m.name} (X ${gx} · Z ${gz})${isLoc ? "" : ` · ${s.r.text}`}${s.m.nav ? ` · 네비${s.m.nav}` : ""}`}
              className={`absolute flex h-5 min-w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border px-1 text-[10px] font-bold ${fill} ${!isLoc && s.r.ready ? "animate-pulse" : ""}`}
            >
              {glyph}
            </div>
          );
        })}
        {starts.map((st, i) => (
          <div
            key={`start-${i}`}
            style={{ left: `${toX(st.x)}%`, top: `${toY(st.y)}%` }}
            title={`출발지 (X ${st.x} · Z ${st.y})`}
            className="absolute -translate-x-1/2 -translate-y-1/2 text-sm"
          >
            🧍
          </div>
        ))}
        <span className="absolute bottom-1 right-1 text-[9px] text-white/30">X→ · Z↓</span>
      </div>
    </div>
  );
}

/** 추천 순회 경로(최근접 이웃). 출발지(start)가 있으면 가장 가까운 곳부터, 없으면 가장 임박한 곳부터. */
function nnRoute(items: Decorated[], pos: (d: Decorated) => { x: number; y: number }, start?: { x: number; y: number } | null): Decorated[] {
  const remaining = items.slice();
  if (remaining.length === 0) return [];
  let startIdx = 0;
  if (start) {
    let bestD = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const p = pos(remaining[i]);
      const d = (p.x - start.x) ** 2 + (p.y - start.y) ** 2;
      if (d < bestD) { bestD = d; startIdx = i; }
    }
  } else {
    for (let i = 1; i < remaining.length; i++) {
      if (remaining[i].r.ms < remaining[startIdx].r.ms) startIdx = i;
    }
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
function RouteLayer({ coords, color = "#34d399" }: { coords: { x: number; y: number }[]; color?: string }) {
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
        stroke={color}
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
        if (hasCoords(m)) return null; // 좌표가 있으면 좌표 미니맵에 표시(우선), 지도 이미지엔 안 띄움
        const x = drag?.id === m.id ? drag.x : m.x;
        const y = drag?.id === m.id ? drag.y : m.y;
        const size = large ? "h-7 min-w-7 text-xs" : "h-5 min-w-5 text-[10px]";
        const isLoc = m.kind === "brew" || m.kind === "outpost";
        const color = m.kind === "brew"
          ? "bg-amber-400 border-amber-100 text-black"
          : m.kind === "outpost"
          ? "bg-teal-400 border-teal-100 text-black"
          : r.ready
          ? `${kindOf(m).markerReady} text-black`
          : "bg-amber-500/90 border-amber-200 text-black";
        const glyph = m.kind === "brew" ? "🍶" : m.kind === "outpost" ? "🚩" : label(m, idx);
        return (
          <button
            key={m.id}
            title={`${kindOf(m).label} · ${m.name}${isLoc ? "" : ` · ${r.text}`}${m.nav ? ` · 네비${m.nav}` : ""}${editMode ? " (드래그로 이동)" : isLoc ? "" : " (클릭=완료)"}`}
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
            onClick={() => { if (!editMode && !isLoc) onComplete(m.id); }}
            style={{ left: `${x}%`, top: `${y}%`, boxShadow: m.nav ? `0 0 0 2px ${NAV_COLOR[m.nav]}` : undefined }}
            className={`pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border px-1 font-bold shadow ${size} ${color} ${editMode ? "cursor-grab active:cursor-grabbing" : isLoc ? "cursor-default" : "cursor-pointer"} ${!m.nav && editMode ? "ring-2 ring-white/40" : ""} ${!isLoc && r.ready ? "animate-pulse" : ""} flex`}
          >
            {glyph}
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
