"use client";

import { useStore } from "../../components/StoreProvider";
import GuildTable from "../../components/GuildTable";
import Loading from "../../components/Loading";
import PageHelp from "../../components/PageHelp";
import { MAIN_GUILD_ID } from "@/lib/guilds";

export default function BaksajangPage() {
  const { data, update } = useStore();
  if (!data) return <Loading />;

  const gi = data.guilds.findIndex((g) => g.id === MAIN_GUILD_ID);
  const guild = data.guilds[gi];

  return (
    <div className="w-full">
      <PageHelp>
        메인 길드(<b>박사장</b>)의 <b>내실 현황판</b>이에요. 각 칸을 클릭해 스텟·잠재·방어구·장신구·탈것을 직접 입력하세요. 맨 아래에서 곡괭이 개수를 1★~5★별로 체크할 수 있어요. (이름·직업은 멤버현황과 연동)
      </PageHelp>
      <div className="mb-3 flex items-baseline gap-2">
        <h2 className="text-lg font-bold">{guild.name} 길드</h2>
        <span className="text-xs text-white/40">메인 · 내실 현황판</span>
      </div>
      <GuildTable
        guild={guild}
        large
        editable
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
