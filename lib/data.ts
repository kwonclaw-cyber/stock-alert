import { GUILDS, type Guild, type MemberStats } from "./guilds";

/** 보스 타이머 (4. 보스타이머) */
export type BossTimer = {
  id: string;
  name: string; // 보스 이름
  location: string; // 위치
  respawnMin: number; // 리젠 주기(분)
  lastKill: string | null; // 마지막 처치 시각(ISO)
  alarm: boolean; // 젠 알람 사용 여부
  notifiedKill: string | null; // 디스코드 알림 보낸 lastKill (중복 방지)
  memo: string;
};

export type HiddenStatus = "후보" | "유력" | "제외" | "확정";

/** 히든 추리 단서 (5. 히든추리용) — 순서대로 정리하여 유추 */
export type HiddenEntry = {
  id: string;
  title: string; // 대상 / 단계
  content: string; // 단서 내용
  status: HiddenStatus;
  images: string[]; // 붙여넣은 캡처 이미지 (data URL)
};

/** 정보공유 글 (6. 정보공유) */
/** 게시판 글(정보공유·영단 공용). 본문에 [[img:id]] 토큰으로 사진이 본문 중간에 들어간다. */
export type BoardImage = { id: string; url: string };
export type BoardPost = {
  id: string;
  title: string;
  body: string; // 텍스트 + 링크 + [[img:id]] 토큰
  images: BoardImage[];
  author: string;
  updatedAt: string; // ISO
};
export type InfoPost = BoardPost; // 호환용 별칭

/** 전달: 길드원 1명을 지정하고 공지를 남기면, 지정 인원 제외 모두가 댓글로 응답 */
export type RelayComment = { id: string; author: string; text: string; at: string };
export type RelayPost = {
  id: string;
  title: string;
  body: string;
  target: string; // 지정 길드원(이 사람은 댓글 제외)
  author: string;
  comments: RelayComment[];
  createdAt: string;
};

/** 일정/이벤트 (캘린더) */
export type EventItem = {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM (선택)
  memo: string;
  color: string; // 분류 색 (emerald/sky/amber/fuchsia/red)
};

/** 무인의 거처 정보 카드 (캡처 이미지) */
export type DwellingCard = {
  id: string;
  title: string;
  image: string; // 캡처 이미지(data URL)
  memo: string;
  cx: string; // 게임 좌표 X
  cy: string; // 게임 좌표 Y(높이)
  cz: string; // 게임 좌표 Z
};

/** 제작 및 재료 정보 카드 (무인의 거처와 동일하나 좌표 없음) */
export type CraftingCard = {
  id: string;
  title: string;
  image: string; // 캡처 이미지(data URL)
  memo: string;
};

/** 부적 옵션 행 (부적명 / 효과) */
export type AmuletRow = { id: string; name: string; effect: string };

/** 부적 시스템 (정보 + 계산기) */
export type AmuletState = {
  // 계산기 파라미터 (화면에서 수정 가능)
  combineCount: number; // 같은 등급 N개 → 상위 등급 1개
  pullCostNormal: number; // 일반 부적 뽑기 가격(전)
  rerollCostTicket: number; // 리롤 비용(별풍선티켓)
  pullCostRareTicket: number; // 희귀 부적 뽑기 가격(별풍선티켓)
  // 옵션 효과표
  advanced: AmuletRow[]; // 고급 부적 옵션
  rare: AmuletRow[]; // 희귀 부적 옵션
  // 참고 이미지 카드
  images: CraftingCard[];
};

/** 수동 추가 문파원 (멤버현황에 없는 인원) */
export type ManualMember = { id: string; name: string };

/** 철타이머 — 문파원별 철넣기 완료 시간 + 일별 누적 카운트 */
export type IronState = {
  guildId: string; // 대상 문파 (멤버현황 연동)
  cooldownMin: number; // 철넣기 주기(분), 0이면 타이머 없음
  manualMembers: ManualMember[];
  // memberKey -> { lastDoneAt, daily: { "YYYY-MM-DD": 횟수 } }
  records: Record<string, { lastDoneAt: string | null; daily: Record<string, number> }>;
};

