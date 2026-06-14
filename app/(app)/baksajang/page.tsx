"use client";

import { useStore } from "../../components/StoreProvider";
import GuildTable from "../../components/GuildTable";
import Loading from "../../components/Loading";
import { MAIN_GUILD_ID } from "@/lib/guilds";

export default function BaksajangPage() {
  const { data, update } = useStore();
  if (!data) return <Loading />;

  const gi = data.guilds.findIndex((g) => g.id === MAIN_GUILD_ID);
  const guild = data.guilds[gi];

  return (
    <div className="mx-auto max-w-6xl">
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
        onPickaxe={(v) =>
          update((d) => {
            d.guilds[gi].pickaxe5 = v;
          })
        }
      />
    </div>
  );
}
