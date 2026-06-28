import type { ComponentType, SVGProps } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { ProtectedModuleCard } from "@/components/shared/ProtectedModuleCard";

type ProtectedPageProps = {
  title: string;
  description: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

export function ProtectedPage({ description, icon, title }: ProtectedPageProps) {
  return (
    <>
      <PageHeader eyebrow="Owner area" title={title} description={description} />
      <ProtectedModuleCard
        moduleName={title}
        reason="This area can expose sensitive decisions, reports, or system configuration."
      />
      <EmptyState
        description="Content remains hidden until owner verification is completed."
        icon={icon}
        title={`${title} content is restricted`}
      />
    </>
  );
}