/** 광산/채집장 1칸 */
export type Mine = {
  id: string;
  name: string; // 광산1 ...
  kind: "mine" | "gather" | "brew" | "outpost" | "port"; // 광산 / 채집장 / 양조장(도착지) / 전초(출발) / 항구(출발)
  cooldownMin: number; // 쿨타임(분)
  lastDoneAt: string | null; // 마지막 완료(ISO)
  x: number | null; // 지도(이미지)상 위치 X (0~100%)
  y: number | null; // 지도(이미지)상 위치 Y (0~100%)
  cx: string; // 게임 좌표 X
  cy: string; // 게임 좌표 Y(높이)
  cz: string; // 게임 좌표 Z
  nav: number; // 네비 동선 그룹 (0=미등록, 1·2·3)
};

/** 지도 좌표 보정 거점 (게임좌표 ↔ 지도 마커 위치) */
export type CalibPoint = { cx: string; cz: string; x: number | null; y: number | null };

/** 광산타이머 상태 */
export type MineState = {
  mines: Mine[];
  defaultCooldownMin: number; // 새 광산 기본 쿨타임
  mapImage: string | null; // 광산 지도 (data URL)
  calib: { p1: CalibPoint; p2: CalibPoint }; // 좌표 거점 2곳(보정)
};

/** 일숙(일일 숙제) — 문파원별 숙제 완료 체크 */
export type DailyState = {
  guildId: string; // 대상 문파 (멤버현황 연동)
  tasks: { id: string; name: string }[]; // 숙제 항목들
  manualMembers: ManualMember[];
  // "YYYY-MM-DD|memberKey|taskId" -> 완료 여부
  checks: Record<string, boolean>;
};

/** 사장님(매장 대표자) 정보 */
export type OwnerInfo = {
  ownerName: string;       // 대표자 성함
  ownerPhone: string;      // 대표자 연락처
  email: string;           // 이메일 주소
  storePhone: string;      // 매장 전화번호
  storeAddress: string;    // 매장 주소
  naverId: string;         // 네이버 ID
  naverPw: string;         // 네이버 PW
  storeKey: string;        // 매장 키 정보
  baeminCode: string;      // 배민 가게복사코드
  baeminOneCode: string;   // 배민원 가게복사코드
};

/** 전체 앱 데이터 (서버에 통째로 저장) */
export type AppData = {
  guilds: Guild[];
  bossTimers: BossTimer[];
  mine: MineState;
  iron: IronState;
  daily: DailyState;
  hidden: HiddenEntry[];
  hiddenConclusion: string; // 종합 유추 결론
  infos: InfoPost[];
  liveNotes: BoardPost[]; // 긴급 라이브 정리(게시판형)
  relays: RelayPost[]; // 전달(지정 인원 제외 댓글)
  events: EventItem[];
  dwellings: BoardPost[]; // 영단(게시판형)
  craftings: CraftingCard[]; // 제작 및 재료 정보 카드
  villageMap: string; // 마을지도 이미지(data URL)
  amulet: AmuletState; // 부적 시스템
  discordWebhook: string; // 디스코드 웹훅 URL
  ownerInfo: OwnerInfo; // 사장님 정보
};

/** 고유 id 생성 */
export function uid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** 로컬 기준 오늘 날짜 키 (YYYY-MM-DD) */
export function todayKey(d: Date = new Date()): string {
  return d.toLocaleDateString("en-CA"); // YYYY-MM-DD
}

export const MAIN_GUILD = "baksajang";

/** 빈 히든 단서 */
export function emptyHidden(): HiddenEntry {
  return { id: uid(), title: "", content: "", status: "후보", images: [] };
}

const row = (name: string, effect: string): AmuletRow => ({ id: uid(), name, effect });

