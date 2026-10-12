import { House, LayoutGrid, ShoppingBasket, UserRound } from "lucide-react";

import { useCart } from "@/context/CartContext";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { CustomerLink } from "./CustomerLink";

/** Shared mobile routes: fixed thumb navigation in portrait, compact row in landscape/tablet. */
export function CustomerMobileNav({
  navigate,
  pathname
}: {
  navigate: (path: string) => void;
  pathname: string;
}) {
  const { itemCount } = useCart();
  const { status } = useCustomerAuth();
  const accountHref = status === "authenticated" ? "/account" : "/login";

  const links = [
    { href: "/", label: "Home", active: pathname === "/", icon: House },
    {
      href: "/shop",
      label: "Shop",
      active: pathname.startsWith("/shop") || pathname.startsWith("/product/"),
      icon: LayoutGrid
    },
    { href: "/cart", label: "Cart", active: pathname === "/cart", icon: ShoppingBasket },
    {
      href: accountHref,
      label: "Account",
      active: ["/account", "/login", "/register", "/account-recovery"].includes(pathname),
      icon: UserRound
    }
  ];

  return (
    <nav aria-label="Mobile storefront navigation" className="customer-mobile-dock">
      {links.map(({ href, label, active, icon: Icon }) => (
        <CustomerLink
          aria-current={active ? "page" : undefined}
          className={`customer-mobile-dock__link${active ? " is-active" : ""}`}
          href={href}
          key={label}
          navigate={navigate}
        >
          <Icon aria-hidden="true" size={19} strokeWidth={2} />
          <span>{label}</span>
          {label === "Cart" && itemCount > 0 ? (
            <span className="customer-mobile-dock__count">
              {itemCount > 99 ? "99+" : itemCount}
            </span>
          ) : null}
        </CustomerLink>
      ))}
    </nav>
  );
}
