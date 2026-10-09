import type { ReactNode } from "react";

import { StorefrontGalaxyArtwork } from "./StorefrontGalaxyArtwork";

import "@/styles/customer-auth-phase3.css";
import "@/styles/customer-auth-shaders.css";
import "@/styles/customer-auth-interactions.css";
import "@/styles/customer-auth-wide-composition.css";
import "@/styles/customer-auth-login-premium.css";

type CustomerAuthFrameProps = {
  children: ReactNode;
  mode: "login" | "register" | "recovery";
  navigate: (path: string) => void;
};

export function CustomerAuthFrame({ children, mode }: CustomerAuthFrameProps) {
  return (
    <section
      className={`customer-auth-page customer-auth-page--phase3 customer-auth-page--${mode} ys-glass-flow-background`}
    >
      {mode === "login" ? (
        <>
          <StorefrontGalaxyArtwork className="customer-auth-page--login__cosmos" />
          {/* Login-only orbit balance: dominant arc right, faint counter-orbit left.
              The decorative viewBox remains proportional; no stretched bitmap. */}
          <svg
            aria-hidden="true"
            className="customer-auth-page--login__balanced-orbits"
            focusable="false"
            preserveAspectRatio="xMidYMid slice"
            viewBox="0 0 1600 1000"
          >
            <g fill="none" strokeLinecap="round">
              <circle cx="1560" cy="155" r="365" stroke="#A68CFA" strokeOpacity="0.36" strokeWidth="1.5" />
              <circle cx="1560" cy="155" r="452" stroke="#9A93EE" strokeOpacity="0.16" strokeWidth="1" />
              <circle cx="76" cy="1065" r="322" stroke="#99A7EC" strokeOpacity="0.15" strokeWidth="1" />
              <circle cx="76" cy="1065" r="405" stroke="#9D85DF" strokeOpacity="0.07" strokeWidth="0.9" />
            </g>
            <g fill="#B7A2FC">
              <circle cx="1302" cy="32" r="5.5" opacity="0.68" />
              <circle cx="1431" cy="115" r="3.1" opacity="0.52" />
              <circle cx="1485" cy="500" r="3.7" opacity="0.42" />
              <circle cx="1202" cy="327" r="2" opacity="0.35" />
              <circle cx="225" cy="795" r="2.5" opacity="0.23" />
            </g>
          </svg>
        </>
      ) : null}
      <div className="customer-auth-stage">
        <div
          className={`customer-auth-stage__panel${mode === "recovery" ? "" : " ys-material-surface"}`}
        >
          {children}
        </div>
      </div>
    </section>
  );
}
