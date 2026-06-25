import type { ReactNode } from "react";

type AppLayoutProps = {
  children?: ReactNode;
};

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="min-h-screen" data-layout="app">
        {children}
      </main>
    </div>
  );
}
