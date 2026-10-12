import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  BookOpen,
  Headphones,
  House,
  LayoutGrid,
  Plus,
  ShoppingBasket,
  Store,
  UserRound,
  X
} from "lucide-react";
import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";

import { useCart } from "@/context/CartContext";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { CustomerLink } from "./CustomerLink";

/** Single mobile navigation: four destinations and an accessible central More menu. */
export function CustomerMobileNav({
  navigate,
  onStartGuide,
  pathname
}: {
  navigate: (path: string) => void;
  onStartGuide: () => void;
  pathname: string;
}) {
  const { itemCount } = useCart();
  const { status } = useCustomerAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const dockRef = useRef<HTMLElement>(null);
  const [occupiedDockHeight, setOccupiedDockHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const dock = dockRef.current;
    if (!dock) return;

    const measure = () => {
      // The dock is fixed in portrait only. Landscape/tablet uses normal flow,
      // so the floating menu follows its own landscape CSS positioning.
      if (getComputedStyle(dock).position !== "fixed") {
        setOccupiedDockHeight(null);
        return;
      }

      const occupied = Math.ceil(Math.max(0, window.innerHeight - dock.getBoundingClientRect().top));
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

  function renderLink({ href, label, active, icon: Icon }: (typeof links)[number]) {
    return (
      <CustomerLink
        aria-current={active ? "page" : undefined}
        className={`customer-mobile-dock__link${active ? " is-active" : ""}`}
        href={href}
        key={label}
        navigate={navigate}
        onClick={() => setMoreOpen(false)}
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
            type="button"
          >
            <span aria-hidden="true" className="customer-mobile-dock__more-icon">
              {moreOpen ? <X size={22} /> : <Plus size={22} />}
            </span>
            <span>More</span>
          </button>
        </DialogPrimitive.Trigger>
        {links.slice(2).map(renderLink)}
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
    </DialogPrimitive.Root>
  );
}
