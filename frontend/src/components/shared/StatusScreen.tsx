import { useEffect, useId, useRef, type ComponentType, type ReactNode, type SVGProps } from "react";
import { createPortal } from "react-dom";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/button";

type StatusIcon = ComponentType<SVGProps<SVGSVGElement>>;
type StatusScreenVariant = "auth" | "navigation" | "system";

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
  statusLabel: string;
  title: string;
  variant: StatusScreenVariant;
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
  title,
  variant
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

  const actions = (
    <div className="status-screen-actions mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
      {primaryAction ? (
        <Button className="h-11 min-w-36 px-5" onClick={primaryAction.onClick} type="button">
          {primaryAction.icon}
          {primaryAction.label}
        </Button>
      ) : null}
      {secondaryAction ? (
        <Button
          className="h-11 min-w-36 px-5"
          onClick={secondaryAction.onClick}
          type="button"
          variant="secondary"
        >
          {secondaryAction.icon}
          {secondaryAction.label}
        </Button>
      ) : null}
    </div>
  );

  const iconTile = (
    <div className="status-screen-icon-tile mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-white/80 bg-white/90 text-indigo-600">
      <Icon className="h-8 w-8" aria-hidden="true" />
    </div>
  );

  const screen = (
    <div
      aria-describedby={descriptionId}
      aria-labelledby={titleId}
      aria-live={critical ? "assertive" : "polite"}
      aria-modal={critical ? true : undefined}
      className="status-screen-shell fixed inset-0 z-[110] flex min-h-dvh flex-col overflow-y-auto text-[#101426]"
      data-status-screen
      data-status-variant={variant}
      ref={containerRef}
      role={critical ? "alertdialog" : "main"}
      tabIndex={-1}
    >
      <div className="status-screen-ambient" aria-hidden="true">
        <span className="status-screen-aurora status-screen-aurora--one" />
        <span className="status-screen-aurora status-screen-aurora--two" />
        <span className="status-screen-grid" />
      </div>

      <header className="status-screen-brand relative z-10 flex items-center px-6 py-5 sm:px-10 sm:py-7">
        <BrandLogo
          className="status-screen-brand__logo h-auto w-[10.75rem] max-w-[48vw] object-contain object-left"
          variant="full"
        />
      </header>

      {variant === "navigation" ? (
        <main className="relative z-10 flex flex-1 items-center justify-center px-5 pb-16 pt-4 sm:px-8">
          <div className="status-screen-content w-full max-w-2xl text-center">
            {iconTile}
            <p
              aria-hidden="true"
              className="status-screen-code mt-6 select-none bg-gradient-to-b from-[#101426] via-[#625BFF] to-slate-300 bg-clip-text text-[clamp(7rem,20vw,11rem)] font-bold leading-[0.82] tracking-[-0.075em] text-transparent"
            >
              {statusLabel}
            </p>
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">
              {eyebrow}
            </p>
            <h1
              className="mt-3 text-3xl font-semibold tracking-[-0.025em] text-slate-950 sm:text-4xl"
              id={titleId}
            >
              {title}
            </h1>
            <p
              className="mx-auto mt-4 max-w-lg text-base leading-7 text-slate-600"
              id={descriptionId}
            >
              {description}
            </p>
            {actions}
            {footer ? <p className="mt-6 text-xs text-slate-500">{footer}</p> : null}
          </div>
        </main>
      ) : null}

      {variant === "auth" ? (
        <main className="relative z-10 flex flex-1 items-center justify-center px-5 pb-16 pt-4 sm:px-8">
          <div className="status-screen-content w-full max-w-xl text-center">
            {iconTile}
            <div className="status-screen-badge mt-7 inline-flex items-center rounded-full border border-indigo-100/80 bg-white/82 px-3.5 py-1.5 text-xs font-bold tracking-[0.14em] text-indigo-700 shadow-sm backdrop-blur">
              {statusLabel}
            </div>
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              {eyebrow}
            </p>
            <h1
              className="mt-3 text-4xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-5xl"
              id={titleId}
            >
              {title}
            </h1>
            <p
              className="mx-auto mt-5 max-w-lg text-base leading-7 text-slate-600"
              id={descriptionId}
            >
              {description}
            </p>
            {actions}
            {footer ? <p className="mt-6 text-xs text-slate-500">{footer}</p> : null}
          </div>
        </main>
      ) : null}

      {variant === "system" ? (
        <main className="relative z-10 flex flex-1 items-center justify-center px-5 pb-16 pt-4 sm:px-8">
          <div className="status-screen-content w-full max-w-xl text-center">
            {iconTile}
            <div className="status-screen-badge mt-7 inline-flex items-center rounded-full border border-indigo-100/80 bg-white/82 px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-indigo-700 shadow-sm backdrop-blur">
              {statusLabel}
            </div>
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              {eyebrow}
            </p>
            <h1
              className="mt-3 text-3xl font-semibold tracking-[-0.025em] text-slate-950 sm:text-4xl"
              id={titleId}
            >
              {title}
            </h1>
            <p
              className="mx-auto mt-4 max-w-lg text-base leading-7 text-slate-600"
              id={descriptionId}
            >
              {description}
            </p>

            {(noteTitle || noteDescription) && (
              <div className="status-screen-note mx-auto mt-7 max-w-lg rounded-2xl border border-white/80 bg-white/72 p-4 text-left shadow-sm backdrop-blur-xl">
                {noteTitle ? (
                  <p className="text-sm font-semibold text-slate-900">{noteTitle}</p>
                ) : null}
                {noteDescription ? (
                  <p className="mt-1.5 text-sm leading-6 text-slate-600">{noteDescription}</p>
                ) : null}
              </div>
            )}

            {actions}
            {footer ? <p className="mt-6 text-xs text-slate-500">{footer}</p> : null}
          </div>
        </main>
      ) : null}
    </div>
  );

  return createPortal(screen, document.body);
}
