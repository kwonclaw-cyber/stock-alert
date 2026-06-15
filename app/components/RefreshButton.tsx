"use client";

import { useStore } from "./StoreProvider";

export default function RefreshButton() {
  const { refresh, refreshing } = useStore();
  return (
    <button
      onClick={refresh}
      disabled={refreshing}
      title="서버의 최신 내용으로 새로고침"
      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-sm text-white/70 transition hover:border-white/25 hover:text-white disabled:opacity-50"
    >
      <span className={refreshing ? "animate-spin" : ""}>🔄</span>
      최신화
    </button>
  );
}
