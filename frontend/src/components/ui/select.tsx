import { forwardRef, type SelectHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const SELECT_CHEVRON_BACKGROUND =
  'url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2364748b%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22%3E%3Cpath d=%22m6 9 6 6 6-6%22/%3E%3C/svg%3E")';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, style, ...props }, ref) {
    return (
      <select
        className={cn(
          "type-body-sm flex h-10 w-full appearance-none rounded-md border border-slate-200 bg-white py-2 pl-3 pr-10 text-slate-950 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60",
          className
        )}
        ref={ref}
        style={{
          backgroundImage: SELECT_CHEVRON_BACKGROUND,
          backgroundPosition: "right 0.875rem center",
          backgroundRepeat: "no-repeat",
          backgroundSize: "1rem 1rem",
          colorScheme: "light",
          ...style
        }}
        {...props}
      />
    );
  }
);
