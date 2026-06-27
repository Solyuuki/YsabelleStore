import { LoaderCircle } from "lucide-react";

type LoadingStateProps = {
  label: string;
};

export function LoadingState({ label }: LoadingStateProps) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
      <LoaderCircle className="h-4 w-4 animate-spin text-emerald-700" aria-hidden="true" />
      <span>{label}</span>
      <div className="ml-auto flex gap-2" aria-hidden="true">
        <span className="h-2 w-16 rounded-full bg-slate-100" />
        <span className="h-2 w-10 rounded-full bg-slate-100" />
      </div>
    </div>
  );
}
