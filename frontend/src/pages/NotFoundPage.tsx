import { LayoutDashboard, SearchX } from "lucide-react";

import type { AppRoutePath } from "@/app/routes";
import { StatusScreen } from "@/components/shared/StatusScreen";

type NotFoundPageProps = {
  onNavigate: (path: AppRoutePath) => void;
};

export function NotFoundPage({ onNavigate }: NotFoundPageProps) {
  return (
    <StatusScreen
      description="The requested Ysabelle Store screen does not exist or is no longer available at this address."
      eyebrow="Navigation status"
      icon={SearchX}
      noteDescription="No store data was changed. Use the dashboard to return to a known application route."
      noteTitle="Nothing was submitted"
      primaryAction={{
        icon: <LayoutDashboard className="h-4 w-4" aria-hidden="true" />,
        label: "Go to dashboard",
        onClick: () => onNavigate("/dashboard")
      }}
      statusLabel="HTTP 404"
      title="Page not found"
    />
  );
}
