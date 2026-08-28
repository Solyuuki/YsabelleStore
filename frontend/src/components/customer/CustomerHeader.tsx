import { CircleHelp, Menu, ShoppingBasket, UserRound, X } from "lucide-react";
import { useState } from "react";

import { useCart } from "@/context/CartContext";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { isCustomerShopRoute } from "@/utils/customerRoutes";
import { CustomerLink } from "./CustomerLink";
import { GlobalStorefrontSearch } from "./GlobalStorefrontSearch";
import { YsabelleBrandMark } from "./YsabelleBrandMark";

export function CustomerHeader({
  location,
  navigate,
  onStartGuide,
  pathname
}: {
  location: string;
  navigate: (path: string) => void;
  onStartGuide: () => void;
  pathname: string;
}) {
  const { itemCount } = useCart();
  const { customer, status } = useCustomerAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const isShopRoute = isCustomerShopRoute(pathname);
  const accountHref = status === "authenticated" ? "/account" : "/login";
  const accountLabel = status === "authenticated" ? "My Account" : "Sign In";

  const links = [
    { href: "/", label: "Home" },
    { href: "/shop", label: "Shop" },
    { href: "/about", label: "About" }
  ];

  return (
    <header className="customer-header">
      <div className="customer-header__bar">
        <CustomerLink className="customer-brand" href="/" navigate={navigate}>
          <YsabelleBrandMark eager />
          <span>
            <strong>Ysabelle</strong>
            <small>Store</small>
          </span>
        </CustomerLink>

        <nav aria-label="Customer navigation" className="customer-nav">
          {links.map((link) => (
            <CustomerLink
              aria-current={
                (link.label === "Home" && pathname === "/") ||
                (link.label === "Shop" && pathname.startsWith("/shop")) ||
                (link.href === "/about" && ["/about", "/discover"].includes(pathname))
                  ? "page"
                  : undefined
              }
              href={link.href}
              key={link.href}
              navigate={navigate}
            >
              {link.label}
            </CustomerLink>
          ))}
        </nav>

        <div
          aria-hidden={isShopRoute || undefined}
          className={`customer-header__search-region ${isShopRoute ? "is-hidden" : ""}`}
          inert={isShopRoute || undefined}
        >
          <GlobalStorefrontSearch enabled={!isShopRoute} location={location} navigate={navigate} />
        </div>

        <div className="customer-header__actions">
          <button
            aria-label="Open shopping guide"
            className="customer-icon-button customer-help-button"
            onClick={onStartGuide}
            type="button"
          >
            <CircleHelp aria-hidden="true" size={19} />
            <span>Guide</span>
          </button>
          <span aria-hidden="true" className="customer-header__action-divider" />
          <CustomerLink
            aria-current={pathname === "/account" || pathname === "/login" ? "page" : undefined}
            aria-label={
              customer ? `My account, signed in as ${customer.name}` : "Sign in to customer account"
            }
            className="customer-account-link"
            href={accountHref}
            navigate={navigate}
          >
            <UserRound aria-hidden="true" size={18} />
            <span>{accountLabel}</span>
          </CustomerLink>
          <CustomerLink
            aria-label={`Cart with ${itemCount} item${itemCount === 1 ? "" : "s"}`}
            className="customer-cart-link"
            data-tour="cart"
            href="/cart"
            navigate={navigate}
          >
            <ShoppingBasket aria-hidden="true" size={19} />
            <span>Cart</span>
            {itemCount > 0 ? <strong>{itemCount > 99 ? "99+" : itemCount}</strong> : null}
          </CustomerLink>
          <button
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className="customer-menu-button"
            onClick={() => setMenuOpen((current) => !current)}
            type="button"
          >
            {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
      </div>

      <div className={`customer-mobile-panel ${menuOpen ? "is-open" : ""}`}>
        <nav aria-label="Mobile customer navigation">
          {links.map((link) => (
            <CustomerLink
              href={link.href}
              key={link.href}
              navigate={navigate}
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </CustomerLink>
          ))}
          <CustomerLink href={accountHref} navigate={navigate} onClick={() => setMenuOpen(false)}>
            {accountLabel}
          </CustomerLink>
          <button onClick={onStartGuide} type="button">
            Shopping Guide
          </button>
        </nav>
      </div>
    </header>
  );
}
