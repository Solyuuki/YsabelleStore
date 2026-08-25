import { useEffect } from "react";

import { CartProvider } from "@/context/CartContext";
import { CustomerAuthProvider, useCustomerAuth } from "@/context/CustomerAuthContext";
import { CustomerLayout } from "@/layouts/CustomerLayout";
import { AboutExperiencePage } from "@/pages/customer/AboutExperiencePage";
import { CartPage } from "@/pages/customer/CartPage";
import { CheckoutPage } from "@/pages/customer/CheckoutPage";
import { CustomerAccountPage } from "@/pages/customer/CustomerAccountPage";
import { CustomerHomePage } from "@/pages/customer/CustomerHomePage";
import { CustomerLoginPage } from "@/pages/customer/CustomerLoginPage";
import { CustomerNotFoundPage } from "@/pages/customer/CustomerNotFoundPage";
import { CustomerRegisterPage } from "@/pages/customer/CustomerRegisterPage";
import { DiscoverPage } from "@/pages/customer/DiscoverPage";
import { OrderSuccessPage } from "@/pages/customer/OrderSuccessPage";
import { ProductDetailPage } from "@/pages/customer/ProductDetailPage";
import { ShopPage } from "@/pages/customer/ShopPage";
import "driver.js/dist/driver.css";
import "@/styles/customer.css";
import "@/styles/customer-auth.css";
import "@/styles/customer-header-actions.css";
import "@/styles/brand.css";
import "@/styles/shopping-guide.css";
import { getCustomerAuthPageKind, resolveCustomerAuthRedirect } from "@/utils/customerRoutes";

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
  const rawPathname = new URL(location, window.location.origin).pathname.replace(/\/$/, "") || "/";
  const pathname =
    window.location.protocol === "file:" && rawPathname.endsWith("/index.html") ? "/" : rawPathname;
  const { status } = useCustomerAuth();
  const redirect = resolveCustomerAuthRedirect(pathname, status);
  const authPageKind = getCustomerAuthPageKind(pathname);

  useEffect(() => {
    if (redirect) navigate(redirect);
  }, [navigate, redirect]);

  if (redirect || (authPageKind && status === "loading")) {
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
  else if (pathname === "/account") page = <CustomerAccountPage navigate={navigate} />;
  else page = <CustomerNotFoundPage navigate={navigate} />;

  return (
    <CustomerLayout location={location} navigate={navigate} pathname={pathname}>
      {page}
    </CustomerLayout>
  );
}
