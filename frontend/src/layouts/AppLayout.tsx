import type { ReactNode } from "react";

import type { AppRoutePath } from "@/app/routes";
import { AppSidebar } from "@/components/app/AppSidebar";
import { AppTopbar } from "@/components/app/AppTopbar";
import { NotificationStack } from "@/components/shared/NotificationStack";

type AppLayoutProps = {
  activePath: string;
  children: ReactNode;
  collapsed: boolean;
  onNavigate: (path: AppRoutePath) => void;
  onToggleSidebar: () => void;
};

export function AppLayout({
  activePath,
  children,
  collapsed,
  onNavigate,
  onToggleSidebar
}: AppLayoutProps) {
  return (
    <div className="app-shell-ambient relative flex min-h-screen overflow-hidden text-foreground">
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
        <div className="app-shell-orb left-[8%] top-[8%] h-[clamp(18rem,26vw,28rem)] w-[clamp(18rem,26vw,28rem)] bg-emerald-200/35" />
        <div className="app-shell-orb right-[6%] top-[12%] h-[clamp(16rem,24vw,26rem)] w-[clamp(16rem,24vw,26rem)] bg-emerald-100/35 animation-delay-7000" />
        <div className="app-shell-orb bottom-[4%] left-[32%] h-[clamp(15rem,22vw,24rem)] w-[clamp(15rem,22vw,24rem)] bg-stone-200/35 animation-delay-14000" />
      </div>

      <AppSidebar
        activePath={activePath}
        collapsed={collapsed}
        onNavigate={onNavigate}
        onToggleSidebar={onToggleSidebar}
      />
      <div className="relative z-10 flex min-h-screen min-w-0 flex-1 flex-col">
        <AppTopbar />
        <main
          className="min-h-0 flex-1 overflow-auto px-[clamp(1.25rem,2vw,1.5rem)] pb-[clamp(1.25rem,2vw,1.5rem)] pt-[6rem]"
          data-layout="app"
        >
          <div className="mx-auto max-w-[1540px] space-y-6">{children}</div>
        </main>
      </div>
      <NotificationStack />
    </div>
  );
}
