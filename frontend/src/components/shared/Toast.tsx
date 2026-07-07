import { CircleCheck, CircleX, Info, TriangleAlert, X } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { ToastItem, ToastVariant } from "@/components/shared/toast.types";

type ToastProps = {
  onDismiss: (id: string) => void;
  toast: ToastItem;
};

const variantStyles: Record<
  ToastVariant,
  {
    accentClassName: string;
    icon: ComponentType<SVGProps<SVGSVGElement>>;
    surfaceClassName: string;
    textClassName: string;
  }
> = {
  success: {
    accentClassName: "bg-emerald-500",
    icon: CircleCheck,
    surfaceClassName: "border-emerald-200 bg-emerald-50/95",
    textClassName: "text-emerald-800"
  },
  error: {
    accentClassName: "bg-red-500",
    icon: CircleX,
    surfaceClassName: "border-red-200 bg-red-50/95",
    textClassName: "text-red-800"
  },
  warning: {
    accentClassName: "bg-amber-500",
    icon: TriangleAlert,
    surfaceClassName: "border-amber-200 bg-amber-50/95",
    textClassName: "text-amber-800"
  },
  info: {
    accentClassName: "bg-blue-500",
    icon: Info,
    surfaceClassName: "border-blue-200 bg-blue-50/95",
    textClassName: "text-blue-800"
  }
};

export function Toast({ onDismiss, toast }: ToastProps) {
  const variant = variantStyles[toast.variant];
  const Icon = variant.icon;
  const isAlert = toast.variant === "error" || toast.variant === "warning";

  return (
    <article
      aria-atomic="true"
      className={cn(
        "pointer-events-auto relative overflow-hidden rounded-md border shadow-[0_18px_40px_rgba(15,23,42,0.14)] backdrop-blur-sm transition-all duration-200 ease-out",
        variant.surfaceClassName,
        toast.closing ? "translate-x-3 opacity-0 scale-[0.98]" : "translate-x-0 opacity-100"
      )}
      role={isAlert ? "alert" : "status"}
    >
      <div
        className={cn("absolute inset-y-0 left-0 w-1", variant.accentClassName)}
        aria-hidden="true"
      />
      <div className="flex items-start gap-3 px-4 py-3 pr-3">
        <div
          className={cn(
            "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/80",
            variant.textClassName
          )}
          aria-hidden="true"
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-950">{toast.title}</p>
          <p className="mt-0.5 text-sm leading-5 text-slate-600">{toast.message}</p>
        </div>
        <Button
          aria-label={`Dismiss ${toast.title}`}
          className="mt-[-0.25rem] h-8 w-8 shrink-0 text-slate-500 hover:text-slate-950"
          onClick={() => onDismiss(toast.id)}
          size="icon"
          type="button"
          variant="ghost"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
      {toast.persistent ? null : (
        <div className="h-1 overflow-hidden bg-white/60" aria-hidden="true">
          <div
            className={cn("h-full w-full origin-left", variant.accentClassName)}
            key={toast.createdAt}
            style={{
              animation: `toast-progress ${toast.durationMs}ms linear forwards`
            }}
          />
        </div>
      )}
    </article>
  );
}
