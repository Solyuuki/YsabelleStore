import { lazy, Suspense, useEffect } from "react";

import { CartProvider } from "@/context/CartContext";
import { CustomerAuthProvider, useCustomerAuth } from "@/context/CustomerAuthContext";
import { CustomerLayout } from "@/layouts/CustomerLayout";
import { SessionRequiredPage } from "@/pages/SessionRequiredPage";
import "driver.js/dist/driver.css";
import "@/styles/customer.css";
import "@/styles/customer-auth.css";
import "@/styles/customer-account.css";
import "@/styles/customer-account-premium.css";
import "@/styles/auth-brand.css";
import "@/styles/customer-header-actions.css";
import "@/styles/customer-guide-route-transition.css";
import "@/styles/brand.css";
import "@/styles/shopping-guide.css";
import {
  buildCustomerAuthPath,
  getCustomerAuthPageKind,
  isCustomerProtectedRoute,
  resolveCustomerAuthRedirect
} from "@/utils/customerRoutes";

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
  import("@/pages/customer/AboutExperiencePage").then(({ AboutExperiencePage }) => ({
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
      <CartProvider>
        <CustomerAppRoutes location={location} navigate={navigate} />
      </CartProvider>
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
  const authPageKind = getCustomerAuthPageKind(pathname);
  const protectedRoute = isCustomerProtectedRoute(pathname);
  const sessionRequired = protectedRoute && status === "unauthenticated";
  const redirect = sessionRequired
    ? null
    : resolveCustomerAuthRedirect(pathname, status, locationUrl.search);

  useEffect(() => {
    if (redirect) navigate(redirect);
  }, [navigate, redirect]);

  if (sessionRequired) {
    const returnTo = `${pathname}${locationUrl.search}`;

    return (
      <SessionRequiredPage
        audience="customer"
        onBack={() => navigate("/")}
        onSignIn={() => navigate(buildCustomerAuthPath("/login", returnTo))}
      />
    );
  }

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
  else {
    return (
      <Suspense fallback={<CustomerRouteFallback fullScreen />}>
        <CustomerNotFoundPage navigate={navigate} />
      </Suspense>
    );
  }

  return (
    <CustomerLayout location={location} navigate={navigate} pathname={pathname}>
      <Suspense fallback={<CustomerRouteFallback />}>{page}</Suspense>
    </CustomerLayout>
  );
}

function CustomerRouteFallback({ fullScreen = false }: { fullScreen?: boolean }) {
  return (
    <div
      className={`flex items-center justify-center ${fullScreen ? "min-h-screen" : "min-h-[45vh]"}`}
      role="status"
    >
      <div className="flex items-center gap-3 text-sm font-semibold text-slate-600">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
        Loading page...
      </div>
    </div>
  );
}
