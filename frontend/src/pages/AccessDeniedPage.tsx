import { LayoutDashboard } from "lucide-react";

import type { AppRoutePath } from "@/app/routes";
import { StatusScreen } from "@/components/shared/StatusScreen";

type AccessDeniedPageProps = {
  moduleName: string;
  onNavigate: (path: AppRoutePath) => void;
};

export function AccessDeniedPage({ moduleName, onNavigate }: AccessDeniedPageProps) {
  return (
    <StatusScreen
      description={"You’re signed in, but " + moduleName + " isn’t available to your current role."}
      eyebrow="Permission required"
      primaryAction={{
        icon: <LayoutDashboard className="h-4 w-4" aria-hidden="true" />,
        label: "Back to dashboard",
        onClick: () => onNavigate("/dashboard")
      }}
      statusLabel="403"
      title="Access denied"
      variant="auth"
    />
  );
}
