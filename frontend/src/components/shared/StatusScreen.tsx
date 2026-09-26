import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { StatusIllustration } from "@/components/shared/StatusIllustration";
import { Button } from "@/components/ui/button";

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
  noteDescription?: string;
  noteTitle?: string;
  primaryAction?: StatusScreenAction;
  secondaryAction?: StatusScreenAction;
  statusLabel: string;
  title: string;
  variant: StatusScreenVariant;
};

const LOCK_ATTRIBUTE = "data-status-overlay-lock-count";

const STATUS_AMBIENT: Record<StatusScreenVariant, string> = {
  auth: "radial-gradient(ellipse at 18% 20%, rgb(0 140 255 / 20%), transparent 34%), radial-gradient(ellipse at 76% 18%, rgb(98 91 255 / 20%), transparent 36%), radial-gradient(ellipse at 56% 82%, rgb(168 60 240 / 13%), transparent 38%)",
  navigation:
    "radial-gradient(ellipse at 22% 18%, rgb(98 91 255 / 20%), transparent 35%), radial-gradient(ellipse at 78% 24%, rgb(168 60 240 / 17%), transparent 36%), radial-gradient(ellipse at 48% 82%, rgb(0 140 255 / 13%), transparent 40%)",
  system:
    "radial-gradient(ellipse at 20% 18%, rgb(0 140 255 / 19%), transparent 34%), radial-gradient(ellipse at 78% 20%, rgb(98 91 255 / 19%), transparent 36%), radial-gradient(ellipse at 62% 84%, rgb(244 63 140 / 11%), transparent 39%)"
};

export function StatusScreen({
  critical = false,
  description,
  eyebrow,
  footer,
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
    <div className="auth-footer-enter mt-7 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
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

  const screen = (
    <div
      aria-describedby={descriptionId}
      aria-labelledby={titleId}
      aria-live={critical ? "assertive" : "polite"}
      aria-modal={critical ? true : undefined}
      className="auth-page-enter fixed inset-0 z-[110] flex min-h-dvh flex-col overflow-y-auto bg-[#F7F9FF] text-[#101426]"
      data-status-screen
      data-status-variant={variant}
      ref={containerRef}
      role={critical ? "alertdialog" : "main"}
      tabIndex={-1}
    >
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
        <div
          className="absolute inset-[-16%] opacity-90 blur-3xl motion-safe:[animation:reliability-orb-drift_18s_ease-in-out_infinite] motion-reduce:animate-none"
          style={{ background: STATUS_AMBIENT[variant] }}
        />
        <div
          className="absolute inset-[-18%] opacity-55 blur-3xl motion-safe:[animation:reliability-orb-drift_24s_ease-in-out_infinite] motion-reduce:animate-none"
          style={{
            animationDelay: "-7s",
            background:
              "radial-gradient(ellipse at 76% 68%, rgb(168 60 240 / 12%), transparent 34%), radial-gradient(ellipse at 26% 72%, rgb(0 140 255 / 11%), transparent 36%)"
          }}
        />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "linear-gradient(rgb(98 91 255 / 0.05) 1px, transparent 1px), linear-gradient(90deg, rgb(98 91 255 / 0.05) 1px, transparent 1px)",
            backgroundSize: "58px 58px",
            maskImage: "radial-gradient(ellipse 72% 62% at 50% 42%, black 4%, transparent 78%)"
          }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.16),rgba(247,249,255,0.3))]" />
      </div>

      <header className="auth-footer-enter relative z-10 flex items-center px-6 py-5 sm:px-10 sm:py-7">
        <BrandLogo
          className="h-auto w-[10.75rem] max-w-[48vw] object-contain object-left drop-shadow-[0_8px_18px_rgba(49,46,129,0.1)]"
          variant="full"
        />
      </header>

      {variant === "navigation" ? (
        <main className="status-screen-main relative z-10 flex flex-1 items-center justify-center px-5 sm:px-8">
          <div className="auth-hero-enter w-full max-w-2xl text-center">
            <StatusIllustration statusLabel={statusLabel} variant={variant} />
            <p
              aria-hidden="true"
              className="mt-2 select-none bg-gradient-to-b from-[#101426] via-[#625BFF] to-slate-300 bg-clip-text text-[clamp(5.8rem,15vw,8.5rem)] font-bold leading-[0.85] tracking-[-0.07em] text-transparent drop-shadow-[0_18px_32px_rgba(98,91,255,0.09)]"
            >
              {statusLabel}
            </p>
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">
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
        <main className="status-screen-main relative z-10 flex flex-1 items-center justify-center px-5 sm:px-8">
          <div className="auth-hero-enter w-full max-w-xl text-center">
            <StatusIllustration statusLabel={statusLabel} variant={variant} />
            <div className="mt-4 inline-flex items-center rounded-full border border-indigo-100/80 bg-white/80 px-3.5 py-1.5 text-xs font-bold tracking-[0.14em] text-indigo-700 shadow-sm backdrop-blur-xl">
              {statusLabel}
            </div>
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              {eyebrow}
            </p>
            <h1
              className="mt-3 text-4xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-5xl"
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

      {variant === "system" ? (
        <main className="status-screen-main relative z-10 flex flex-1 items-center justify-center px-5 sm:px-8">
          <div className="auth-hero-enter w-full max-w-xl text-center">
            <StatusIllustration statusLabel={statusLabel} variant={variant} />
            <div className="mt-4 inline-flex items-center rounded-full border border-indigo-100/80 bg-white/80 px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-indigo-700 shadow-sm backdrop-blur-xl">
              {statusLabel}
            </div>
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
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
              <div className="mx-auto mt-6 max-w-lg rounded-2xl border border-white/80 bg-white/70 p-4 text-left shadow-[0_22px_54px_-40px_rgba(98,91,255,0.32),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-xl">
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
