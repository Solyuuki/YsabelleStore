import type { ReactNode } from "react";

import { Header } from "@/components/app/Header";
import { Sidebar } from "@/components/app/Sidebar";

type AppLayoutProps = {
  children?: ReactNode;
};

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background text-foreground lg:grid lg:grid-cols-[18rem_1fr]">
      <Sidebar />
      <div className="min-w-0">
        <Header />
        <main className="min-h-[calc(100vh-4rem)] p-4 sm:p-6" data-layout="app">
          {children}
        </main>
      </div>
    </div>
  );
}
