"use client";

import { useEffect, useState } from "react";

type Theme = "dark" | "light";

/** 라이트/다크 모드 토글 버튼. 선택은 localStorage에 저장된다. */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  // 마운트 시 현재 적용된 테마(또는 저장값)를 읽어온다.
  useEffect(() => {
    const stored = (localStorage.getItem("theme") as Theme | null) ?? null;
    const current: Theme =
      stored ?? (document.documentElement.classList.contains("light") ? "light" : "dark");
    setTheme(current);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("light", next === "light");
    try {
      localStorage.setItem("theme", next);
    } catch {
      // 저장 실패는 무시
    }
  }

  const isDark = theme === "dark";
  return (
    <button
      onClick={toggle}
      title={isDark ? "라이트 모드로 전환" : "다크 모드로 전환"}
      aria-label={isDark ? "라이트 모드로 전환" : "다크 모드로 전환"}
      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-sm text-white/70 transition hover:border-white/25 hover:text-white"
    >
      <span>{isDark ? "🌙" : "☀️"}</span>
      {isDark ? "다크" : "라이트"}
    </button>
  );
}
