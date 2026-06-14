import type { AppData, ManualMember } from "@/lib/data";

export type MemberRef = { key: string; name: string; manual: boolean };

/**
 * 페이지에서 사용할 문파원 목록을 만든다.
 * - 멤버현황(roster)의 인원이 자동 연동된다. (이름 바꾸면 즉시 반영)
 * - 추가로 수동 등록한 인원(manual)도 합친다.
 */
export function resolveMembers(
  data: AppData,
  guildId: string,
  manual: ManualMember[],
): MemberRef[] {
  const guild = data.guilds.find((g) => g.id === guildId) ?? data.guilds[0];
  const roster: MemberRef[] = guild.members.map((m, idx) => ({
    key: `${guild.id}:${idx}`,
    name: m.name || (idx === 0 ? guild.name : String(idx + 1)),
    manual: false,
  }));
  const extra: MemberRef[] = manual.map((mm) => ({
    key: `m:${mm.id}`,
    name: mm.name || "(이름 없음)",
    manual: true,
  }));
  return [...roster, ...extra];
}
