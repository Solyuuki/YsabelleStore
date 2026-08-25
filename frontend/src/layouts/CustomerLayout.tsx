import type { ReactNode } from "react";

import { CustomerFooter } from "@/components/customer/CustomerFooter";
import { CustomerHeader } from "@/components/customer/CustomerHeader";
import { DiscoverBrandIdentity } from "@/components/customer/DiscoverBrandIdentity";
import { YsabelleBrandMark } from "@/components/customer/YsabelleBrandMark";
import { useCart } from "@/context/CartContext";
import { useShoppingGuide } from "@/hooks/useShoppingGuide";

export function CustomerLayout({
  children,
  location,
  navigate,
  pathname
}: {
  children: ReactNode;
  location: string;
  navigate: (path: string) => void;
  pathname: string;
}) {
  const { announcement } = useCart();
  const { isPreparingGuide, startGuide } = useShoppingGuide(pathname, navigate);

  return (
    <div className="customer-app">
      <div
        aria-busy={isPreparingGuide}
        aria-hidden={!isPreparingGuide}
        aria-live="polite"
        className={`customer-guide-transition ${isPreparingGuide ? "is-visible" : ""}`}
        role="status"
      >
        <div className="customer-guide-transition__panel">
          <YsabelleBrandMark
            className="customer-guide-transition__mark"
            eager
            variant="mini"
          />
          <div className="customer-guide-transition__copy">
            <strong>Preparing your shopping guide</strong>
            <span>Taking you to the storefront...</span>
          </div>
          <div aria-hidden="true" className="customer-guide-transition__progress">
            <span />
          </div>
        </div>
      </div>
      <a className="customer-skip-link" href="#customer-main">
        Skip to main content
      </a>
      <CustomerHeader
        location={location}
        navigate={navigate}
        onStartGuide={startGuide}
        pathname={pathname}
      />
      <main id="customer-main">{children}</main>
      <DiscoverBrandIdentity pathname={pathname} />
      <CustomerFooter navigate={navigate} onStartGuide={startGuide} />
      <div aria-live="polite" className="sr-only" role="status">
        {announcement}
      </div>
    </div>
  );
}
