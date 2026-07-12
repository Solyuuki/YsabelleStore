import { forwardRef, type HTMLAttributes, type TableHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export const Table = forwardRef<HTMLTableElement, TableHTMLAttributes<HTMLTableElement>>(
  function Table({ className, ...props }, ref) {
    return (
      <table className={cn("w-full caption-bottom text-sm", className)} ref={ref} {...props} />
    );
  }
);

export const TableHeader = forwardRef<
  HTMLTableSectionElement,
  HTMLAttributes<HTMLTableSectionElement>
>(function TableHeader({ className, ...props }, ref) {
  return <thead className={cn("[&_tr]:border-b", className)} ref={ref} {...props} />;
});

export const TableBody = forwardRef<
  HTMLTableSectionElement,
  HTMLAttributes<HTMLTableSectionElement>
>(function TableBody({ className, ...props }, ref) {
  return <tbody className={cn("[&_tr:last-child]:border-0", className)} ref={ref} {...props} />;
});

export const TableRow = forwardRef<HTMLTableRowElement, HTMLAttributes<HTMLTableRowElement>>(
  function TableRow({ className, ...props }, ref) {
    return <tr className={cn("border-b transition-colors", className)} ref={ref} {...props} />;
  }
);

export const TableHead = forwardRef<HTMLTableCellElement, HTMLAttributes<HTMLTableCellElement>>(
  function TableHead({ className, ...props }, ref) {
    return (
      <th
        className={cn(
          "h-11 px-3 text-left align-middle text-xs font-semibold text-slate-600",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

export const TableCell = forwardRef<HTMLTableCellElement, HTMLAttributes<HTMLTableCellElement>>(
  function TableCell({ className, ...props }, ref) {
    return <td className={cn("px-3 py-3 align-middle", className)} ref={ref} {...props} />;
  }
);
