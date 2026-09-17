import type { ComponentType, SVGProps } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SidebarNavItemProps = {
  active?: boolean;
  badgeCount?: number;
  badgeTone?: "brand" | "warning";
  collapsed: boolean;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  onClick: () => void;
  protectedItem?: boolean;
};

export function SidebarNavItem({
  active = false,
  badgeCount,
  badgeTone = "brand",
  collapsed,
  icon: Icon,
  label,
  onClick
}: SidebarNavItemProps) {
  const hasBadge = typeof badgeCount === "number" && badgeCount > 0;
  const badgeLabel = hasBadge ? (badgeCount > 99 ? "99+" : badgeCount.toString()) : null;

  return (
    <div className="group/nav relative">
      <Button
        aria-label={hasBadge ? `${label}, ${badgeCount} items need attention` : label}
        className={cn(
          "relative h-11 w-full justify-start border-0 bg-transparent px-3 text-slate-600 shadow-none transition-[background-color,color,box-shadow,transform] duration-200 ease-out hover:bg-indigo-50/90 hover:text-slate-950 hover:shadow-sm",
          collapsed && "justify-center px-0",
          active &&
            "bg-indigo-500 text-white shadow-sm shadow-indigo-950/10 hover:bg-indigo-500 hover:text-white hover:shadow-sm"
        )}
        onClick={onClick}
        type="button"
        variant="ghost"
      >
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span
          className={cn(
            "ml-2 overflow-hidden text-left transition-[max-width,opacity,transform] duration-200 ease-out",
            collapsed ? "max-w-0 opacity-0" : "max-w-36 opacity-100"
          )}
        >
          {label}
        </span>
        {hasBadge ? (
          <span
            className={cn(
              "inline-flex shrink-0 items-center justify-center rounded-full font-semibold tabular-nums ring-1 transition-[background-color,color,box-shadow] duration-200",
              collapsed
                ? "absolute right-1.5 top-1 h-4 min-w-4 px-1 text-[9px] leading-none"
                : "ml-auto h-5 min-w-5 px-1.5 text-[10px] leading-none",
              active
                ? "bg-white/20 text-white ring-white/25"
                : badgeTone === "warning"
                  ? "bg-amber-50 text-amber-700 ring-amber-200"
                  : "bg-violet-50 text-[#625bff] ring-violet-200"
            )}
            aria-hidden="true"
          >
            {badgeLabel}
          </span>
        ) : null}
      </Button>

      {collapsed ? <SidebarTooltip label={label} /> : null}
    </div>
  );
}

function SidebarTooltip({ label }: { label: string }) {
  return (
    <div className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-x-1 -translate-y-1/2 opacity-0 transition-[opacity,transform] duration-150 ease-out group-hover/nav:translate-x-0 group-hover/nav:opacity-100 group-focus-within/nav:translate-x-0 group-focus-within/nav:opacity-100">
      <div className="relative rounded-lg border border-slate-800/80 bg-slate-950 px-3 py-1.5 text-xs font-medium text-white shadow-[0_18px_36px_rgba(15,23,42,0.28)]">
        {label}
        <span
          className="absolute left-0 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[1px] border-l border-t border-slate-800/80 bg-slate-950"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
