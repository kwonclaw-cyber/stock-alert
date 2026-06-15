import { StoreProvider } from "../components/StoreProvider";
import DashboardShell from "../components/DashboardShell";

// 저장 모드 배지(공유/로컬) 등이 빌드 시점이 아닌 요청 시점의 환경변수를 읽도록 동적 렌더링.
export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <StoreProvider>
      <DashboardShell>{children}</DashboardShell>
    </StoreProvider>
  );
}