/** 부적 시스템 기본값 (이미지 기준 초기값, 화면에서 수정 가능) */
export function defaultAmulet(): AmuletState {
  return {
    combineCount: 10,
    pullCostNormal: 10000,
    rerollCostTicket: 10,
    pullCostRareTicket: 5,
    advanced: [
      row("백옥·구온·청검", "체력 증가"),
      row("묵호·비류", "치명타 확률 증가"),
      row("흑운·금아", "치명타 데미지 증가"),
      row("채동·룡맥", "보스 데미지 증가"),
      row("해운·옥묘·비아", "회복력 증가"),
      row("비전·비추", "저항 증가"),
    ],
    rare: [
      row("설등", "체력 증가 (21)"),
      row("대득학", "치명타 확률 증가 (6)"),
      row("선무익", "보스 데미지 증가 (12)"),
      row("칠말국", "운 증가 (6)"),
      row("무산설", "회복력 증가 (21)"),
      row("금성조", "저항 증가 (6)"),
      row("신용무", "공격 속도 증가 (1)"),
      row("대박운", "회피 증가 (6)"),
      row("밀음수", "내공 증가 (6)"),
    ],
    images: [],
  };
}

export function defaultOwnerInfo(): OwnerInfo {
  return {
    ownerName: "",
    ownerPhone: "",
    email: "",
    storePhone: "",
    storeAddress: "",
    naverId: "",
    naverPw: "",
    storeKey: "",
    baeminCode: "",
    baeminOneCode: "",
  };
}

/** 최초 기본 데이터 */
export function defaultData(): AppData {
  return {
    guilds: structuredClone(GUILDS),
    bossTimers: [
      {
        id: uid(),
        name: "예시 보스",
        location: "위치 입력",
        respawnMin: 60,
        lastKill: null,
        alarm: false,
        notifiedKill: null,
        memo: "",
      },
    ],
    mine: { mines: [], defaultCooldownMin: 60, mapImage: null, calib: { p1: { cx: "", cz: "", x: null, y: null }, p2: { cx: "", cz: "", x: null, y: null } } },
    iron: { guildId: MAIN_GUILD, cooldownMin: 0, manualMembers: [], records: {} },
    daily: {
      guildId: MAIN_GUILD,
      tasks: [{ id: uid(), name: "일일 숙제" }],
      manualMembers: [],
      checks: {},
    },
    hidden: [emptyHidden(), emptyHidden()],
    hiddenConclusion: "",
    infos: [],
    liveNotes: [],
    relays: [],
    events: [],
    dwellings: [],
    craftings: [],
    villageMap: "",
    amulet: defaultAmulet(),
    discordWebhook: "",
    ownerInfo: defaultOwnerInfo(),
  };
}

type LegacyGuild = Guild & { pickaxe5?: number };
type LegacyHidden = Partial<HiddenEntry> & { target?: string; clue?: string; memo?: string };

/** 구버전 글/카드(정보공유 InfoPost·영단 DwellingCard)를 게시판 글(BoardPost)로 변환 */
function toBoardPost(p: Record<string, unknown>): BoardPost {
  const images: BoardImage[] = [];
  let body = typeof p.body === "string" ? p.body : typeof p.memo === "string" ? p.memo : "";
  if (typeof p.link === "string" && p.link) body += (body ? "\n" : "") + p.link; // 구버전 링크 → 본문
  const imgs = p.images;
  if (Array.isArray(imgs)) {
    for (const s of imgs) {
      if (typeof s === "string") { const id = uid(); images.push({ id, url: s }); body += `\n[[img:${id}]]`; } // 구버전: 토큰 추가
      else if (s && typeof (s as BoardImage).url === "string") { images.push({ id: (s as BoardImage).id || uid(), url: (s as BoardImage).url }); } // 신버전: 토큰 이미 본문에 있음
    }
  }
  if (typeof p.image === "string" && p.image) { const id = uid(); images.push({ id, url: p.image }); body += `\n[[img:${id}]]`; } // 영단 단일 이미지
  return {
    id: (typeof p.id === "string" && p.id) || uid(),
    title: typeof p.title === "string" ? p.title : "",
    body,
    images,
    author: typeof p.author === "string" ? p.author : "",
    updatedAt: typeof p.updatedAt === "string" ? p.updatedAt : new Date().toISOString(),
  };
}

