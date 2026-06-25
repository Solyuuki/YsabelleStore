import type { ReactNode } from "react";

type AuthLayoutProps = {
  children?: ReactNode;
};

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main
        className="mx-auto flex min-h-screen w-full max-w-md items-center px-6"
        data-layout="auth"
      >
        {children}
      </main>
    </div>
  );
}
