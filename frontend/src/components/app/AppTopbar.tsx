import { Bell } from "lucide-react";

import type { AppRoutePath } from "@/app/routes";
import { GlobalSearch } from "@/components/app/GlobalSearch";
import { Button } from "@/components/ui/button";
import type { AuthUserRole } from "@/types/auth";

type AppTopbarProps = {
  onNavigate: (path: AppRoutePath) => void;
  userRole: AuthUserRole | undefined;
};

export function AppTopbar({ onNavigate, userRole }: AppTopbarProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-4 z-20 flex items-start justify-end gap-6 px-6">
      <div className="flex items-center gap-3">
        <GlobalSearch onNavigate={onNavigate} userRole={userRole} />
        <Button
          aria-label="Notifications"
          className="pointer-events-auto h-11 w-11 rounded-full border border-white/75 bg-white/70 shadow-[0_12px_32px_rgba(15,23,42,0.08)] backdrop-blur-md"
          size="icon"
          type="button"
          variant="secondary"
        >
          <Bell className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
