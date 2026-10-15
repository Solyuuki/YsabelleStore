import { LogOut, Menu, Moon, Settings, Sun, UserRound, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { appRoutes, type AppRoutePath } from "@/app/routes";
import { YsabelleBrandMark } from "@/components/customer/YsabelleBrandMark";
import { useAppearance } from "@/context/AppearanceContext";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger
} from "@/components/ui/sheet";
import type { AuthUser } from "@/types/auth";

type RetailMobileNavigationProps = {
  activePath: string;
  onLogout: () => void;
  onNavigate: (path: AppRoutePath) => void;
  user: AuthUser | null;
};

// Every link comes from the established route registry, so role permissions
// match desktop. Groups only organize the presentation, not authorization.
const navigationGroups = [
  {
    title: "Daily operations",
    paths: ["/dashboard", "/pos", "/inventory", "/deliveries", "/sales", "/customer-support"]
  },
  {
    title: "Catalog & stock",
    paths: ["/products", "/categories", "/receiving"]
  },
  {
    title: "Owner tools",
    paths: ["/forecast", "/reports", "/users", "/settings"]
  }
] as const satisfies readonly { title: string; paths: readonly AppRoutePath[] }[];

export function RetailMobileNavigation({
  activePath,
  onLogout,
  onNavigate,
  user
}: RetailMobileNavigationProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountTriggerRef = useRef<HTMLButtonElement>(null);
  const accountPanelRef = useRef<HTMLDivElement>(null);
  const { retailTheme, setRetailTheme } = useAppearance();
  const role = user?.role ?? "STAFF";
  const roleLabel = role === "OWNER" ? "Owner" : "Staff";

  useEffect(() => {
    setDrawerOpen(false);
    setAccountOpen(false);
  }, [activePath]);

  // Dismiss a portaled sheet when the viewport becomes a tablet/desktop;
  // CSS alone would hide its trigger but leave the overlay on screen.
  useEffect(() => {
    const mobileViewport = window.matchMedia(
      "(max-width: 767px), (max-height: 500px) and (orientation: landscape) and (max-width: 1024px)"
    );
    const dismissIfDesktop = () => {
      if (!mobileViewport.matches) {
        setDrawerOpen(false);
        setAccountOpen(false);
      }
    };
    mobileViewport.addEventListener("change", dismissIfDesktop);
    return () => mobileViewport.removeEventListener("change", dismissIfDesktop);
  }, []);

  useEffect(() => {
    if (!accountOpen) return;

    const handleOutsideClick = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (accountTriggerRef.current?.contains(event.target)) return;
      if (accountPanelRef.current?.contains(event.target)) return;
      setAccountOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setAccountOpen(false);
      accountTriggerRef.current?.focus();
    };
    const handleFocusOutside = (event: FocusEvent) => {
      if (!(event.target instanceof Node)) return;
      if (accountTriggerRef.current?.contains(event.target)) return;
      if (accountPanelRef.current?.contains(event.target)) return;
      setAccountOpen(false);
    };

    document.addEventListener("pointerdown", handleOutsideClick, true);
    document.addEventListener("keydown", handleEscape);
    document.addEventListener("focusin", handleFocusOutside);
    return () => {
      document.removeEventListener("pointerdown", handleOutsideClick, true);
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("focusin", handleFocusOutside);
    };
  }, [accountOpen]);

  const navigateAndDismiss = (path: AppRoutePath) => {
    setAccountOpen(false);
    setDrawerOpen(false);
    onNavigate(path);
  };

  return (
    <div className="retail-mobile-nav" data-retail-navigation="mobile">
      <header className="retail-mobile-nav__topbar">
        <Sheet
          open={drawerOpen}
          onOpenChange={(open) => {
            setDrawerOpen(open);
            if (open) setAccountOpen(false);
          }}
        >
          <SheetTrigger asChild>
            <button
              aria-label="Open retail navigation"
              className="retail-mobile-nav__icon-button"
              type="button"
            >
              <Menu aria-hidden="true" size={22} />
            </button>
          </SheetTrigger>

          <SheetContent
            aria-describedby="retail-mobile-drawer-description"
            className="retail-mobile-nav__drawer"
            side="left"
          >
            <div className="retail-mobile-nav__drawer-heading">
              <YsabelleBrandMark eager variant="mini" />
              <div className="retail-mobile-nav__drawer-heading-copy">
                <SheetTitle className="retail-mobile-nav__drawer-title">YsabelleStore</SheetTitle>
                <SheetDescription
                  className="retail-mobile-nav__drawer-description"
                  id="retail-mobile-drawer-description"
                >
                  Retail workspace navigation
                </SheetDescription>
              </div>
              <SheetClose asChild>
                <button
                  aria-label="Close retail navigation"
                  className="retail-mobile-nav__icon-button"
                  type="button"
                >
                  <X aria-hidden="true" size={20} />
                </button>
              </SheetClose>
            </div>

            <nav aria-label="Retail modules" className="retail-mobile-nav__links">
              {navigationGroups.map((group) => {
                const items = group.paths
                  .map((path) => appRoutes.find((item) => item.path === path))
                  .filter(
                    (item): item is (typeof appRoutes)[number] =>
                      item !== undefined && item.allowedRoles.includes(role)
                  );
                if (!items.length) return null;

                return (
                  <div className="retail-mobile-nav__group" key={group.title}>
                    <p className="retail-mobile-nav__group-label">{group.title}</p>
                    {items.map(({ icon: Icon, label, path }) => (
                      <button
                        aria-current={activePath === path ? "page" : undefined}
                        className="retail-mobile-nav__link"
                        key={path}
                        onClick={() => navigateAndDismiss(path)}
                        type="button"
                      >
                        <Icon aria-hidden="true" height={19} width={19} />
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                );
              })}
            </nav>

            <div className="retail-mobile-nav__drawer-footer">
              <UserRound aria-hidden="true" size={18} />
              <span className="retail-mobile-nav__footer-name">
                {user?.name || "Retail account"}
              </span>
              <span className="retail-mobile-nav__role">{roleLabel}</span>
            </div>
          </SheetContent>
        </Sheet>

        <div aria-label="YsabelleStore retail workspace" className="retail-mobile-nav__brand">
          <YsabelleBrandMark eager variant="mini" />
          <span>YsabelleStore</span>
        </div>

        <div className="retail-mobile-nav__account-anchor">
          <button
            aria-controls="retail-mobile-account-actions"
            aria-expanded={accountOpen}
            aria-label="Retail account options"
            className="retail-mobile-nav__icon-button retail-mobile-nav__account-trigger"
            onClick={() => {
              setDrawerOpen(false);
              setAccountOpen((current) => !current);
            }}
            ref={accountTriggerRef}
            type="button"
          >
            <UserRound aria-hidden="true" size={21} />
          </button>
          {accountOpen ? (
            <div
              aria-label="Retail account actions"
              className="retail-mobile-nav__account-popover"
              id="retail-mobile-account-actions"
              ref={accountPanelRef}
            >
              <div className="retail-mobile-nav__account-identity">
                <strong title={user?.name}>{user?.name || "Retail account"}</strong>
                <span>{roleLabel} session</span>
              </div>
              <button
                aria-label={`Switch to ${retailTheme === "dark" ? "light" : "dark"} mode`}
                className="retail-mobile-nav__account-action"
                onClick={() => setRetailTheme(retailTheme === "dark" ? "light" : "dark")}
                type="button"
              >
                {retailTheme === "dark" ? (
                  <Sun aria-hidden="true" size={18} />
                ) : (
                  <Moon aria-hidden="true" size={18} />
                )}
                <span>{retailTheme === "dark" ? "Light mode" : "Dark mode"}</span>
              </button>
              {role === "OWNER" ? (
                <button
                  className="retail-mobile-nav__account-action"
                  onClick={() => navigateAndDismiss("/settings")}
                  type="button"
                >
                  <Settings aria-hidden="true" size={18} />
                  <span>Settings</span>
                </button>
              ) : null}
              <button
                className="retail-mobile-nav__account-action retail-mobile-nav__account-action--danger"
                onClick={() => {
                  setAccountOpen(false);
                  onLogout();
                }}
                type="button"
              >
                <LogOut aria-hidden="true" size={18} />
                <span>Sign out</span>
              </button>
            </div>
          ) : null}
        </div>
      </header>
    </div>
  );
}
