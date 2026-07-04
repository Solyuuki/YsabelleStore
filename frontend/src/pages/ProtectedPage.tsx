import type { ComponentType, SVGProps } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { ProtectedModuleCard } from "@/components/shared/ProtectedModuleCard";

type ProtectedPageProps = {
  title: string;
  description: string;
  hasOwnerAccess: boolean;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

export function ProtectedPage({ description, hasOwnerAccess, icon, title }: ProtectedPageProps) {
  return (
    <>
      <PageHeader eyebrow="Owner area" title={title} description={description} />
      <ProtectedModuleCard
        hasOwnerAccess={hasOwnerAccess}
        moduleName={title}
        reason="This area can expose sensitive decisions, reports, or system configuration."
      />
      <EmptyState
        description={
          hasOwnerAccess
            ? "Owner access is verified. Feature content will appear when this module is implemented."
            : "Content remains hidden because the current user is not an owner."
        }
        icon={icon}
        title={hasOwnerAccess ? `${title} access verified` : `${title} content is restricted`}
      />
    </>
  );
}
