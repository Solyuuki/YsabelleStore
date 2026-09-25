import { LayoutDashboard, SearchX } from "lucide-react";

import type { AppRoutePath } from "@/app/routes";
import { SystemStatusScreen } from "@/components/shared/SystemStatusScreen";

type NotFoundPageProps = {
  onNavigate: (path: AppRoutePath) => void;
};

export function NotFoundPage({ onNavigate }: NotFoundPageProps) {
  return (
    <SystemStatusScreen
      code="404"
      eyebrow="Navigation"
      icon={SearchX}
      message="The requested internal screen does not exist or is no longer available at this address."
      noteMessage="No store data was changed. Use the dashboard to return to a known operational route."
      noteTitle="Your work is unchanged"
      primaryAction={{
        icon: LayoutDashboard,
        label: "Go to dashboard",
        onClick: () => onNavigate("/dashboard")
      }}
      statusMeta="HTTP 404 · route not found"
      title="Page not found"
    />
  );
}
