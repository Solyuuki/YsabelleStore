import { MapPin } from "lucide-react";

import { CustomerLink } from "./CustomerLink";
import { YsabelleBrandMark } from "./YsabelleBrandMark";

export function CustomerFooter({
  navigate,
  onStartGuide,
  pathname
}: {
  navigate: (path: string) => void;
  onStartGuide: () => void;
  pathname: string;
}) {
  const isShopRoute = pathname === "/shop" || pathname.startsWith("/shop/");

  return (
    <footer className={`customer-footer ${isShopRoute ? "customer-footer--shop" : ""}`}>
      <div aria-hidden="true" className="customer-footer__transition">
        <svg focusable="false" preserveAspectRatio="none" viewBox="0 0 1600 72">
          <defs>
            <linearGradient id="footerTransitionLight" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="var(--footer-transition-blue)" />
              <stop offset="52%" stopColor="var(--footer-transition-center)" />
              <stop offset="100%" stopColor="var(--footer-transition-violet)" />
            </linearGradient>
            <linearGradient id="footerTransitionAccent" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="var(--footer-accent-blue)" />
              <stop offset="55%" stopColor="var(--footer-accent-indigo)" />
              <stop offset="100%" stopColor="var(--footer-accent-violet)" />
            </linearGradient>
          </defs>
          <rect fill="var(--footer-transition-surface)" height="72" width="1600" />
          <path
            d="M0 18C250 42 520 51 810 31C1110 10 1335 49 1600 20V72H0Z"
            fill="url(#footerTransitionLight)"
          />
          <path
            d="M0 35C300 56 600 62 900 44C1180 27 1390 64 1600 39V72H0Z"
            fill="url(#footerTransitionAccent)"
            opacity="0.52"
          />
          <path
            d="M0 47C280 68 610 66 920 50C1190 36 1405 70 1600 52V72H0Z"
            fill="var(--footer-bg)"
          />
        </svg>
        {/* The original light-mode ribbon above stays untouched. In dark mode
            render its approved curved outlines without opaque fills or stretching. */}
        <svg
          className="customer-footer__transition-outline"
          focusable="false"
          preserveAspectRatio="xMidYMid slice"
          viewBox="0 0 1600 72"
        >
          <defs>
            <linearGradient id="footerDarkOutline" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#376aa5" />
              <stop offset="52%" stopColor="#7566c6" />
              <stop offset="100%" stopColor="#9f6ac8" />
            </linearGradient>
          </defs>
          {/* These are the same two wave contours as the original ribbon. */}
          <path
            d="M0 18C250 42 520 51 810 31C1110 10 1335 49 1600 20"
            fill="none"
            stroke="url(#footerDarkOutline)"
            strokeWidth="10"
            strokeOpacity="0.30"
          />
          <path
            d="M0 18C250 42 520 51 810 31C1110 10 1335 49 1600 20"
            fill="none"
            stroke="url(#footerDarkOutline)"
            strokeWidth="2"
            strokeOpacity="0.82"
          />
          <path
            d="M0 35C300 56 600 62 900 44C1180 27 1390 64 1600 39"
            fill="none"
            stroke="url(#footerDarkOutline)"
            strokeWidth="6"
            strokeOpacity="0.26"
          />
          <path
            d="M0 35C300 56 600 62 900 44C1180 27 1390 64 1600 39"
            fill="none"
            stroke="url(#footerDarkOutline)"
            strokeWidth="1.5"
            strokeOpacity="0.55"
          />
        </svg>
      </div>
      <div className="customer-container customer-footer__grid">
        <div className="customer-footer__brand-column">
          <div className="customer-brand customer-brand--footer">
            <YsabelleBrandMark />
            <span>
              <strong>Ysabelle</strong>
              <small>Store</small>
            </span>
          </div>
          <p className="customer-footer__tagline">Everyday essentials, closer to home.</p>
          <p className="customer-footer__description">
            Your Pasig City grocery for pantry staples, snacks, and more.
          </p>
        </div>
        <div className="customer-footer__explore-column">
          <h2>Explore</h2>
          <CustomerLink href="/shop" navigate={navigate}>
            Shop groceries
          </CustomerLink>
          <CustomerLink href="/about" navigate={navigate}>
            About Ysabelle
          </CustomerLink>
          <button onClick={onStartGuide} type="button">
            Shopping Guide
          </button>
          <CustomerLink href="/support" navigate={navigate}>
            Customer Support
          </CustomerLink>
        </div>
        <div className="customer-footer__visit-column">
          <h2>Visit us</h2>
          <p className="customer-footer__location">
            <MapPin aria-hidden="true" size={18} />
            <span>
              110 A. Mabini Street
              <br />
              Pasig City, Metro Manila
            </span>
          </p>
          <CustomerLink className="customer-footer__staff" href="/staff-login" navigate={navigate}>
            Staff / Owner Login
          </CustomerLink>
        </div>
      </div>
      <div className="customer-container customer-footer__bottom">
        <span>Ysabelle&apos;s Store</span>
        <div className="customer-footer__legal">
          <CustomerLink href="/privacy" navigate={navigate}>
            Privacy &amp; cookies
          </CustomerLink>
          <span aria-hidden="true">·</span>
          <CustomerLink href="/support" navigate={navigate}>
            Privacy requests
          </CustomerLink>
        </div>
        <span>Established 2019</span>
      </div>
    </footer>
  );
}
