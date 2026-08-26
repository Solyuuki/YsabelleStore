import type { ReactNode } from "react";

import "@/styles/customer-auth-phase3.css";
import "@/styles/customer-auth-shaders.css";
import "@/styles/customer-auth-interactions.css";
import "@/styles/customer-auth-wide-composition.css";
import "@/styles/customer-auth-login-premium.css";

type CustomerAuthFrameProps = {
  children: ReactNode;
  mode: "login" | "register";
  navigate: (path: string) => void;
};

export function CustomerAuthFrame({ children, mode }: CustomerAuthFrameProps) {
  return (
    <section
      className={`customer-auth-page customer-auth-page--phase3 customer-auth-page--${mode}`}
    >
      <div className="customer-auth-stage">
        <div className="customer-auth-stage__panel">{children}</div>
      </div>
    </section>
  );
}
