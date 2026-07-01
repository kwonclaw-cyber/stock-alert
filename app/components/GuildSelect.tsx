"use client";

import type { Guild } from "@/lib/guilds";

export default function GuildSelect({
  guilds,
  value,
  onChange,
}: {
  guilds: Guild[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-white/50">
      대상 문파
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-white/10 bg-black/30 px-2.5 py-1.5 text-sm text-white outline-none focus:border-emerald-400/60"
      >
        {guilds.map((g) => (
          <option key={g.id} value={g.id} className="bg-[#23262e]">
            {g.name} 문파
          </option>
        ))}
      </select>
    </label>
  );
}
