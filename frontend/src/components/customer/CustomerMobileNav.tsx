import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  BookOpen,
  Headphones,
  Heart,
  History,
  House,
  LayoutGrid,
  LogOut,
  Plus,
  ShoppingBasket,
  Store,
  ShieldCheck,
  UserRound,
  X
} from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

import { useCart } from "@/context/CartContext";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { CustomerLink } from "./CustomerLink";

/** Single mobile navigation: four destinations and an accessible central More menu. */
export function CustomerMobileNav({
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
  const { status, customer, logout } = useCustomerAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [accountMenuRight, setAccountMenuRight] = useState(12);
  const dockRef = useRef<HTMLElement>(null);
  const accountTriggerRef = useRef<HTMLButtonElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const [occupiedDockHeight, setOccupiedDockHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const dock = dockRef.current;
    if (!dock) return;

    const measure = () => {
      // Phone and tablet both anchor their navigation at the bottom.
      if (getComputedStyle(dock).position !== "fixed") {
        setOccupiedDockHeight(null);
        return;
      }

      const occupied = Math.ceil(
        Math.max(0, window.innerHeight - dock.getBoundingClientRect().top)
      );
      setOccupiedDockHeight((previous) => (previous === occupied ? previous : occupied));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(dock);
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
    };
  }, [moreOpen]);

  useEffect(() => {
    setAccountOpen(false);
  }, [location]);

  useLayoutEffect(() => {
    if (!accountOpen) return;
    const positionMenu = () => {
      const trigger = accountTriggerRef.current;
      if (!trigger) return;
      setAccountMenuRight(
        Math.max(12, Math.ceil(window.innerWidth - trigger.getBoundingClientRect().right))
      );
    };
    positionMenu();
    window.addEventListener("resize", positionMenu);
    window.visualViewport?.addEventListener("resize", positionMenu);
    return () => {
      window.removeEventListener("resize", positionMenu);
      window.visualViewport?.removeEventListener("resize", positionMenu);
    };
  }, [accountOpen]);

  useEffect(() => {
    if (!accountOpen) return;
    accountMenuRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();

    const dismissOutside = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (accountTriggerRef.current?.contains(event.target)) return;
      if (accountMenuRef.current?.contains(event.target)) return;
      setAccountOpen(false);
    };
    const dismissEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setAccountOpen(false);
      accountTriggerRef.current?.focus();
    };
    const dismissFocusOutside = (event: FocusEvent) => {
      if (!(event.target instanceof Node)) return;
      if (accountTriggerRef.current?.contains(event.target)) return;
      if (accountMenuRef.current?.contains(event.target)) return;
      setAccountOpen(false);
    };
    document.addEventListener("pointerdown", dismissOutside, true);
    document.addEventListener("keydown", dismissEscape);
    document.addEventListener("focusin", dismissFocusOutside);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside, true);
      document.removeEventListener("keydown", dismissEscape);
      document.removeEventListener("focusin", dismissFocusOutside);
    };
  }, [accountOpen]);

  const accountHref = status === "authenticated" ? "/account" : "/login";
  const activeAccountView =
    new URL(location, window.location.origin).searchParams.get("view") ?? "orders";
  const accountActive = ["/account", "/login", "/register", "/account-recovery"].includes(
    pathname
  );
  const accountViews = [
    { view: "orders", label: "Orders", icon: History },
    { view: "favorites", label: "Favorites", icon: Heart },
    { view: "profile", label: "Profile", icon: UserRound },
    { view: "security", label: "Security", icon: ShieldCheck }
  ];

  async function handleAccountSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await logout();
    } catch {
      // Auth context also clears the local session when revocation fails.
    } finally {
      setSigningOut(false);
      setAccountOpen(false);
      navigate("/");
    }
  }

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

  function renderLink({ href, label, active, icon: Icon }: (typeof links)[number]) {
    return (
      <CustomerLink
        aria-current={active ? "page" : undefined}
        className={`customer-mobile-dock__link${active ? " is-active" : ""}`}
        href={href}
        key={label}
        navigate={navigate}
        onClick={() => {
          setMoreOpen(false);
          setAccountOpen(false);
        }}
      >
        <Icon aria-hidden="true" size={19} strokeWidth={2} />
        <span>{label}</span>
        {label === "Cart" && itemCount > 0 ? (
          <span className="customer-mobile-dock__count">
            {itemCount > 99 ? "99+" : itemCount}
          </span>
        ) : null}
      </CustomerLink>
    );
  }

  return (
    <DialogPrimitive.Root onOpenChange={setMoreOpen} open={moreOpen}>
      <nav aria-label="Mobile storefront navigation" className="customer-mobile-dock" ref={dockRef}>
        {links.slice(0, 2).map(renderLink)}
        <DialogPrimitive.Trigger asChild>
          <button
            aria-label={moreOpen ? "Close more options" : "Open more options"}
            aria-expanded={moreOpen}
            className="customer-mobile-dock__more"
            onClick={() => setAccountOpen(false)}
            type="button"
          >
            <span aria-hidden="true" className="customer-mobile-dock__more-icon">
              {moreOpen ? <X size={22} /> : <Plus size={22} />}
            </span>
            <span>More</span>
          </button>
        </DialogPrimitive.Trigger>
        {links.slice(2, 3).map(renderLink)}
        {status === "authenticated" ? (
          <button
            aria-controls="customer-mobile-account-menu"
            aria-current={accountActive ? "page" : undefined}
            aria-expanded={accountOpen}
            aria-haspopup="dialog"
            aria-label="Account options"
            className={`customer-mobile-dock__link customer-mobile-dock__account${accountActive ? " is-active" : ""}`}
            onClick={() => {
              setMoreOpen(false);
              setAccountOpen((current) => !current);
            }}
            ref={accountTriggerRef}
            type="button"
          >
            <UserRound aria-hidden="true" size={19} strokeWidth={2} />
            <span>Account</span>
          </button>
        ) : (
          links.slice(3).map(renderLink)
        )}
      </nav>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="customer-mobile-more__overlay" />
        <DialogPrimitive.Content
          className="customer-mobile-more__sheet"
          style={
            occupiedDockHeight === null
              ? undefined
              : ({
                  "--store-mobile-measured-dock-height": `${occupiedDockHeight}px`
                } as CSSProperties)
          }
        >
          <div className="customer-mobile-more__header">
            <div>
              <DialogPrimitive.Title className="customer-mobile-more__title">
                Explore Ysabelle
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="customer-mobile-more__description">
                More ways to shop and get help.
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close asChild>
              <button
                aria-label="Close more options"
                className="customer-mobile-more__close"
                type="button"
              >
                <X aria-hidden="true" size={20} />
              </button>
            </DialogPrimitive.Close>
          </div>

          <div className="customer-mobile-more__options">
            <CustomerLink href="/about" navigate={navigate} onClick={() => setMoreOpen(false)}>
              <Store aria-hidden="true" size={20} />
              <span>About Us</span>
            </CustomerLink>
            <CustomerLink href="/support" navigate={navigate} onClick={() => setMoreOpen(false)}>
              <Headphones aria-hidden="true" size={20} />
              <span>Customer Support</span>
            </CustomerLink>
            <button
              onClick={() => {
                setMoreOpen(false);
                onStartGuide();
              }}
              type="button"
            >
              <BookOpen aria-hidden="true" size={20} />
              <span>Shopping Guide</span>
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>

      {accountOpen && customer
        ? createPortal(
            <div
              aria-label="Account options"
              className="customer-mobile-account__popover"
              id="customer-mobile-account-menu"
              ref={accountMenuRef}
              role="dialog"
              style={
                {
                  right: accountMenuRight,
                  "--store-mobile-measured-dock-height": `${occupiedDockHeight ?? 76}px`
                } as CSSProperties
              }
            >
              <div className="customer-mobile-account__identity">
                <span aria-hidden="true" className="customer-mobile-account__avatar">
                  {customer.name.trim().slice(0, 1).toUpperCase() || "Y"}
                </span>
                <span className="customer-mobile-account__identity-copy">
                  <small>MY ACCOUNT</small>
                  <strong title={customer.name}>{customer.name}</strong>
                </span>
              </div>
              <div aria-label="Account sections" className="customer-mobile-account__views">
                {accountViews.map(({ view, label, icon: Icon }) => (
                  <button
                    aria-current={
                      pathname === "/account" && activeAccountView === view ? "page" : undefined
                    }
                    className="customer-mobile-account__view"
                    key={view}
                    onClick={() => {
                      setAccountOpen(false);
                      navigate(`/account?view=${view}`);
                    }}
                    type="button"
                  >
                    <Icon aria-hidden="true" size={18} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
              <button
                className="customer-mobile-account__signout"
                disabled={signingOut}
                onClick={() => void handleAccountSignOut()}
                type="button"
              >
                <LogOut aria-hidden="true" size={18} />
                <span>{signingOut ? "Signing out..." : "Sign out"}</span>
              </button>
            </div>,
            document.body
          )
        : null}
    </DialogPrimitive.Root>
  );
}
