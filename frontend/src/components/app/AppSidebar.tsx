import { ChevronLeft, Lock, LogOut } from "lucide-react";

import { appRoutes, type AppRoutePath } from "@/app/routes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AppSidebarProps = {
  activePath: string;
  collapsed: boolean;
  onToggleSidebar: () => void;
  onNavigate: (path: AppRoutePath) => void;
};

const mainRoutes: readonly AppRoutePath[] = [
  "/dashboard",
  "/pos",
  "/products",
  "/inventory",
  "/sales"
];

const ownerRoutes: readonly AppRoutePath[] = ["/forecast", "/reports", "/settings"];

export function AppSidebar({
  activePath,
  collapsed,
  onNavigate,
  onToggleSidebar
}: AppSidebarProps) {
  const mainItems = appRoutes.filter((item) => mainRoutes.includes(item.path));
  const ownerItems = appRoutes.filter((item) => ownerRoutes.includes(item.path));

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
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-emerald-500 text-sm font-bold text-slate-950 shadow-sm shadow-emerald-950/10">
          YS
        </div>
        <div
          className={cn(
            "min-w-0 overflow-hidden transition-all duration-300 ease-out",
            collapsed ? "max-w-0 opacity-0" : "max-w-48 opacity-100"
          )}
        >
          <p className="truncate text-sm font-semibold text-slate-950">YsabelleStore</p>
          <p className="truncate text-xs text-slate-500">Retail desktop</p>
        </div>
      </div>

      <nav className="flex-1 space-y-5 p-3" aria-label="Application modules">
        <SidebarSection
          activePath={activePath}
          collapsed={collapsed}
          items={mainItems}
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
          {collapsed ? null : <FullCounterModeCard />}

          <Button
            className={cn(
              "h-11 w-full justify-start border-0 bg-transparent px-3 text-slate-600 shadow-none transition-colors duration-300 ease-out hover:bg-emerald-50 hover:text-slate-950",
              collapsed && "justify-center px-0"
            )}
            onClick={() => onNavigate("/")}
            title="Logout"
            type="button"
            variant="ghost"
          >
            <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span
              className={cn(
                "overflow-hidden transition-all duration-300 ease-out",
                collapsed ? "max-w-0 opacity-0" : "max-w-24 opacity-100"
              )}
            >
              Logout
            </span>
          </Button>
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
          const Icon = item.icon;
          const active = activePath === item.path;

          return (
            <Button
              className={cn(
                "group h-11 w-full justify-start border-0 bg-transparent px-3 text-slate-600 shadow-none transition-[background-color,color,transform] duration-300 ease-out hover:bg-emerald-50 hover:text-slate-950",
                collapsed && "justify-center px-0",
                active &&
                  "bg-emerald-500 text-slate-950 shadow-sm shadow-emerald-950/10 hover:bg-emerald-500 hover:text-slate-950"
              )}
              key={item.path}
              onClick={() => onNavigate(item.path)}
              title={item.label}
              type="button"
              variant="ghost"
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span
                className={cn(
                  "ml-2 overflow-hidden text-left transition-all duration-300 ease-out",
                  collapsed ? "max-w-0 opacity-0" : "max-w-36 opacity-100"
                )}
              >
                {item.label}
              </span>
              {!collapsed ? (
                <div className="ml-auto flex items-center gap-2">
                  {item.protected ? <Lock className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                </div>
              ) : null}
            </Button>
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
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
        {title}
      </p>
    </div>
  );
}

function FullCounterModeCard() {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white/75 p-3 text-slate-700 shadow-sm backdrop-blur-sm transition-[background-color,border-color,box-shadow] duration-300 ease-out">
      <p className="text-xs font-medium text-slate-900">Counter mode</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">
        Staff workspace for daily retail operations.
      </p>
      <p className="mt-3 text-xs font-medium text-slate-500">YsabelleStore v0.1.0</p>
    </div>
  );
}
