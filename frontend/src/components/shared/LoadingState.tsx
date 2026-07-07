import { LoaderCircle } from "lucide-react";

type LoadingStateProps = {
  badge?: string;
  helper?: string;
  label: string;
};

export function LoadingState({ badge, helper, label }: LoadingStateProps) {
  return (
    <div className="loading-panel rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
      <div className="flex items-start gap-3">
        <LoaderCircle className="mt-0.5 h-4 w-4 animate-spin text-emerald-700" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          {badge ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
              {badge}
            </p>
          ) : null}
          <p className={badge ? "mt-1 font-medium text-slate-800" : "font-medium text-slate-800"}>
            {label}
          </p>
        </div>
        <div className="ml-auto flex gap-2 pt-1" aria-hidden="true">
          <span className="loading-shimmer h-2 w-16 rounded-full bg-slate-100" />
          <span className="loading-shimmer h-2 w-10 rounded-full bg-slate-100" />
        </div>
      </div>
      {helper ? <p className="mt-3 leading-6 text-slate-600">{helper}</p> : null}
    </div>
  );
}
