import { forwardRef, type InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, type = "text", ...props }, ref) {
    return (
      <input
        className={cn(
          "type-body-sm flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-950 shadow-sm transition-colors placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60",
          className
        )}
        ref={ref}
        type={type}
        {...props}
      />
    );
  }
);
