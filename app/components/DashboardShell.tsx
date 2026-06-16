import LogoutButton from "./LogoutButton";
import RefreshButton from "./RefreshButton";
import SaveStatus from "./SaveStatus";
import TabNav from "./TabNav";
import UpdateBanner from "./UpdateBanner";
import AlarmOverlay from "./AlarmOverlay";
import { usingKv } from "@/lib/store";

/** 모든 대시보드 페이지 공통 셸: 제목 + 저장상태 + 로그아웃 + 탭 */
export default function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-[1700px] px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3 pb-4">
        <div>
          <h1 className="flex flex-wrap items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl">
            <span>생문이 도우미 <span className="text-white/50">by 킹카콜라</span></span>
            <a
              href="https://open.kakao.com/o/sT8dlFzi"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#FEE500] px-3 py-1.5 text-sm font-bold text-[#3C1E1E] transition hover:brightness-95"
              title="카카오톡 오픈채팅으로 요청·문의하기"
            >
              💬 요청&문의하기
            </a>
          </h1>
          <p className="mt-0.5 text-xs text-white/45">
            숲(SOOP) 방송인 마인크래프트 내수서버 길드 운영
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
              usingKv
                ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                : "border-white/15 text-white/40"
            }`}
            title={usingKv ? "KV 연결됨 — 여러 명이 실시간 공유" : "로컬 파일 저장 — 공유하려면 KV 연결 필요"}
          >
            {usingKv ? "공유 저장 ON" : "로컬 저장"}
          </span>
          <SaveStatus />
          <RefreshButton />
          <LogoutButton />
        </div>
      </header>

      <TabNav />

      <div className="mt-6">{children}</div>
      <UpdateBanner />
      <AlarmOverlay />
    </main>
  );
}
