import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

type LoadingStateProps = {
  className?: string;
  label?: string;
};

export function LoadingState({ className, label = "Loading" }: LoadingStateProps) {
  return (
    <div
      aria-live="polite"
      className={cn(
        "flex min-h-24 items-center justify-center gap-2 text-sm text-muted-foreground",
        className
      )}
      role="status"
    >
      <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
      <span>{label}</span>
    </div>
  );
}
