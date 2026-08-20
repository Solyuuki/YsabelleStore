import { ChevronLeft, LogOut } from "lucide-react";

import { appRoutes, type AppRoutePath } from "@/app/routes";
import { APP_VERSION_LABEL } from "@/config/appVersion";
import { SidebarNavItem } from "@/components/app/SidebarNavItem";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AuthUser } from "@/types/auth";

type AppSidebarProps = {
  activePath: string;
  collapsed: boolean;
  onLogout: () => void;
  onToggleSidebar: () => void;
  onNavigate: (path: AppRoutePath) => void;
  user: AuthUser | null;
};

const mainRoutes: readonly AppRoutePath[] = [
  "/dashboard",
  "/pos",
  "/products",
  "/inventory",
  "/sales"
];

// Add owner-only user management to the administrative section.
const ownerRoutesWithUsers: readonly AppRoutePath[] = [
  "/forecast",
  "/reports",
  "/settings",
  "/users"
];

export function AppSidebar({
  activePath,
  collapsed,
  onLogout,
  onNavigate,
  onToggleSidebar,
  user
}: AppSidebarProps) {
  const mainItems = appRoutes.filter((item) => mainRoutes.includes(item.path));
  const visibleMainItems = mainItems.filter((item) =>
    item.allowedRoles.includes(user?.role ?? "STAFF")
  );
  const ownerItems = appRoutes.filter(
    (item) =>
      ownerRoutesWithUsers.includes(item.path) && item.allowedRoles.includes(user?.role ?? "STAFF")
  );

  return (
    <aside
      className={cn(
        "relative flex min-h-screen shrink-0 flex-col overflow-visible border-r border-emerald-200/50 text-slate-700 shadow-[0_20px_48px_rgba(15,23,42,0.06)] transition-[width,background-color,border-color,box-shadow] duration-300 ease-out",
        "bg-[rgba(244,252,248,0.9)]",
        collapsed ? "w-20" : "w-64"
      )}
    >
      <Button
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className={cn(
          "absolute -right-4 top-12 z-20 h-8 w-8 rounded-full border border-emerald-200/70 bg-white p-0 text-slate-700 shadow-[0_10px_22px_rgba(15,23,42,0.12)] transition-[transform,background-color,border-color,box-shadow,opacity] duration-300 ease-out hover:bg-emerald-50"
        )}
        onClick={onToggleSidebar}
        type="button"
        variant="secondary"
      >
        <ChevronLeft
          className={cn(
            "h-4 w-4 transition-transform duration-300 ease-out",
            collapsed && "rotate-180"
          )}
          aria-hidden="true"
        />
      </Button>

      <div className="flex h-16 items-center gap-3 border-b border-slate-200/80 px-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white p-0.5 shadow-sm shadow-violet-950/15 ring-1 ring-violet-200/70">
          <img
            alt=""
            aria-hidden="true"
            className="h-full w-full object-contain"
            src="/brand/ysabelle-logo-v2.png"
          />
        </div>
        <div
          className={cn(
            "min-w-0 overflow-hidden transition-all duration-300 ease-out",
            collapsed ? "max-w-0 opacity-0" : "max-w-48 opacity-100"
          )}
        >
          <p className="type-body-sm truncate font-semibold text-slate-950">YsabelleStore</p>
          <p className="type-caption truncate text-slate-500">Retail desktop</p>
        </div>
      </div>

      <nav className="flex-1 space-y-5 p-3" aria-label="Application modules">
        <SidebarSection
          activePath={activePath}
          collapsed={collapsed}
          items={visibleMainItems}
          title="MAIN"
          onNavigate={onNavigate}
        />
        <SidebarSection
          activePath={activePath}
          collapsed={collapsed}
          items={ownerItems}
          title="OWNER AREA"
          onNavigate={onNavigate}
        />
      </nav>

      <div className="border-t border-slate-200/80 p-3">
        <div className="space-y-3">
          <SectionLabel collapsed={collapsed} title="SYSTEM" />
          {collapsed ? null : <FullCounterModeCard user={user} />}

          <SidebarNavItem collapsed={collapsed} icon={LogOut} label="Logout" onClick={onLogout} />
        </div>
      </div>
    </aside>
  );
}

type SidebarSectionProps = {
  activePath: string;
  collapsed: boolean;
  items: readonly (typeof appRoutes)[number][];
  title: string;
  onNavigate: (path: AppRoutePath) => void;
};

function SidebarSection({ activePath, collapsed, items, onNavigate, title }: SidebarSectionProps) {
  return (
    <div className="space-y-2">
      <SectionLabel collapsed={collapsed} title={title} />

      <div className="space-y-1">
        {items.map((item) => {
          const active = activePath === item.path;

          return (
            <SidebarNavItem
              active={active}
              collapsed={collapsed}
              icon={item.icon}
              key={item.path}
              onClick={() => onNavigate(item.path)}
              label={item.label}
              protectedItem={item.protected}
            />
          );
        })}
      </div>
    </div>
  );
}

type SectionLabelProps = {
  collapsed: boolean;
  title: string;
};

function SectionLabel({ collapsed, title }: SectionLabelProps) {
  return (
    <div
      className={cn(
        "overflow-hidden px-3 transition-all duration-300 ease-out",
        collapsed ? "max-h-0 opacity-0" : "max-h-8 opacity-100"
      )}
    >
      <p className="type-label text-slate-500">{title}</p>
    </div>
  );
}

function FullCounterModeCard({ user }: { user: AuthUser | null }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white/75 p-3 text-slate-700 shadow-sm backdrop-blur-sm transition-[background-color,border-color,box-shadow] duration-300 ease-out">
      <p className="type-caption font-semibold text-slate-900">{user?.name ?? "Counter mode"}</p>
      <p className="type-caption mt-1 text-slate-500">
        {user
          ? `${user.role.toLowerCase()} session active.`
          : "Staff workspace for daily retail operations."}
      </p>
      <p className="type-caption mt-3 font-semibold text-slate-500">
        YsabelleStore {APP_VERSION_LABEL}
      </p>
    </div>
  );
}
