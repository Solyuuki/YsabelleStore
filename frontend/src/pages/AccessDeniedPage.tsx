import { ShieldAlert } from "lucide-react";

import type { AppRoutePath } from "@/app/routes";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";

type AccessDeniedPageProps = {
  moduleName: string;
  onNavigate: (path: AppRoutePath) => void;
};

export function AccessDeniedPage({ moduleName, onNavigate }: AccessDeniedPageProps) {
  return (
    <>
      <PageHeader
        eyebrow="Access denied"
        title="Owner access required"
        description={`${moduleName} is restricted by the current role-based access policy.`}
        actions={
          <Button onClick={() => onNavigate("/dashboard")} type="button" variant="secondary">
            Back to dashboard
          </Button>
        }
      />
      <EmptyState
        description="Staff accounts can use sales processing and inventory monitoring. Owner accounts can open administrative, reports, forecasting, product management, and settings modules."
        icon={ShieldAlert}
        title="This account cannot open the selected module"
      />
    </>
  );
}
