import { Bell, Menu, Search, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";

type AppTopbarProps = {
  routeLabel: string;
  onToggleSidebar: () => void;
};

export function AppTopbar({ onToggleSidebar, routeLabel }: AppTopbarProps) {
  return (
    <header className="flex h-16 items-center gap-4 border-b border-slate-200 bg-white px-6">
      <Button
        aria-label="Toggle sidebar"
        onClick={onToggleSidebar}
        size="icon"
        type="button"
        variant="secondary"
      >
        <Menu className="h-4 w-4" aria-hidden="true" />
      </Button>

      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-normal text-slate-500">
          Current module
        </p>
        <p className="truncate text-sm font-semibold text-slate-950">{routeLabel}</p>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <div className="flex h-10 w-80 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
          <Search className="h-4 w-4" aria-hidden="true" />
          <span>Search products, batches, receipts</span>
        </div>
        <StatusBadge variant="info">Session check ready</StatusBadge>
        <Button aria-label="Notifications" size="icon" type="button" variant="secondary">
          <Bell className="h-4 w-4" aria-hidden="true" />
        </Button>
        <div className="flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3">
          <UserRound className="h-4 w-4 text-slate-500" aria-hidden="true" />
          <span className="text-sm font-medium text-slate-700">Abarado</span>
        </div>
      </div>
    </header>
  );
}
