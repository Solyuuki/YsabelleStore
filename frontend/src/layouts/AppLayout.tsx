import type { ReactNode } from "react";

import type { AppRoutePath } from "@/app/routes";
import { AppSidebar } from "@/components/app/AppSidebar";
import { AppTopbar } from "@/components/app/AppTopbar";
import { NotificationStack } from "@/components/shared/NotificationStack";

type AppLayoutProps = {
  activePath: string;
  children: ReactNode;
  collapsed: boolean;
  routeLabel: string;
  onNavigate: (path: AppRoutePath) => void;
  onToggleSidebar: () => void;
};

export function AppLayout({
  activePath,
  children,
  collapsed,
  onNavigate,
  onToggleSidebar,
  routeLabel
}: AppLayoutProps) {
  return (
    <div className="flex min-h-screen bg-slate-100 text-foreground">
      <AppSidebar activePath={activePath} collapsed={collapsed} onNavigate={onNavigate} />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <AppTopbar routeLabel={routeLabel} onToggleSidebar={onToggleSidebar} />
        <main className="min-h-0 flex-1 overflow-auto p-6" data-layout="app">
          <div className="mx-auto max-w-[1540px] space-y-6">{children}</div>
        </main>
      </div>
      <NotificationStack />
    </div>
  );
}
