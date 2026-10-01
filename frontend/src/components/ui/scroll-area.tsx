import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";
import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils";

type ScrollAreaProps = ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root> & {
  viewportClassName?: string;
};

export function ScrollArea({
  children,
  className,
  viewportClassName,
  ...props
}: ScrollAreaProps) {
  return (
    <ScrollAreaPrimitive.Root className={cn("relative overflow-hidden", className)} {...props}>
      <ScrollAreaPrimitive.Viewport
        className={cn("h-full w-full overscroll-contain", viewportClassName)}
      >
        <ScrollAreaPrimitive.Content>{children}</ScrollAreaPrimitive.Content>
      </ScrollAreaPrimitive.Viewport>
      <ScrollAreaPrimitive.Scrollbar
        className="flex w-3 touch-none select-none justify-center rounded-full py-1"
        orientation="vertical"
      >
        <ScrollAreaPrimitive.Thumb className="w-1.5 flex-1 rounded-full bg-slate-300 transition-colors hover:bg-slate-400" />
      </ScrollAreaPrimitive.Scrollbar>
    </ScrollAreaPrimitive.Root>
  );
}
