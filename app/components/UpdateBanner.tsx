"use client";

import { useEffect, useState } from "react";

const MY_BUILD = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";
const CHECK_INTERVAL = 60_000; // 1분마다 새 버전 확인

/** 새 버전이 배포되면(빌드 ID 변경) 새로고침 안내 배너를 띄운다. */
export default function UpdateBanner() {
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let alive = true;
    async function check() {
      if (!alive || stale) return;
      try {
        const r = await fetch("/api/build", { cache: "no-store" });
        const { build } = (await r.json()) as { build: string };
        if (alive && build && build !== MY_BUILD) setStale(true);
      } catch {
        // 무시
      }
    }
    const id = setInterval(check, CHECK_INTERVAL);
    window.addEventListener("focus", check);
    return () => {
      alive = false;
      clearInterval(id);
      window.removeEventListener("focus", check);
    };
  }, [stale]);

  if (!stale) return null;

  return (
    <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div className="flex items-center gap-3 rounded-full border border-emerald-400/40 bg-[#11261d] px-4 py-2.5 text-sm text-white shadow-xl">
        <span>✨ 새 버전이 배포됐어요.</span>
        <button
          onClick={() => window.location.reload()}
          className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-black transition hover:bg-emerald-400"
        >
          새로고침
        </button>
      </div>
    </div>
  );
}
