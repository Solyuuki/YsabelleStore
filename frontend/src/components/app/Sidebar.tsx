import {
  BarChart3,
  Boxes,
  ClipboardList,
  Home,
  LineChart,
  Package,
  ReceiptText,
  Settings,
  ShieldCheck
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import { NavLink } from "react-router-dom";

import { plannedRouteGroups } from "@/app/routes";
import { cn } from "@/lib/utils";
import type { RouteSegment } from "@/types/routes";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

const routeIcons: Record<RouteSegment, IconComponent> = {
  authentication: ShieldCheck,
  dashboard: Home,
  products: Package,
  inventory: Boxes,
  sales: ReceiptText,
  forecasts: LineChart,
  recommendations: ClipboardList,
  reports: BarChart3,
  settings: Settings
};

export function Sidebar() {
  return (
    <aside className="hidden min-h-screen w-72 border-r border-border bg-background lg:block">
      <div className="flex h-16 items-center border-b border-border px-6">
        <div>
          <p className="text-sm font-semibold text-foreground">YsabelleStore</p>
          <p className="text-xs text-muted-foreground">Inventory recommender</p>
        </div>
      </div>
      <nav aria-label="Primary" className="space-y-1 p-4">
        {plannedRouteGroups.map((route) => {
          const Icon = routeIcons[route.segment];

          return (
            <NavLink
              className={({ isActive }) =>
                cn(
                  "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  isActive && "bg-muted text-foreground"
                )
              }
              key={route.path}
              to={route.path}
            >
              <Icon aria-hidden="true" className="h-4 w-4" />
              <span>{route.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
