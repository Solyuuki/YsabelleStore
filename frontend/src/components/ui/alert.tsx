import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const alertVariants = cva("type-body-sm w-full rounded-lg border px-4 py-3", {
  variants: {
    variant: {
      default: "border-slate-200 bg-slate-50 text-slate-700",
      destructive: "border-red-200 bg-red-50 text-red-800"
    }
  },
  defaultVariants: {
    variant: "default"
  }
});

type AlertProps = HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>;

export const Alert = forwardRef<HTMLDivElement, AlertProps>(function Alert(
  { className, variant, ...props },
  ref
) {
  return <div className={cn(alertVariants({ variant }), className)} ref={ref} {...props} />;
});

export function AlertTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h4 className={cn("type-h4", className)} {...props} />;
}

export function AlertDescription({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("type-body-sm mt-1", className)} {...props} />;
}
