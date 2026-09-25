import { LayoutDashboard, ShieldAlert } from "lucide-react";

import type { AppRoutePath } from "@/app/routes";
import { StatusScreen } from "@/components/shared/StatusScreen";

type AccessDeniedPageProps = {
  moduleName: string;
  onNavigate: (path: AppRoutePath) => void;
};

export function AccessDeniedPage({ moduleName, onNavigate }: AccessDeniedPageProps) {
  return (
    <StatusScreen
      description={moduleName + " is restricted by the current role-based access policy."}
      eyebrow="Authorization boundary"
      icon={ShieldAlert}
      noteDescription="Staff accounts can use role-approved operational modules. Owner-only administration, reporting, forecasting, product management, and settings remain protected."
      noteTitle="Your signed-in account is safe"
      primaryAction={{
        icon: <LayoutDashboard className="h-4 w-4" aria-hidden="true" />,
        label: "Back to dashboard",
        onClick: () => onNavigate("/dashboard")
      }}
      statusLabel="HTTP 403"
      title="Access denied"
    />
  );
}
