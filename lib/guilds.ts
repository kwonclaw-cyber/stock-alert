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
  // 스텟
  weapon: string; // 무기
  attack: string; // 공격력
  internal: string; // 내공
  health: string; // 체력
  // 잠재
  evasion: string; // 회피
  atkSpeed: string; // 공속
  sum: string; // 합
  // 방어구
  helmet: string; // 투구
  armor: string; // 갑옷
  belt: string; // 허리
  shoes: string; // 신발
  // 장신구
  acc1: string; // 택1
  acc2: string; // 택2
  // 탈것
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

/** 헤더 그룹 / 하위 컬럼 정의 (스프레드시트 헤더와 동일) */
export type ColumnDef = { key: StatKey; label: string; color?: string };
export type ColumnGroup = { label: string; cols: ColumnDef[] };

export const COLUMN_GROUPS: ColumnGroup[] = [
  { label: "팀명", cols: [{ key: "job", label: "직업" }] },
  {
    label: "스텟",
    cols: [
      { key: "weapon", label: "무기", color: "text-amber-400" },
      { key: "attack", label: "공격력", color: "text-amber-400" },
      { key: "internal", label: "내공" },
      { key: "health", label: "체력" },
    ],
  },
  {
    label: "잠재",
    cols: [
      { key: "evasion", label: "회피" },
      { key: "atkSpeed", label: "공속", color: "text-emerald-400" },
      { key: "sum", label: "합", color: "text-sky-400" },
    ],
  },
  {
    label: "방어구",
    cols: [
      { key: "helmet", label: "투구", color: "text-sky-400" },
      { key: "armor", label: "갑옷", color: "text-sky-400" },
      { key: "belt", label: "허리", color: "text-sky-400" },
      { key: "shoes", label: "신발", color: "text-sky-400" },
    ],
  },
  {
    label: "장신구",
    cols: [
      { key: "acc1", label: "택1" },
      { key: "acc2", label: "택2" },
    ],
  },
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
    attack: "",
    internal: "",
    health: "",
    evasion: "",
    atkSpeed: "",
    sum: "",
    helmet: "",
    armor: "",
    belt: "",
    shoes: "",
    acc1: "",
    acc2: "",
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
 * 길드 목록. 박사장이 메인 길드.
 * 값은 운영진이 채워 넣으면 된다.
 */
export const GUILDS: Guild[] = [
  { id: "baksajang", name: "박사장", members: emptyRoster("박사장"), pickaxes: [0, 0, 0, 0, 0] },
  { id: "kimseongtae", name: "킴성태", members: emptyRoster("킴성태"), pickaxes: [0, 0, 0, 0, 0] },
  { id: "kangmansik", name: "강만식", members: emptyRoster("강만식"), pickaxes: [0, 0, 0, 0, 0] },
  { id: "oya", name: "오야", members: emptyRoster("오야"), pickaxes: [0, 0, 0, 0, 0] },
  { id: "dohyeon", name: "도현", members: emptyRoster("도현"), pickaxes: [0, 0, 0, 0, 0] },
  { id: "supi", name: "수피", members: emptyRoster("수피"), pickaxes: [0, 0, 0, 0, 0] },
];

/** 메인 길드 id */
export const MAIN_GUILD_ID = "baksajang";

export function getGuild(id: string): Guild | undefined {
  return GUILDS.find((g) => g.id === id);
}
