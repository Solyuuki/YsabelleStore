import { useEffect, useId, useRef, type ComponentType, type ReactNode, type SVGProps } from "react";
import { createPortal } from "react-dom";

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle
} from "@/components/ui/empty";
import { Button } from "@/components/ui/button";

type StatusIcon = ComponentType<SVGProps<SVGSVGElement>>;

type StatusScreenAction = {
  icon?: ReactNode;
  label: string;
  onClick: () => void;
};

type StatusScreenProps = {
  critical?: boolean;
  description: string;
  eyebrow: string;
  footer?: string;
  icon: StatusIcon;
  noteDescription?: string;
  noteTitle?: string;
  primaryAction?: StatusScreenAction;
  secondaryAction?: StatusScreenAction;
  statusLabel?: string;
  title: string;
};

const LOCK_ATTRIBUTE = "data-status-overlay-lock-count";

export function StatusScreen({
  critical = false,
  description,
  eyebrow,
  footer,
  icon: Icon,
  noteDescription,
  noteTitle,
  primaryAction,
  secondaryAction,
  statusLabel,
  title
}: StatusScreenProps) {
  const titleId = useId();
  const descriptionId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const content = document.querySelector<HTMLElement>("[data-reliability-content]");
    const previousActiveElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    if (content) {
      const currentLocks = Number(content.getAttribute(LOCK_ATTRIBUTE) ?? "0");
      content.setAttribute(LOCK_ATTRIBUTE, String(currentLocks + 1));
      content.setAttribute("inert", "");
      content.setAttribute("aria-hidden", "true");
    }

    const focusFrame = window.requestAnimationFrame(() => {
      containerRef.current?.focus({ preventScroll: true });
    });

    return () => {
      window.cancelAnimationFrame(focusFrame);

      if (content) {
        const currentLocks = Number(content.getAttribute(LOCK_ATTRIBUTE) ?? "1");
        const nextLocks = Math.max(0, currentLocks - 1);

        if (nextLocks === 0) {
          content.removeAttribute(LOCK_ATTRIBUTE);
          content.removeAttribute("inert");
          content.removeAttribute("aria-hidden");
        } else {
          content.setAttribute(LOCK_ATTRIBUTE, String(nextLocks));
        }
      }

      if (previousActiveElement?.isConnected) {
        previousActiveElement.focus({ preventScroll: true });
      }
    };
  }, []);

  const screen = (
    <div
      aria-describedby={descriptionId}
      aria-labelledby={titleId}
      aria-live={critical ? "assertive" : "polite"}
      aria-modal={critical ? true : undefined}
      className="reliability-overlay"
      ref={containerRef}
      role={critical ? "alertdialog" : "main"}
      tabIndex={-1}
    >
      <div className="reliability-grid" aria-hidden="true" />
      <div className="reliability-orb reliability-orb--one" aria-hidden="true" />
      <div className="reliability-orb reliability-orb--two" aria-hidden="true" />

      <section className="reliability-card">
        <div className="reliability-card__beam" aria-hidden="true" />

        <div className="reliability-status-visual" aria-hidden="true">
          <span className="reliability-ring reliability-ring--outer" />
          <span className="reliability-ring reliability-ring--inner" />
          <span className="reliability-status-visual__icon">
            <Icon className="h-8 w-8" />
          </span>
          {statusLabel ? (
            <span className="absolute -bottom-1 rounded-full border border-indigo-100 bg-white/90 px-3 py-1 text-[0.68rem] font-extrabold tracking-[0.16em] text-indigo-600 shadow-sm backdrop-blur">
              {statusLabel}
            </span>
          ) : null}
        </div>

        <div className="reliability-card__content">
          <div className="reliability-eyebrow">
            <span className="reliability-eyebrow__dot" aria-hidden="true" />
            {eyebrow}
          </div>

          <Empty className="status-screen-empty items-start gap-0 text-left">
            <EmptyHeader className="status-screen-empty__header items-start text-left">
              <EmptyTitle id={titleId}>{title}</EmptyTitle>
              <EmptyDescription id={descriptionId}>{description}</EmptyDescription>
            </EmptyHeader>

            {(noteTitle || noteDescription) && (
              <EmptyContent>
                <div className="reliability-safety-note">
                  <span className="reliability-safety-note__indicator" aria-hidden="true" />
                  <div>
                    {noteTitle ? <p className="font-semibold text-slate-900">{noteTitle}</p> : null}
                    {noteDescription ? (
                      <p className="mt-1 text-sm leading-6 text-slate-600">{noteDescription}</p>
                    ) : null}
                  </div>
                </div>
              </EmptyContent>
            )}
          </Empty>

          <div className="reliability-card__actions">
            {primaryAction ? (
              <Button onClick={primaryAction.onClick} type="button">
                {primaryAction.icon}
                {primaryAction.label}
              </Button>
            ) : null}
            {secondaryAction ? (
              <Button onClick={secondaryAction.onClick} type="button" variant="secondary">
                {secondaryAction.icon}
                {secondaryAction.label}
              </Button>
            ) : null}
            {footer ? <span className="text-xs text-slate-500">{footer}</span> : null}
          </div>
        </div>
      </section>
    </div>
  );

  return createPortal(screen, document.body);
}
