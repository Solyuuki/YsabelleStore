import { lazy, Suspense, useEffect, useState } from "react";

import { CustomerErrorBoundary } from "@/components/customer/CustomerErrorBoundary";
import { StoreEntrance } from "@/components/customer/StoreEntrance";
import { CartProvider } from "@/context/CartContext";
import { CustomerAuthProvider, useCustomerAuth } from "@/context/CustomerAuthContext";
import { CustomerFavoritesProvider } from "@/context/CustomerFavoritesContext";
import { CustomerLayout } from "@/layouts/CustomerLayout";
import "driver.js/dist/driver.css";
import "@/styles/customer.css";
import "@/styles/customer-auth.css";
import "@/styles/customer-account.css";
import "@/styles/customer-account-premium.css";
import "@/styles/customer-commerce-premium.css";
import "@/styles/customer-support.css";
import "@/styles/customer-privacy.css";
import "@/styles/customer-home-premium.css";
import "@/styles/auth-brand.css";
import "@/styles/customer-header-actions.css";
import "@/styles/customer-guide-route-transition.css";
import "@/styles/brand.css";
import "@/styles/shopping-guide.css";
import "@/styles/theme-storefront.css";
import "@/styles/theme-storefront-contrast.css";
import {
  getCustomerAuthPageKind,
  isCustomerProtectedRoute,
  resolveCustomerAuthRedirect
} from "@/utils/customerRoutes";
import {
  loadAboutExperienceModule,
  scheduleAboutExperiencePreload
} from "@/utils/aboutExperiencePreload";

const STORE_ENTRANCE_SESSION_KEY = "ysabelle-store-entrance-entered";

const CustomerHomePage = lazy(() =>
  import("@/pages/customer/CustomerHomePage").then(({ CustomerHomePage }) => ({
    default: CustomerHomePage
  }))
);
const ShopPage = lazy(() =>
  import("@/pages/customer/ShopPage").then(({ ShopPage }) => ({ default: ShopPage }))
);
const ProductDetailPage = lazy(() =>
  import("@/pages/customer/ProductDetailPage").then(({ ProductDetailPage }) => ({
    default: ProductDetailPage
  }))
);
const CartPage = lazy(() =>
  import("@/pages/customer/CartPage").then(({ CartPage }) => ({ default: CartPage }))
);
const CheckoutPage = lazy(() =>
  import("@/pages/customer/CheckoutPage").then(({ CheckoutPage }) => ({ default: CheckoutPage }))
);
const OrderSuccessPage = lazy(() =>
  import("@/pages/customer/OrderSuccessPage").then(({ OrderSuccessPage }) => ({
    default: OrderSuccessPage
  }))
);
const AboutExperiencePage = lazy(() =>
  loadAboutExperienceModule().then(({ AboutExperiencePage }) => ({
    default: AboutExperiencePage
  }))
);
const DiscoverPage = lazy(() =>
  import("@/pages/customer/DiscoverPage").then(({ DiscoverPage }) => ({ default: DiscoverPage }))
);
const CustomerLoginPage = lazy(() =>
  import("@/pages/customer/CustomerLoginPage").then(({ CustomerLoginPage }) => ({
    default: CustomerLoginPage
  }))
);
const CustomerRegisterPage = lazy(() =>
  import("@/pages/customer/CustomerRegisterPage").then(({ CustomerRegisterPage }) => ({
    default: CustomerRegisterPage
  }))
);
const CustomerAccountRecoveryPage = lazy(() =>
  import("@/pages/customer/CustomerAccountRecoveryPage").then(
    ({ CustomerAccountRecoveryPage }) => ({
      default: CustomerAccountRecoveryPage
    })
  )
);
const CustomerAccountPage = lazy(() =>
  import("@/pages/customer/CustomerAccountPage").then(({ CustomerAccountPage }) => ({
    default: CustomerAccountPage
  }))
);
const CustomerSupportPage = lazy(() =>
  import("@/pages/customer/CustomerSupportPage").then(({ CustomerSupportPage }) => ({
    default: CustomerSupportPage
  }))
);
const PrivacyPolicyPage = lazy(() =>
  import("@/pages/customer/PrivacyPolicyPage").then(({ PrivacyPolicyPage }) => ({
    default: PrivacyPolicyPage
  }))
);
const CustomerNotFoundPage = lazy(() =>
  import("@/pages/customer/CustomerNotFoundPage").then(({ CustomerNotFoundPage }) => ({
    default: CustomerNotFoundPage
  }))
);

export function CustomerApp({
  location,
  navigate
}: {
  location: string;
  navigate: (path: string) => void;
}) {
  return (
    <CustomerAuthProvider>
      <CustomerFavoritesProvider>
        <CartProvider>
          <CustomerErrorBoundary resetKey={location}>
            <CustomerAppRoutes location={location} navigate={navigate} />
          </CustomerErrorBoundary>
        </CartProvider>
      </CustomerFavoritesProvider>
    </CustomerAuthProvider>
  );
}

