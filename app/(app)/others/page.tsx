"use client";

import { useStore } from "../../components/StoreProvider";
import GuildTable from "../../components/GuildTable";
import Loading from "../../components/Loading";
import { MAIN_GUILD_ID } from "@/lib/guilds";

export default function OthersPage() {
  const { data, update } = useStore();
  if (!data) return <Loading />;

  return (
    <div>
      <p className="mb-4 text-sm text-white/50">박사장 길드를 제외한 타 길드들의 내실 현황입니다.</p>
      <div className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
        {data.guilds.map((guild, gi) =>
          guild.id === MAIN_GUILD_ID ? null : (
            <section key={guild.id}>
              <h2 className="mb-2 text-base font-bold">{guild.name} 길드</h2>
              <GuildTable
                guild={guild}
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
            </section>
          ),
        )}
      </div>
    </div>
  );
}
