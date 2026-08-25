import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description: string;
  eyebrow?: string;
  actions?: ReactNode;
};

export function PageHeader({ actions, description, eyebrow, title }: PageHeaderProps) {
  return (
    <header className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:gap-6">
      <div className="min-w-0">
        {eyebrow ? <p className="type-label mb-2 text-emerald-700">{eyebrow}</p> : null}
        <h1 className="type-h1 text-slate-950">{title}</h1>
        <p className="type-body-sm mt-2 max-w-3xl text-slate-600">{description}</p>
      </div>
      {actions ? (
        <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">{actions}</div>
      ) : null}
    </header>
  );
}
