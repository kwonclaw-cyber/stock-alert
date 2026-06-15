"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
];

export default function TabNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-1 border-b border-white/10">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`relative px-3.5 py-2.5 text-sm font-medium transition sm:px-4 ${
              active ? "text-white" : "text-white/45 hover:text-white/75"
            }`}
          >
            {tab.label}
            {active && (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-emerald-400" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
