import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type TooltipProps = {
  children: ReactNode;
  className?: string;
  content: ReactNode;
  sideOffset?: number;
};

export function Tooltip({ children, className, content, sideOffset = 10 }: TooltipProps) {
  return (
    <span className={cn("group relative inline-flex", className)}>
      {children}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute left-1/2 top-full z-20 mt-2 -translate-x-1/2",
          "whitespace-nowrap rounded-md border border-slate-200 bg-slate-950 px-2.5 py-1",
          "text-xs font-medium text-white shadow-lg opacity-0 transition-opacity duration-150",
          "group-hover:opacity-100 group-focus-within:opacity-100"
        )}
        style={{ marginTop: sideOffset }}
      >
        {content}
      </span>
    </span>
  );
}
