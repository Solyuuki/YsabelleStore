import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export function Empty({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex w-full min-w-0 flex-col items-center justify-center gap-4 text-center",
        className
      )}
      data-slot="empty"
      {...props}
    />
  );
}

export function EmptyHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex max-w-xl flex-col items-center gap-2", className)}
      data-slot="empty-header"
      {...props}
    />
  );
}

export function EmptyMedia({
  className,
  variant = "default",
  ...props
}: ComponentProps<"div"> & { variant?: "default" | "icon" }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center",
        variant === "icon" &&
          "rounded-xl border border-indigo-100 bg-indigo-50 text-indigo-700 shadow-sm",
        className
      )}
      data-slot="empty-media"
      data-variant={variant}
      {...props}
    />
  );
}

export function EmptyTitle({ className, ...props }: ComponentProps<"h1">) {
  return (
    <h1 className={cn("type-h1 text-slate-950", className)} data-slot="empty-title" {...props} />
  );
}

export function EmptyDescription({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      className={cn("type-body-lg type-readable text-slate-600", className)}
      data-slot="empty-description"
      {...props}
    />
  );
}

export function EmptyContent({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex w-full max-w-xl flex-col gap-3", className)}
      data-slot="empty-content"
      {...props}
    />
  );
}
