import { ClipboardList } from "lucide-react";

import { EmptyState } from "@/components/shared/EmptyState";

type PlannedRoutePlaceholderProps = {
  label: string;
};

export function PlannedRoutePlaceholder({ label }: PlannedRoutePlaceholderProps) {
  return (
    <EmptyState
      description="This module is reserved for an approved future sprint."
      icon={<ClipboardList aria-hidden="true" className="h-8 w-8" />}
      title={label}
    />
  );
}
