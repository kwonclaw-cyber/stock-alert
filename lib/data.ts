import { GUILDS, type Guild } from "./guilds";

/** 보스 타이머 (4. 보스타이머) */
export type BossTimer = {
  id: string;
  name: string; // 보스 이름
  location: string; // 위치
  respawnMin: number; // 리젠 주기(분)
  lastKill: string | null; // 마지막 처치 시각(ISO)
  alarm: boolean; // 젠 알람 사용 여부
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
export type InfoPost = {
  id: string;
  title: string;
  body: string;
  link: string;
  author: string;
  updatedAt: string; // ISO
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

/** 광산 1칸 */
export type Mine = {
  id: string;
  name: string; // 광산1 ...
  cooldownMin: number; // 쿨타임(분)
  lastDoneAt: string | null; // 마지막 완료(ISO)
  x: number | null; // 지도상 위치 X (0~100%)
  y: number | null; // 지도상 위치 Y (0~100%)
};

/** 광산타이머 상태 */
export type MineState = {
  mines: Mine[];
  defaultCooldownMin: number; // 새 광산 기본 쿨타임
  mapImage: string | null; // 광산 지도 (data URL)
};

/** 일숙(일일 숙제) — 문파원별 숙제 완료 체크 */
export type DailyState = {
  guildId: string; // 대상 문파 (멤버현황 연동)
  tasks: { id: string; name: string }[]; // 숙제 항목들
  manualMembers: ManualMember[];
  // "YYYY-MM-DD|memberKey|taskId" -> 완료 여부
  checks: Record<string, boolean>;
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
        memo: "",
      },
    ],
    mine: { mines: [], defaultCooldownMin: 60, mapImage: null },
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
  };
}

type LegacyGuild = Guild & { pickaxe5?: number };
type LegacyHidden = Partial<HiddenEntry> & { target?: string; clue?: string; memo?: string };

/** 저장된 데이터에 누락/구버전 필드가 있을 때 기본값과 병합·마이그레이션 */
export function normalizeData(input: Partial<AppData> | null | undefined): AppData {
  const base = defaultData();
  if (!input) return base;

  const guilds = (input.guilds?.length ? input.guilds : base.guilds).map((g) => {
    const lg = g as LegacyGuild;
    const pickaxes = Array.isArray(lg.pickaxes)
      ? [0, 0, 0, 0, 0].map((_, i) => Number(lg.pickaxes![i]) || 0)
      : [0, 0, 0, 0, Number(lg.pickaxe5) || 0]; // 구버전 5성곡괭이 → 5성칸으로
    return { ...g, pickaxes };
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
  }));

  const mine: MineState = {
    mines: (input.mine?.mines ?? []).map((m) => ({
      id: m.id || uid(),
      name: m.name ?? "",
      cooldownMin: Number(m.cooldownMin) || 0,
      lastDoneAt: m.lastDoneAt ?? null,
      x: typeof m.x === "number" ? m.x : null,
      y: typeof m.y === "number" ? m.y : null,
    })),
    defaultCooldownMin: Number(input.mine?.defaultCooldownMin) || 60,
    mapImage: input.mine?.mapImage ?? null,
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
    infos: input.infos ?? base.infos,
  };
}
