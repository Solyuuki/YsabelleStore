import { LayoutDashboard } from "lucide-react";

import type { AppRoutePath } from "@/app/routes";
import { StatusScreen } from "@/components/shared/StatusScreen";

type NotFoundPageProps = {
  onNavigate: (path: AppRoutePath) => void;
};

export function NotFoundPage({ onNavigate }: NotFoundPageProps) {
  return (
    <StatusScreen
      description="We couldn’t find this Ysabelle Store page. It may have moved, or the address may be incorrect."
      eyebrow="Page not found"
      primaryAction={{
        icon: <LayoutDashboard className="h-4 w-4" aria-hidden="true" />,
        label: "Go to dashboard",
        onClick: () => onNavigate("/dashboard")
      }}
      statusLabel="404"
      title="This page isn’t here"
      variant="navigation"
    />
  );
}
