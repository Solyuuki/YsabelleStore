import { ArrowRight, SearchX } from "lucide-react";

import type { AppRoutePath } from "@/app/routes";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";

type NotFoundPageProps = {
  onNavigate: (path: AppRoutePath) => void;
};

export function NotFoundPage({ onNavigate }: NotFoundPageProps) {
  return (
    <div className="space-y-4">
      <EmptyState
        description="The requested screen is not part of the Sprint 1 frontend shell route list."
        icon={SearchX}
        title="Screen not found"
      />
      <Button onClick={() => onNavigate("/dashboard")} type="button">
        Go to dashboard
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
