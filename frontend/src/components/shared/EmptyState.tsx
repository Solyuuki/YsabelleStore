import type { ComponentType, SVGProps } from "react";

type EmptyStateProps = {
  title: string;
  description: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

export function EmptyState({ description, icon: Icon, title }: EmptyStateProps) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center rounded-md border border-dashed border-slate-300 bg-white px-8 py-10 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-md bg-slate-100 text-slate-600">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-base font-semibold text-slate-950">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );
}
