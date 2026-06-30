"use client";

import { useState } from "react";
import { useStore } from "../../components/StoreProvider";
import GuildTable from "../../components/GuildTable";
import Loading from "../../components/Loading";
import PageHelp from "../../components/PageHelp";
import { MAIN_GUILD_ID, type StatKey } from "@/lib/guilds";

const SORT_OPTS: { key: StatKey; label: string }[] = [
  { key: "internal", label: "내공" },
  { key: "health", label: "체력" },
  { key: "sum", label: "합" },
  { key: "evasion", label: "회피" },
  { key: "atkSpeed", label: "공속" },
  { key: "dopingLuck", label: "도핑운" },
  { key: "helmet", label: "투구" },
  { key: "armor", label: "갑옷" },
  { key: "belt", label: "벨트" },
  { key: "shoes", label: "신발" },
];

function num(s: string, fallback: number) {
  const n = parseFloat((s || "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : fallback;
}

export default function BaksajangPage() {
  const { data, update } = useStore();
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<StatKey | "">("");
  const [desc, setDesc] = useState(true);
  if (!data) return <Loading />;

  const gi = data.guilds.findIndex((g) => g.id === MAIN_GUILD_ID);
  const guild = data.guilds[gi];

  let order = guild.members.map((_, i) => i);
  if (q.trim()) {
    const needle = q.trim().toLowerCase();
    order = order.filter((i) => {
      const m = guild.members[i];
      const name = i === 0 ? guild.name : m.name;
      return `${name} ${m.job}`.toLowerCase().includes(needle);
    });
  }
  if (sortKey) {
    order = [...order].sort((a, b) => {
      const va = num(guild.members[a][sortKey], desc ? -Infinity : Infinity);
      const vb = num(guild.members[b][sortKey], desc ? -Infinity : Infinity);
      return desc ? vb - va : va - vb;
    });
  }

  return (
    <div className="w-full">
      <PageHelp>
        메인 문파(<b>천박</b>)의 <b>내실 현황판</b>이에요. 각 칸을 클릭해 직접 입력하고, 맨 아래에서 곡괭이 1★~5★를 체크하세요. 위의 <b>검색/정렬</b>로 멤버를 찾거나 스텟순으로 줄세울 수 있어요. (이름·직업은 멤버현황 연동)
      </PageHelp>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="mr-2 text-lg font-bold">{guild.name} 길드 <span className="text-xs font-medium text-white/40">메인</span></h2>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="이름·직업 검색"
          className="rounded-md border border-white/10 bg-black/30 px-2.5 py-1.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-emerald-400/60"
        />
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as StatKey | "")}
          className="rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white outline-none focus:border-emerald-400/60"
        >
          <option value="" className="bg-[#23262e]">정렬: 기본순</option>
          {SORT_OPTS.map((o) => (
            <option key={o.key} value={o.key} className="bg-[#23262e]">정렬: {o.label}</option>
          ))}
        </select>
        {sortKey && (
          <button
            onClick={() => setDesc((v) => !v)}
            className="rounded-md border border-white/15 px-2 py-1.5 text-sm text-white/70 hover:text-white"
            title="정렬 방향"
          >
            {desc ? "내림차순 ▼" : "오름차순 ▲"}
          </button>
        )}
        {(q || sortKey) && (
          <button onClick={() => { setQ(""); setSortKey(""); }} className="text-xs text-white/45 hover:text-white">초기화</button>
        )}
        {q && <span className="text-xs text-white/40">{order.length}명 표시</span>}
      </div>

      <GuildTable
        guild={guild}
        large
        editable
        order={order}
        onCell={(mi, key, value) =>
          update((d) => {
            d.guilds[gi].members[mi][key] = value;
          })
        }
        onPickaxe={(star, v) =>
          update((d) => {
            d.guilds[gi].pickaxes[star] = v;
          })
        }
      />
    </div>
  );
}
