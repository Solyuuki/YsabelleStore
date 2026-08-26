import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ComponentProps, type HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const paginationLinkVariants = cva(
  "inline-flex h-9 min-w-9 items-center justify-center rounded-md border px-3 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "border-slate-200 bg-white/90 text-slate-700 shadow-sm hover:border-indigo-200 hover:bg-indigo-50/70 hover:text-indigo-800",
        active:
          "border-indigo-500 bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 text-white shadow-[0_8px_20px_rgba(98,91,255,0.22)] hover:from-blue-600 hover:via-indigo-600 hover:to-violet-600"
      },
      size: {
        default: "h-9 px-3",
        icon: "h-9 w-9 p-0"
      }
    },
    defaultVariants: {
      size: "default",
      variant: "default"
    }
  }
);

export function Pagination({ className, ...props }: ComponentProps<"nav">) {
  return <nav aria-label="pagination" className={cn("flex w-full", className)} {...props} />;
}

export const PaginationContent = forwardRef<HTMLUListElement, HTMLAttributes<HTMLUListElement>>(
  function PaginationContent({ className, ...props }, ref) {
    return <ul ref={ref} className={cn("flex items-center gap-1.5", className)} {...props} />;
  }
);

export const PaginationItem = forwardRef<HTMLLIElement, HTMLAttributes<HTMLLIElement>>(
  function PaginationItem({ className, ...props }, ref) {
    return <li ref={ref} className={cn("", className)} {...props} />;
  }
);

type PaginationLinkProps = {
  asChild?: boolean;
  isActive?: boolean;
} & VariantProps<typeof paginationLinkVariants> &
  ComponentProps<"a">;

export const PaginationLink = forwardRef<HTMLAnchorElement, PaginationLinkProps>(
  function PaginationLink({ className, asChild = false, isActive, variant, size, ...props }, ref) {
    const Comp = asChild ? Slot : "a";

    return (
      <Comp
        aria-current={isActive ? "page" : undefined}
        className={cn(
          paginationLinkVariants({ variant: isActive ? "active" : variant, size }),
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

type PaginationButtonProps = {
  asChild?: boolean;
} & VariantProps<typeof paginationLinkVariants> &
  ComponentProps<"button">;

function paginationButtonClassName({
  className,
  isActive,
  size,
  variant
}: {
  className?: string;
  isActive?: boolean;
} & VariantProps<typeof paginationLinkVariants>) {
  return cn(paginationLinkVariants({ variant: isActive ? "active" : variant, size }), className);
}

export const PaginationPrevious = forwardRef<HTMLButtonElement, PaginationButtonProps>(
  function PaginationPrevious(
    { className, children, asChild = false, variant, size, ...props },
    ref
  ) {
    const Comp = asChild ? Slot : "button";

    return (
      <Comp
        className={paginationButtonClassName({ className, size, variant })}
        ref={ref}
        {...props}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        {children ?? <span>Previous</span>}
      </Comp>
    );
  }
);

export const PaginationNext = forwardRef<HTMLButtonElement, PaginationButtonProps>(
  function PaginationNext({ className, children, asChild = false, variant, size, ...props }, ref) {
    const Comp = asChild ? Slot : "button";

    return (
      <Comp
        className={paginationButtonClassName({ className, size, variant })}
        ref={ref}
        {...props}
      >
        {children ?? <span>Next</span>}
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Comp>
    );
  }
);

export function PaginationEllipsis({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-flex h-9 w-9 items-center justify-center text-slate-400", className)}
      {...props}
    >
      <MoreHorizontal className="h-4 w-4" />
      <span className="sr-only">More pages</span>
    </span>
  );
}
