import { CircleHelp, MoonStar, Search, ShoppingBasket, Sun, UserRound, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useCart } from "@/context/CartContext";
import { useAppearance } from "@/context/AppearanceContext";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { isCustomerShopRoute } from "@/utils/customerRoutes";
import { preloadAboutExperience } from "@/utils/aboutExperiencePreload";
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
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const mobileSearchRef = useRef<HTMLDivElement>(null);
  const mobileSearchTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMobileSearchOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileSearchOpen) return;

    const dismissOutsideSearch = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (mobileSearchRef.current?.contains(target)) return;
      if (target.closest(".customer-mobile-search-trigger")) return;
      if (target.closest(".customer-global-search__positioner")) return;
      setMobileSearchOpen(false);
    };

    // GlobalSearch can stop its own Escape keydown when dismissing suggestions.
    // A capture listener closes the mobile search shell regardless of nested
    // autocomplete key handling or portaled results.
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMobileSearchOpen(false);
      mobileSearchTriggerRef.current?.focus();
    };

    document.addEventListener("pointerdown", dismissOutsideSearch);
    document.addEventListener("keydown", dismissOnEscape, true);
    return () => {
      document.removeEventListener("pointerdown", dismissOutsideSearch);
      document.removeEventListener("keydown", dismissOnEscape, true);
    };
  }, [mobileSearchOpen]);
  const { storefrontTheme, setStorefrontTheme } = useAppearance();
  const { customer, status } = useCustomerAuth();
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
              onFocus={link.href === "/about" ? () => preloadAboutExperience() : undefined}
              onPointerEnter={link.href === "/about" ? () => preloadAboutExperience() : undefined}
            >
              {link.label}
            </CustomerLink>
          ))}
        </nav>

        <div
          aria-hidden={isShopRoute || undefined}
          className={`customer-header__search-region ${isShopRoute ? "is-hidden" : ""} ${mobileSearchOpen ? "is-mobile-open" : ""}`}
          inert={isShopRoute || undefined}
          ref={mobileSearchRef}
        >
          <GlobalStorefrontSearch
            autoFocus={mobileSearchOpen}
            enabled={!isShopRoute}
            location={location}
            navigate={navigate}
          />
        </div>

        <div className="customer-header__actions">
          {!isShopRoute ? (
            <button
              aria-controls="customer-global-search"
              aria-expanded={mobileSearchOpen}
              aria-label={mobileSearchOpen ? "Close storefront search" : "Open storefront search"}
              className="customer-theme-toggle customer-mobile-search-trigger"
              onClick={() => setMobileSearchOpen((current) => !current)}
              ref={mobileSearchTriggerRef}
              type="button"
            >
              {mobileSearchOpen ? (
                <X aria-hidden="true" size={19} />
              ) : (
                <Search aria-hidden="true" size={19} />
              )}
            </button>
          ) : null}
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
            aria-label={
              storefrontTheme === "dark"
                ? "Switch storefront to light mode"
                : "Switch storefront to dark mode"
            }
            aria-pressed={storefrontTheme === "dark"}
            className="customer-theme-toggle"
            onClick={() => setStorefrontTheme(storefrontTheme === "dark" ? "light" : "dark")}
            title={storefrontTheme === "dark" ? "Light mode" : "Dark mode"}
            type="button"
          >
            {storefrontTheme === "dark" ? (
              <Sun aria-hidden="true" size={19} />
            ) : (
              <MoonStar aria-hidden="true" size={19} />
            )}
          </button>
        </div>
      </div>

    </header>
  );
}
