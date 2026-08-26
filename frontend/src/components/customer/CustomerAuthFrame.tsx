import { ArrowRight, ShieldCheck, ShoppingBasket, UserRoundCheck } from "lucide-react";
import type { ReactNode } from "react";

import "@/styles/customer-auth-phase3.css";
import "@/styles/customer-auth-shaders.css";
import "@/styles/customer-auth-interactions.css";

import { CustomerLink } from "./CustomerLink";
import { YsabelleBrandMark } from "./YsabelleBrandMark";

type CustomerAuthFrameProps = {
  children: ReactNode;
  mode: "login" | "register";
  navigate: (path: string) => void;
};

const highlights = [
  {
    icon: ShieldCheck,
    title: "Secure customer access",
    copy: "Your customer account stays separate from Ysabelle Store staff access."
  },
  {
    icon: UserRoundCheck,
    title: "Flexible sign in",
    copy: "Use your username, email address, or Philippine mobile number."
  },
  {
    icon: ShoppingBasket,
    title: "Keep shopping simple",
    copy: "Guest shopping remains available whenever you prefer."
  }
];

export function CustomerAuthFrame({ children, mode, navigate }: CustomerAuthFrameProps) {
  const isRegister = mode === "register";

  return (
    <section
      className={`customer-auth-page customer-auth-page--phase3 customer-auth-page--${mode}`}
    >
      <div className="customer-auth-stage">
        <aside className="customer-auth-stage__brand" aria-label="Ysabelle Store customer account">
          <div className="customer-auth-stage__brand-glow customer-auth-stage__brand-glow--one" />
          <div className="customer-auth-stage__brand-glow customer-auth-stage__brand-glow--two" />

          <div className="customer-auth-stage__identity">
            <YsabelleBrandMark eager variant="display" />
            <div>
              <p className="customer-auth-stage__eyebrow">Ysabelle Store</p>
              <h2>Your neighborhood grocery, online.</h2>
            </div>
          </div>

          <p className="customer-auth-stage__lead">
            {isRegister
              ? "Create one customer account for a faster, more personal storefront experience."
              : "Welcome back to the Ysabelle storefront. Sign in and continue where you left off."}
          </p>

          <div className="customer-auth-stage__visual" aria-hidden="true">
            <img
              alt=""
              decoding="async"
              loading="eager"
              src="images/discover/essentials/beverages-retail-display.webp"
            />
            <div className="customer-auth-stage__visual-card">
              <span>Everyday essentials</span>
              <strong>Ready when you are.</strong>
            </div>
          </div>

          <div className="customer-auth-stage__highlights">
            {highlights.map(({ copy, icon: Icon, title }) => (
              <div className="customer-auth-stage__highlight" key={title}>
                <span aria-hidden="true">
                  <Icon size={18} />
                </span>
                <div>
                  <strong>{title}</strong>
                  <p>{copy}</p>
                </div>
              </div>
            ))}
          </div>

          <CustomerLink
            className="customer-auth-stage__shop-link"
            href="/shop"
            navigate={navigate}
          >
            Continue to shop
            <ArrowRight aria-hidden="true" size={17} />
          </CustomerLink>
        </aside>

        <div className="customer-auth-stage__panel">{children}</div>
      </div>
    </section>
  );
}
