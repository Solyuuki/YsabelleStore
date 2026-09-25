import { LayoutDashboard, ShieldAlert } from "lucide-react";

import type { AppRoutePath } from "@/app/routes";
import { SystemStatusScreen } from "@/components/shared/SystemStatusScreen";

type AccessDeniedPageProps = {
  moduleName: string;
  onNavigate: (path: AppRoutePath) => void;
};

export function AccessDeniedPage({ moduleName, onNavigate }: AccessDeniedPageProps) {
  return (
    <SystemStatusScreen
      code="403"
      eyebrow="Authorization"
      icon={ShieldAlert}
      message={`${moduleName} is restricted by the current role-based access policy. Your account is signed in, but this role is not authorized to open the selected module.`}
      noteMessage="Staff accounts retain access to their permitted operational modules. Owner-only administration, reporting, forecasting, product-management, and settings surfaces remain protected."
      noteTitle="Role protection is active"
      primaryAction={{
        icon: LayoutDashboard,
        label: "Back to dashboard",
        onClick: () => onNavigate("/dashboard")
      }}
      statusMeta="HTTP 403 · authenticated but not authorized"
      title="Access denied"
    />
  );
}
