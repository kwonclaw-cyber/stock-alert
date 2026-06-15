import { StoreProvider } from "../components/StoreProvider";
import DashboardShell from "../components/DashboardShell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <StoreProvider>
      <DashboardShell>{children}</DashboardShell>
    </StoreProvider>
  );
}
