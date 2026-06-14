import { GUILDS, type Guild } from "./guilds";

/** 보스 타이머 (4. 보스타이머) */
export type BossTimer = {
  id: string;
  name: string; // 보스 이름
  location: string; // 위치
  respawnMin: number; // 리젠 주기(분)
  lastKill: string | null; // 마지막 처치 시각(ISO)
  memo: string;
};

/** 히든 추리 행 (5. 히든추리용) */
export type HiddenRow = {
  id: string;
  target: string; // 대상/용의자
  clue: string; // 단서
  status: "후보" | "유력" | "제외" | "확정";
  memo: string;
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

/** 전체 앱 데이터 (서버에 통째로 저장) */
export type AppData = {
  guilds: Guild[];
  bossTimers: BossTimer[];
  hidden: HiddenRow[];
  infos: InfoPost[];
};

/** 고유 id 생성 */
export function uid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
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
        memo: "",
      },
    ],
    hidden: [
      { id: uid(), target: "", clue: "", status: "후보", memo: "" },
      { id: uid(), target: "", clue: "", status: "후보", memo: "" },
      { id: uid(), target: "", clue: "", status: "후보", memo: "" },
    ],
    infos: [],
  };
}

/** 저장된 데이터에 누락 필드가 있을 때 기본값과 병합 */
export function normalizeData(input: Partial<AppData> | null | undefined): AppData {
  const base = defaultData();
  if (!input) return base;
  return {
    guilds: input.guilds?.length ? input.guilds : base.guilds,
    bossTimers: input.bossTimers ?? base.bossTimers,
    hidden: input.hidden ?? base.hidden,
    infos: input.infos ?? base.infos,
  };
}
