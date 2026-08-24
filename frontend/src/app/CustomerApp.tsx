import { CartProvider } from "@/context/CartContext";
import { CustomerLayout } from "@/layouts/CustomerLayout";
import { AboutExperiencePage } from "@/pages/customer/AboutExperiencePage";
import { CartPage } from "@/pages/customer/CartPage";
import { CheckoutPage } from "@/pages/customer/CheckoutPage";
import { CustomerHomePage } from "@/pages/customer/CustomerHomePage";
import { CustomerNotFoundPage } from "@/pages/customer/CustomerNotFoundPage";
import { DiscoverPage } from "@/pages/customer/DiscoverPage";
import { OrderSuccessPage } from "@/pages/customer/OrderSuccessPage";
import { ProductDetailPage } from "@/pages/customer/ProductDetailPage";
import { ShopPage } from "@/pages/customer/ShopPage";
import "driver.js/dist/driver.css";
import "@/styles/customer.css";
import "@/styles/brand.css";
import "@/styles/shopping-guide.css";

export function CustomerApp({
  location,
  navigate
}: {
  location: string;
  navigate: (path: string) => void;
}) {
  const rawPathname =
    new URL(location, window.location.origin).pathname.replace(/\/$/, "") || "/";
  const pathname =
    window.location.protocol === "file:" && rawPathname.endsWith("/index.html")
      ? "/"
      : rawPathname;
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
  else page = <CustomerNotFoundPage navigate={navigate} />;

  return (
    <CartProvider>
      <CustomerLayout location={location} navigate={navigate} pathname={pathname}>
        {page}
      </CustomerLayout>
    </CartProvider>
  );
}
