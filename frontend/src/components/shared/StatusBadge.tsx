import { CircleCheck, CircleX, Info, Lock, TriangleAlert } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

import { Badge } from "@/components/ui/badge";

type StatusBadgeVariant = "success" | "error" | "warning" | "info" | "protected";

type StatusBadgeProps = {
  children: string;
  className?: string;
  variant: StatusBadgeVariant;
};

const iconByVariant: Record<StatusBadgeVariant, ComponentType<SVGProps<SVGSVGElement>>> = {
  success: CircleCheck,
  error: CircleX,
  warning: TriangleAlert,
  info: Info,
  protected: Lock
};

const badgeVariantByStatus = {
  success: "success",
  error: "danger",
  warning: "warning",
  info: "info",
  protected: "warning"
} as const;

export function StatusBadge({ children, className, variant }: StatusBadgeProps) {
  const Icon = iconByVariant[variant];

  return (
    <Badge className={className} variant={badgeVariantByStatus[variant]}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {children}
    </Badge>
  );
}
