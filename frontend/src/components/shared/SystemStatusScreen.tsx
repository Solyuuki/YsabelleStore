import type { ComponentType, ReactNode, SVGProps } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type StatusIcon = ComponentType<SVGProps<SVGSVGElement>>;

type SystemStatusAction = {
  icon?: StatusIcon;
  label: string;
  onClick: () => void;
  variant?: "default" | "secondary";
};

type SystemStatusScreenProps = {
  code?: string;
  eyebrow: string;
  icon: StatusIcon;
  message: string;
  modal?: boolean;
  noteMessage?: string;
  noteTitle?: string;
  primaryAction?: SystemStatusAction;
  secondaryAction?: SystemStatusAction;
  statusMeta?: ReactNode;
  title: string;
};

export function SystemStatusScreen({
  code,
  eyebrow,
  icon: Icon,
  message,
  modal = false,
  noteMessage,
  noteTitle,
  primaryAction,
  secondaryAction,
  statusMeta,
  title
}: SystemStatusScreenProps) {
  const titleId = `system-status-${normalizeId(code ?? title)}-title`;
  const descriptionId = `system-status-${normalizeId(code ?? title)}-description`;
  const content = (
    <>
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
        </div>

        <div className="reliability-card__content">
          <div className="reliability-eyebrow">
            <span className="reliability-eyebrow__dot" aria-hidden="true" />
            <span>{eyebrow}</span>
            {code ? (
              <span
                className="rounded-full border border-indigo-200/80 bg-indigo-50/80 px-2 py-0.5 font-mono text-[0.68rem] tracking-normal text-indigo-700"
                aria-label={`HTTP status ${code}`}
              >
                {code}
              </span>
            ) : null}
          </div>

          <h1 className="type-h1 text-slate-950" id={titleId}>
            {title}
          </h1>

          <p className="type-body-lg type-readable text-slate-600" id={descriptionId}>
            {message}
          </p>

          {noteTitle && noteMessage ? (
            <div className="reliability-safety-note">
              <span className="reliability-safety-note__indicator" aria-hidden="true" />
              <div>
                <p className="font-semibold text-slate-900">{noteTitle}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">{noteMessage}</p>
              </div>
            </div>
          ) : null}

          {(primaryAction || secondaryAction || statusMeta) && (
            <div className="reliability-card__actions">
              {primaryAction ? <StatusActionButton action={primaryAction} autoFocus={modal} /> : null}
              {secondaryAction ? <StatusActionButton action={secondaryAction} /> : null}
              {statusMeta ? <span className="text-xs text-slate-500">{statusMeta}</span> : null}
            </div>
          )}
        </div>
      </section>
    </>
  );

  if (modal) {
    return (
      <div
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-live="assertive"
        aria-modal="true"
        className="reliability-overlay"
        role="alertdialog"
      >
        {content}
      </div>
    );
  }

  return (
    <main
      aria-describedby={descriptionId}
      aria-labelledby={titleId}
      className="reliability-overlay"
      data-system-status-screen
    >
      {content}
    </main>
  );
}

function StatusActionButton({ action, autoFocus = false }: { action: SystemStatusAction; autoFocus?: boolean }) {
  const ActionIcon = action.icon;

  return (
    <Button
      autoFocus={autoFocus}
      className={cn(action.variant === "secondary" && "bg-white/90")}
      onClick={action.onClick}
      type="button"
      variant={action.variant ?? "default"}
    >
      {ActionIcon ? <ActionIcon className="h-4 w-4" aria-hidden="true" /> : null}
      {action.label}
    </Button>
  );
}

function normalizeId(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