function CustomerAppRoutes({
  location,
  navigate
}: {
  location: string;
  navigate: (path: string) => void;
}) {
  const locationUrl = new URL(location, window.location.origin);
  const rawPathname = locationUrl.pathname.replace(/\/$/, "") || "/";
  const pathname =
    window.location.protocol === "file:" && rawPathname.endsWith("/index.html") ? "/" : rawPathname;
  const { status } = useCustomerAuth();
  const redirect = resolveCustomerAuthRedirect(pathname, status, locationUrl.search);
  const authPageKind = getCustomerAuthPageKind(pathname);
  const protectedRoute = isCustomerProtectedRoute(pathname);
  const [storeEntranceDismissed, setStoreEntranceDismissed] = useState(readStoreEntranceState);

  useEffect(() => {
    if (redirect) navigate(redirect);
  }, [navigate, redirect]);

  useEffect(() => {
    if (pathname === "/about") return;
    return scheduleAboutExperiencePreload();
  }, [pathname]);

  if (redirect || ((authPageKind || protectedRoute) && status === "loading")) {
    return (
      <CustomerLayout location={location} navigate={navigate} pathname={pathname}>
        <section className="customer-auth-page">
          <div className="customer-auth-card customer-auth-card--loading" role="status">
            Checking your customer account...
          </div>
        </section>
      </CustomerLayout>
    );
  }

  if (pathname === "/" && !storeEntranceDismissed) {
    return (
      <StoreEntrance
        onEnter={() => {
          writeStoreEntranceState();
          setStoreEntranceDismissed(true);
        }}
      />
    );
  }

  const categoryMatch = pathname.match(/^\/shop\/category\/([^/]+)$/);
  const productMatch = pathname.match(/^\/product\/([^/]+)$/);

  let page;
  if (pathname === "/") page = <CustomerHomePage navigate={navigate} />;
  else if (pathname === "/shop") page = <ShopPage location={location} navigate={navigate} />;
  else if (categoryMatch)
    page = (
      <ShopPage
        categorySlug={decodeURIComponent(categoryMatch[1] ?? "")}
        location={location}
        navigate={navigate}
      />
    );
  else if (productMatch)
    page = (
      <ProductDetailPage
        navigate={navigate}
        productId={decodeURIComponent(productMatch[1] ?? "")}
      />
    );
  else if (pathname === "/cart") page = <CartPage navigate={navigate} />;
  else if (pathname === "/checkout") page = <CheckoutPage navigate={navigate} />;
  else if (pathname === "/order-success")
    page = <OrderSuccessPage location={location} navigate={navigate} />;
  else if (pathname === "/about") page = <AboutExperiencePage navigate={navigate} />;
  else if (pathname === "/discover") page = <DiscoverPage navigate={navigate} />;
  else if (pathname === "/login") page = <CustomerLoginPage navigate={navigate} />;
  else if (pathname === "/register") page = <CustomerRegisterPage navigate={navigate} />;
  else if (pathname === "/account-recovery")
    page = <CustomerAccountRecoveryPage location={location} navigate={navigate} />;
  else if (pathname === "/account") page = <CustomerAccountPage navigate={navigate} />;
  else if (pathname === "/support") page = <CustomerSupportPage navigate={navigate} />;
  else if (pathname === "/privacy") page = <PrivacyPolicyPage navigate={navigate} />;
  else page = <CustomerNotFoundPage navigate={navigate} />;

  return (
    <CustomerLayout location={location} navigate={navigate} pathname={pathname}>
      <Suspense
        fallback={pathname === "/about" ? <AboutRouteFallback /> : <CustomerRouteFallback />}
      >
        {page}
      </Suspense>
    </CustomerLayout>
  );
}

function AboutRouteFallback() {
  return (
    <section
      aria-label="Opening About"
      aria-live="polite"
      className="about-experience-boot"
      role="status"
    >
      <span className="sr-only">Opening Ysabelle Store About experience...</span>
    </section>
  );
}

function CustomerRouteFallback() {
  return (
    <div className="flex min-h-[45vh] items-center justify-center" role="status">
      <div className="flex items-center gap-3 text-sm font-semibold text-slate-600">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
        Loading page...
      </div>
    </div>
  );
}

function readStoreEntranceState() {
  try {
    return window.sessionStorage.getItem(STORE_ENTRANCE_SESSION_KEY) === "true";
  } catch {
    return false;
  }
}

function writeStoreEntranceState() {
  try {
    window.sessionStorage.setItem(STORE_ENTRANCE_SESSION_KEY, "true");
  } catch {
    // Session storage can be unavailable in hardened/private browsing contexts.
  }
}
