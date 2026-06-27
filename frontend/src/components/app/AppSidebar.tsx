import { ArrowRight, Lock } from "lucide-react";

import { appRoutes, type AppRoutePath } from "@/app/routes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AppSidebarProps = {
  activePath: string;
  collapsed: boolean;
  onNavigate: (path: AppRoutePath) => void;
};

export function AppSidebar({ activePath, collapsed, onNavigate }: AppSidebarProps) {
  return (
    <aside
      className={cn(
        "flex min-h-screen shrink-0 flex-col border-r border-slate-800 bg-slate-950 text-slate-100 transition-all",
        collapsed ? "w-20" : "w-64"
      )}
    >
      <div className="flex h-16 items-center gap-3 border-b border-slate-800 px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-emerald-500 text-sm font-bold text-slate-950">
          YS
        </div>
        {!collapsed ? (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">YsabelleStore</p>
            <p className="truncate text-xs text-slate-400">Retail desktop</p>
          </div>
        ) : null}
      </div>

      <nav className="flex-1 space-y-1 p-3" aria-label="Application modules">
        {appRoutes.map((item) => {
          const Icon = item.icon;
          const active = activePath === item.path;

          return (
            <Button
              className={cn(
                "h-11 w-full justify-start border-0 bg-transparent px-3 text-slate-300 shadow-none hover:bg-slate-900 hover:text-white",
                collapsed && "justify-center px-0",
                active && "bg-emerald-500 text-slate-950 hover:bg-emerald-500 hover:text-slate-950"
              )}
              key={item.path}
              onClick={() => onNavigate(item.path)}
              title={item.label}
              type="button"
              variant="ghost"
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {!collapsed ? (
                <>
                  <span className="truncate">{item.label}</span>
                  {item.protected ? (
                    <Lock className="ml-auto h-3.5 w-3.5" aria-hidden="true" />
                  ) : active ? (
                    <ArrowRight className="ml-auto h-3.5 w-3.5" aria-hidden="true" />
                  ) : null}
                </>
              ) : null}
            </Button>
          );
        })}
      </nav>

      <div className="border-t border-slate-800 p-3">
        <div
          className={cn("rounded-md border border-slate-800 bg-slate-900 p-3", collapsed && "px-2")}
        >
          <p className="text-xs font-medium text-slate-300">
            {collapsed ? "Store" : "Counter mode"}
          </p>
          {!collapsed ? (
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Staff workspace for daily retail operations.
            </p>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
