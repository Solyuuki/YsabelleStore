import { forwardRef, type LabelHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export const Label = forwardRef<HTMLLabelElement, LabelHTMLAttributes<HTMLLabelElement>>(
  function Label({ className, ...props }, ref) {
    return (
      <label
        className={cn("type-body-sm font-semibold text-slate-700", className)}
        ref={ref}
        {...props}
      />
    );
  }
);
