"use client";

import { useStore } from "./StoreProvider";

const MAP = {
  loading: { text: "불러오는 중…", dot: "bg-white/30" },
  saving: { text: "저장 중…", dot: "bg-amber-400 animate-pulse" },
  saved: { text: "저장됨", dot: "bg-emerald-400" },
  error: { text: "저장 실패", dot: "bg-red-400" },
} as const;

export default function SaveStatus() {
  const { saveState } = useStore();
  const s = MAP[saveState];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-white/50">
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.text}
    </span>
  );
}
