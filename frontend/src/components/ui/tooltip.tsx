import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

type TooltipProps = {
  children: ReactNode;
  className?: string;
  content: ReactNode;
  sideOffset?: number;
};

type TooltipPosition = {
  left: number;
  top: number;
};

const VIEWPORT_GUTTER = 12;

export function Tooltip({ children, className, content, sideOffset = 10 }: TooltipProps) {
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const tooltipRef = useRef<HTMLSpanElement | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<TooltipPosition | null>(null);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    const tooltip = tooltipRef.current;

    if (!trigger || !tooltip) return;

    const triggerRect = trigger.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const desiredLeft = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
    const left = Math.min(
      Math.max(desiredLeft, VIEWPORT_GUTTER),
      Math.max(VIEWPORT_GUTTER, window.innerWidth - tooltipRect.width - VIEWPORT_GUTTER)
    );

    const topAbove = triggerRect.top - tooltipRect.height - sideOffset;
    const top =
      topAbove >= VIEWPORT_GUTTER
        ? topAbove
        : Math.min(
            triggerRect.bottom + sideOffset,
            window.innerHeight - tooltipRect.height - VIEWPORT_GUTTER
          );

    setPosition({ left, top });
  }, [sideOffset]);

  useEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  const tooltip =
    open && typeof document !== "undefined"
      ? createPortal(
          <span
            ref={tooltipRef}
            aria-hidden="true"
            className={cn(
              "pointer-events-none fixed z-[100] whitespace-nowrap rounded-md border border-slate-200",
              "bg-slate-950 px-2.5 py-1 type-caption text-white shadow-lg",
              "transition-opacity duration-150",
              position ? "opacity-100" : "opacity-0"
            )}
            style={position ?? { left: 0, top: 0 }}
          >
            {content}
          </span>,
          document.body
        )
      : null;

  return (
    <span
      ref={triggerRef}
      className={cn("inline-flex", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={() => setOpen(false)}
    >
      {children}
      {tooltip}
    </span>
  );
}
