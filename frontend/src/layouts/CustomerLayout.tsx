import type { ReactNode } from "react";

import { CustomerFooter } from "@/components/customer/CustomerFooter";
import { CustomerHeader } from "@/components/customer/CustomerHeader";
import { DiscoverBrandIdentity } from "@/components/customer/DiscoverBrandIdentity";
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
  const { startGuide } = useShoppingGuide(pathname, navigate);

  return (
    <div className="customer-app">
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
