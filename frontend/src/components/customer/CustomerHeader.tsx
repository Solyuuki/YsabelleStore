import { CircleHelp, Menu, Search, ShoppingBasket, Store, X } from "lucide-react";
import { useState, type FormEvent } from "react";

import { useCart } from "@/context/CartContext";
import { CustomerLink } from "./CustomerLink";

export function CustomerHeader({
  navigate,
  onStartGuide,
  pathname
}: {
  navigate: (path: string) => void;
  onStartGuide: () => void;
  pathname: string;
}) {
  const { itemCount } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState(
    () => new URL(window.location.href).searchParams.get("search") ?? ""
  );

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    const query = search.trim();
    navigate(query ? `/shop?search=${encodeURIComponent(query)}` : "/shop");
    setMenuOpen(false);
  }

  const links = [
    { href: "/", label: "Home" },
    { href: "/shop", label: "Shop" },
    { href: "/shop#categories", label: "Categories" },
    { href: "/about", label: "About" }
  ];

  return (
    <header className="customer-header">
      <div className="customer-header__bar">
        <CustomerLink className="customer-brand" href="/" navigate={navigate}>
          <span className="customer-brand__mark">
            <Store aria-hidden="true" size={22} />
          </span>
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
                (link.label === "About" && pathname === "/about")
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

        <form className="customer-search" data-tour="search" onSubmit={submitSearch} role="search">
          <Search aria-hidden="true" size={18} />
          <label className="sr-only" htmlFor="customer-global-search">
            Search groceries
          </label>
          <input
            id="customer-global-search"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search groceries..."
            type="search"
            value={search}
          />
          <button type="submit">Search</button>
        </form>

        <div className="customer-header__actions">
          <button
            aria-label="Open shopping guide"
            className="customer-icon-button customer-help-button"
            onClick={onStartGuide}
            type="button"
          >
            <CircleHelp aria-hidden="true" size={20} />
            <span>Guide</span>
          </button>
          <CustomerLink
            aria-label={`Cart with ${itemCount} item${itemCount === 1 ? "" : "s"}`}
            className="customer-cart-link"
            data-tour="cart"
            href="/cart"
            navigate={navigate}
          >
            <ShoppingBasket aria-hidden="true" size={21} />
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
          <button onClick={onStartGuide} type="button">
            Shopping Guide
          </button>
          <CustomerLink href="/staff-login" navigate={navigate} onClick={() => setMenuOpen(false)}>
            Staff / Owner Login
          </CustomerLink>
        </nav>
      </div>
    </header>
  );
}
