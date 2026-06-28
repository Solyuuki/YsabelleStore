import { Database, ShieldCheck } from "lucide-react";

export function Header() {
  return (
    <header className="flex min-h-16 items-center justify-between gap-4 border-b border-border bg-background px-4 sm:px-6">
      <div>
        <p className="text-sm font-semibold text-foreground">Sprint 1 foundation</p>
        <p className="text-xs text-muted-foreground">Shell, API boundary, and database readiness</p>
      </div>
      <div className="flex items-center gap-2">
        <span className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-xs font-medium text-muted-foreground">
          <Database aria-hidden="true" className="h-4 w-4" />
          Local data
        </span>
        <span className="hidden h-9 items-center gap-2 rounded-md border border-border px-3 text-xs font-medium text-muted-foreground sm:inline-flex">
          <ShieldCheck aria-hidden="true" className="h-4 w-4" />
          Safe desktop
        </span>
      </div>
    </header>
  );
}
