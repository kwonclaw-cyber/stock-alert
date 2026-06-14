import LogoutButton from "./LogoutButton";
import SaveStatus from "./SaveStatus";
import TabNav from "./TabNav";

/** 모든 대시보드 페이지 공통 셸: 제목 + 저장상태 + 로그아웃 + 탭 */
export default function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-[1700px] px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            총겜동 내수서버 내실 현황
          </h1>
          <p className="mt-0.5 text-xs text-white/45">
            숲(SOOP) 방송인 마인크래프트 내수서버 길드 운영
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SaveStatus />
          <LogoutButton />
        </div>
      </header>

      <TabNav />

      <div className="mt-6">{children}</div>
    </main>
  );
}