/** 저장된 데이터에 누락/구버전 필드가 있을 때 기본값과 병합·마이그레이션 */
export function normalizeData(input: Partial<AppData> | null | undefined): AppData {
  const base = defaultData();
  if (!input) return base;

  const guilds = (input.guilds?.length ? input.guilds : base.guilds).map((g) => {
    const lg = g as LegacyGuild;
    const pickaxes = Array.isArray(lg.pickaxes)
      ? [0, 0, 0, 0, 0].map((_, i) => Number(lg.pickaxes![i]) || 0)
      : [0, 0, 0, 0, Number(lg.pickaxe5) || 0]; // 구버전 5성곡괭이 → 5성칸으로
    // 오타 수정: 오야 → 오아
    const name = g.id === "oya" && g.name === "오야" ? "오아" : g.name;
    // 멤버 필드 보정/마이그레이션 (구버전 택1 → 반지, attack/택2는 제거)
    const members = (g.members ?? []).map((m) => {
      const lm = m as MemberStats & { acc1?: string };
      return {
        name: lm.name ?? "",
        job: lm.job ?? "",
        weapon: lm.weapon ?? "",
        internal: lm.internal ?? "",
        evasion: lm.evasion ?? "",
        atkSpeed: lm.atkSpeed ?? "",
        sum: lm.sum ?? "",
        helmet: lm.helmet ?? "",
        armor: lm.armor ?? "",
        belt: lm.belt ?? "",
        shoes: lm.shoes ?? "",
        ring: lm.ring ?? lm.acc1 ?? "",
        health: lm.health ?? "",
        dopingLuck: lm.dopingLuck ?? "",
        mount: lm.mount ?? "",
      };
    });
    return { ...g, name, pickaxes, members };
  });

  const hidden = (input.hidden ?? base.hidden).map((h) => {
    const lh = h as LegacyHidden;
    return {
      id: lh.id || uid(),
      title: lh.title ?? lh.target ?? "",
      content: lh.content ?? lh.clue ?? "",
      status: (lh.status as HiddenStatus) ?? "후보",
      images: Array.isArray(lh.images) ? lh.images : [],
    };
  });

  const bossTimers = (input.bossTimers ?? base.bossTimers).map((b) => ({
    ...b,
    alarm: typeof b.alarm === "boolean" ? b.alarm : false,
    notifiedKill: b.notifiedKill ?? null,
  }));

  const mine: MineState = {
    mines: (input.mine?.mines ?? []).map((m) => ({
      id: m.id || uid(),
      name: m.name ?? "",
      kind: ((): "mine" | "gather" | "brew" | "outpost" | "port" => {
        const k = (m as { kind?: unknown }).kind;
        return k === "gather" || k === "brew" || k === "outpost" || k === "port" ? k : "mine";
      })(),
      cooldownMin: Number(m.cooldownMin) || 0,
      lastDoneAt: m.lastDoneAt ?? null,
      x: typeof m.x === "number" ? m.x : null,
      y: typeof m.y === "number" ? m.y : null,
      cx: m.cx ?? "",
      cy: m.cy ?? "",
      cz: m.cz ?? "",
      nav: ((): number => {
        const n = Number((m as { nav?: unknown }).nav);
        if (n === 1 || n === 2 || n === 3) return n;
        return (m as { target?: unknown }).target ? 1 : 0; // 구버전 target=true → 네비1
      })(),
    })),
    defaultCooldownMin: Number(input.mine?.defaultCooldownMin) || 60,
    mapImage: input.mine?.mapImage ?? null,
    calib: ((): MineState["calib"] => {
      const c = input.mine?.calib;
      const pt = (p: Partial<CalibPoint> | undefined): CalibPoint => ({
        cx: p?.cx ?? "",
        cz: p?.cz ?? "",
        x: typeof p?.x === "number" ? p.x : null,
        y: typeof p?.y === "number" ? p.y : null,
      });
      return { p1: pt(c?.p1), p2: pt(c?.p2) };
    })(),
  };

  const iron: IronState = {
    guildId: input.iron?.guildId ?? base.iron.guildId,
    cooldownMin: Number(input.iron?.cooldownMin) || 0,
    manualMembers: input.iron?.manualMembers ?? [],
    records: input.iron?.records ?? {},
  };

  const daily: DailyState = {
    guildId: input.daily?.guildId ?? base.daily.guildId,
    tasks: input.daily?.tasks?.length ? input.daily.tasks : base.daily.tasks,
    manualMembers: input.daily?.manualMembers ?? [],
    checks: input.daily?.checks ?? {},
  };

  return {
    guilds,
    bossTimers,
    mine,
    iron,
    daily,
    hidden,
    hiddenConclusion: input.hiddenConclusion ?? "",
    infos: (input.infos ?? []).map((p) => toBoardPost(p as Record<string, unknown>)),
    liveNotes: (input.liveNotes ?? []).map((p) => toBoardPost(p as Record<string, unknown>)),
    relays: (input.relays ?? []).map((r) => ({
      id: r.id || uid(),
      title: r.title ?? "",
      body: r.body ?? "",
      target: r.target ?? "",
      author: r.author ?? "",
      comments: Array.isArray(r.comments)
        ? r.comments.map((c) => ({ id: c.id || uid(), author: c.author ?? "", text: c.text ?? "", at: c.at ?? new Date().toISOString() }))
        : [],
      createdAt: r.createdAt ?? new Date().toISOString(),
    })),
    events: input.events ?? [],
    dwellings: (input.dwellings ?? []).map((c) => toBoardPost(c as Record<string, unknown>)),
    craftings: (input.craftings ?? []).map((c) => ({
      id: c.id || uid(),
      title: c.title ?? "",
      image: c.image ?? "",
      memo: c.memo ?? "",
    })),
    villageMap: input.villageMap ?? "",
    amulet: ((): AmuletState => {
      const a = input.amulet;
      const def = defaultAmulet();
      if (!a) return def;
      const rows = (arr: AmuletRow[] | undefined, fb: AmuletRow[]) =>
        arr ? arr.map((r) => ({ id: r.id || uid(), name: r.name ?? "", effect: r.effect ?? "" })) : fb;
      return {
        combineCount: Number(a.combineCount) || def.combineCount,
        pullCostNormal: Number(a.pullCostNormal) || def.pullCostNormal,
        rerollCostTicket: Number(a.rerollCostTicket) || def.rerollCostTicket,
        pullCostRareTicket: Number(a.pullCostRareTicket) || def.pullCostRareTicket,
        advanced: rows(a.advanced, def.advanced),
        rare: rows(a.rare, def.rare),
        images: (a.images ?? []).map((c) => ({
          id: c.id || uid(),
          title: c.title ?? "",
          image: c.image ?? "",
          memo: c.memo ?? "",
        })),
      };
    })(),
    discordWebhook: input.discordWebhook ?? "",
    ownerInfo: {
      ownerName: input.ownerInfo?.ownerName ?? "",
      ownerPhone: input.ownerInfo?.ownerPhone ?? "",
      email: input.ownerInfo?.email ?? "",
      storePhone: input.ownerInfo?.storePhone ?? "",
      storeAddress: input.ownerInfo?.storeAddress ?? "",
      naverId: input.ownerInfo?.naverId ?? "",
      naverPw: input.ownerInfo?.naverPw ?? "",
      storeKey: input.ownerInfo?.storeKey ?? "",
      baeminCode: input.ownerInfo?.baeminCode ?? "",
      baeminOneCode: input.ownerInfo?.baeminOneCode ?? "",
    },
  };
}
