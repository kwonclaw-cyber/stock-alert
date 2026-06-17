"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const TABS = [
  { href: "/", label: "길드별 멤버현황" },
  { href: "/baksajang", label: "박사장길드 내실현황판" },
  { href: "/others", label: "타길드 내실현황" },
  { href: "/boss", label: "보스타이머" },
  { href: "/mine", label: "광산타이머" },
  { href: "/iron", label: "철타이머" },
  { href: "/daily", label: "일숙" },
  { href: "/calendar", label: "일정" },
  { href: "/dwelling", label: "무인의 거처" },
  { href: "/hidden", label: "히든추리용" },
  { href: "/info", label: "정보공유" },
  { href: "/changelog", label: "패치노트" },
];

type Tab = (typeof TABS)[number];

/** 저장된 순서(href 배열)로 탭 정렬. 빠진/추가된 탭은 보정. */
function orderTabs(saved: string[]): Tab[] {
  const map = new Map(TABS.map((t) => [t.href, t]));
  const result: Tab[] = [];
  for (const href of saved) {
    const t = map.get(href);
    if (t) { result.push(t); map.delete(href); }
  }
  for (const t of TABS) if (map.has(t.href)) result.push(t); // 새로 생긴 탭은 뒤에
  return result;
}

export default function TabNav() {
  const pathname = usePathname();
  const [order, setOrder] = useState<Tab[]>(TABS);
  const [editing, setEditing] = useState(false);
  const dragIndex = useRef<number | null>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("tab-order") || "[]");
      if (Array.isArray(saved) && saved.length) setOrder(orderTabs(saved as string[]));
    } catch {
      // 무시
    }
  }, []);

  function save(next: Tab[]) {
    setOrder(next);
    try { localStorage.setItem("tab-order", JSON.stringify(next.map((t) => t.href))); } catch { /* 무시 */ }
  }
  function onDrop(target: number) {
    const from = dragIndex.current;
    dragIndex.current = null;
    if (from == null || from === target) return;
    const next = order.slice();
    const [moved] = next.splice(from, 1);
    next.splice(target, 0, moved);
    save(next);
  }
  function reset() {
    try { localStorage.removeItem("tab-order"); } catch { /* 무시 */ }
    setOrder(TABS);
  }

  return (
    <nav className="flex flex-wrap items-center gap-1 border-b border-white/10">
      {order.map((tab, i) =>
        editing ? (
          <div
            key={tab.href}
            draggable
            onDragStart={() => { dragIndex.current = i; }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => onDrop(i)}
            className="flex cursor-grab select-none items-center gap-1.5 rounded-md border border-dashed border-white/25 bg-white/5 px-3 py-1.5 text-sm text-white/75 active:cursor-grabbing"
            title="드래그해서 순서 이동"
          >
            <span className="text-white/30">⠿</span>
            {tab.label}
          </div>
        ) : (
          <Link
            key={tab.href}
            href={tab.href}
            className={`relative px-3.5 py-2.5 text-sm font-medium transition sm:px-4 ${pathname === tab.href ? "text-white" : "text-white/45 hover:text-white/75"}`}
          >
            {tab.label}
            {pathname === tab.href && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-emerald-400" />}
          </Link>
        ),
      )}
      <div className="ml-auto flex items-center gap-1 pl-2">
        {editing && (
          <button onClick={reset} className="rounded-md px-2 py-1 text-xs text-white/40 hover:text-white" title="기본 순서로">기본순</button>
        )}
        <button
          onClick={() => setEditing((v) => !v)}
          className={`rounded-md border px-2 py-1 text-xs transition ${editing ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-300" : "border-white/15 text-white/45 hover:text-white"}`}
          title="탭 순서를 내 화면에서만 바꿔요"
        >
          {editing ? "완료" : "↕ 탭 순서"}
        </button>
      </div>
    </nav>
  );
}
