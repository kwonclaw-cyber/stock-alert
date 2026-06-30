/**
 * 총겜동 내수서버 길드 내실 현황 데이터 모델.
 *
 * 스프레드시트 레이아웃을 그대로 옮긴 구조다.
 * - 길드마다 길드장 1명 + 최대 10슬롯(길드장 포함)
 * - 각 슬롯(멤버)은 직업/스텟/잠재/방어구/장신구/탈것 값을 가진다.
 * - 값은 현재 비어 있으며 운영진이 채워 넣는다.
 */

export type MemberStats = {
  name: string; // 이름 (1번은 길드장)
  job: string; // 직업
  weapon: string; // 무기
  internal: string; // 내공
  // 잠재 (도핑X)
  evasion: string; // 회피
  atkSpeed: string; // 공속
  sum: string; // 합
  // 재련 / 강화
  helmet: string; // 투구
  armor: string; // 갑옷
  belt: string; // 벨트
  shoes: string; // 신발
  ring: string; // 반지
  // 기타
  health: string; // 체력
  dopingLuck: string; // 도핑운
  mount: string; // 탈것
};

export type Guild = {
  id: string;
  name: string; // 길드장(길드) 이름
  logo?: string; // 로고 이미지 경로 (선택)
  members: MemberStats[]; // 길드장 포함 최대 10명
  pickaxes: number[]; // 곡괭이 개수 [1성, 2성, 3성, 4성, 5성]
};

/** 멤버 stat 키 (이름 제외) 순서 정의 */
export type StatKey = Exclude<keyof MemberStats, "name">;

/** 선택 가능한 직업 목록 */
export const JOBS = ["검객", "자객", "창술사", "도사", "궁사"] as const;
/** 히든 직업 목록 */
export const HIDDEN_JOBS = ["뇌신", "빙천마제", "염라귀궁", "나타태자", "천살성"] as const;

/** 직업별 글자 색 (다크·라이트 모두에서 읽히도록 400 계열 사용) */
const JOB_COLOR: Record<string, string> = {
  검객: "text-red-400",
  자객: "text-violet-400",
  창술사: "text-sky-400",
  도사: "text-emerald-400",
  궁사: "text-lime-400",
  뇌신: "text-yellow-400",
  빙천마제: "text-cyan-400",
  염라귀궁: "text-fuchsia-400",
  나타태자: "text-orange-400",
  천살성: "text-rose-400",
};

export const isHiddenJob = (job: string) => (HIDDEN_JOBS as readonly string[]).includes(job);

/** 직업명 → 글자색 클래스 (없으면 기본색) */
export function jobColorClass(job: string): string {
  return JOB_COLOR[job] ?? "text-white/85";
}

/** 헤더 그룹 / 하위 컬럼 정의 (스프레드시트 헤더와 동일) */
export type ColumnDef = { key: StatKey; label: string; color?: string; noAvg?: boolean };
export type ColumnGroup = { label: string; cols: ColumnDef[] };

// 단일 컬럼(그룹 헤더 없이 rowSpan)은 label "" 으로, 묶음 컬럼은 그룹 label 지정.
export const COLUMN_GROUPS: ColumnGroup[] = [
  { label: "", cols: [{ key: "job", label: "직업" }] },
  { label: "", cols: [{ key: "weapon", label: "무기", color: "text-amber-400" }] },
  { label: "", cols: [{ key: "internal", label: "내공" }] },
  {
    label: "잠재 (도핑X)",
    cols: [
      { key: "evasion", label: "회피" },
      { key: "atkSpeed", label: "공속", color: "text-emerald-400" },
      { key: "sum", label: "합", color: "text-sky-400" },
    ],
  },
  {
    label: "재련 / 강화",
    cols: [
      { key: "helmet", label: "투구", color: "text-sky-400" },
      { key: "armor", label: "갑옷", color: "text-sky-400" },
      { key: "belt", label: "벨트", color: "text-sky-400" },
      { key: "shoes", label: "신발", color: "text-sky-400" },
      { key: "ring", label: "반지", color: "text-sky-400", noAvg: true },
    ],
  },
  { label: "", cols: [{ key: "health", label: "체력" }] },
  { label: "", cols: [{ key: "dopingLuck", label: "도핑운" }] },
  // 탈것(mount)은 GuildTable에서 rowSpan 헤더로 별도 렌더한다.
];

/** 모든 stat 컬럼을 평탄화한 목록 */
export const FLAT_COLUMNS: ColumnDef[] = COLUMN_GROUPS.flatMap((g) => g.cols);

/** 빈 멤버 슬롯 생성 (name만 지정) */
function emptyMember(name: string): MemberStats {
  return {
    name,
    job: "",
    weapon: "",
    internal: "",
    evasion: "",
    atkSpeed: "",
    sum: "",
    helmet: "",
    armor: "",
    belt: "",
    shoes: "",
    ring: "",
    health: "",
    dopingLuck: "",
    mount: "",
  };
}

/** 길드장 이름 + 슬롯 수(기본 10)로 빈 멤버 배열 생성 */
function emptyRoster(leaderName: string, slots = 10): MemberStats[] {
  const members = [emptyMember(leaderName)];
  for (let i = 2; i <= slots; i++) {
    members.push(emptyMember(String(i)));
  }
  return members;
}

/**
 * 길드 목록. 천박이 메인 길드. (id는 호환 위해 baksajang 유지)
 * 값은 운영진이 채워 넣으면 된다.
 */
export const GUILDS: Guild[] = [
  { id: "baksajang", name: "천박", members: emptyRoster("천박"), pickaxes: [0, 0, 0, 0, 0] },
  { id: "kimseongtae", name: "킴성태", members: emptyRoster("킴성태"), pickaxes: [0, 0, 0, 0, 0] },
  { id: "kangmansik", name: "강만식", members: emptyRoster("강만식"), pickaxes: [0, 0, 0, 0, 0] },
  { id: "oya", name: "오아", members: emptyRoster("오아"), pickaxes: [0, 0, 0, 0, 0] },
  { id: "dohyeon", name: "도현", members: emptyRoster("도현"), pickaxes: [0, 0, 0, 0, 0] },
  { id: "supi", name: "수피", members: emptyRoster("수피"), pickaxes: [0, 0, 0, 0, 0] },
];

/** 메인 길드 id */
export const MAIN_GUILD_ID = "baksajang";

export function getGuild(id: string): Guild | undefined {
  return GUILDS.find((g) => g.id === id);
}
