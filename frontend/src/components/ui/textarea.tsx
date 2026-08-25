import { forwardRef, type TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      className={cn(
        "type-body-sm flex min-h-24 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-950 shadow-sm transition-colors placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-60",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
