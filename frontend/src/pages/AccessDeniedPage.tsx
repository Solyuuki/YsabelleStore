import { useEffect, useRef } from "react";
import { ShieldAlert } from "lucide-react";

import type { AppRoutePath } from "@/app/routes";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { useToast } from "@/components/shared/ToastProvider";
import { Button } from "@/components/ui/button";

type AccessDeniedPageProps = {
  moduleName: string;
  onNavigate: (path: AppRoutePath) => void;
};

export function AccessDeniedPage({ moduleName, onNavigate }: AccessDeniedPageProps) {
  const { pushToast } = useToast();
  const hasAnnouncedRef = useRef(false);

  useEffect(() => {
    if (hasAnnouncedRef.current) {
      return;
    }

    hasAnnouncedRef.current = true;
    pushToast({
      message: "You do not have permission to access this area.",
      title: "Access denied",
      variant: "warning"
    });
  }, [pushToast, moduleName]);

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
