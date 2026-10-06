import type { ComponentType, SVGProps } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { cn } from "@/lib/utils";

type StatCardTone = "success" | "warning" | "info";
type StatCardAccent = "blue" | "violet" | "emerald" | "amber" | "rose";

type StatCardProps = {
  title: string;
  value: string;
  detail: string;
  tone: StatCardTone;
  accent?: StatCardAccent;
  badgeClassName?: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

const iconAccentClass: Record<StatCardAccent, string> = {
  blue:
    "bg-gradient-to-br from-sky-500 via-blue-500 to-indigo-500 shadow-blue-200/70",
  violet:
    "bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 shadow-violet-200/70",
  emerald:
    "bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-500 shadow-emerald-200/70",
  amber:
    "bg-gradient-to-br from-amber-400 via-orange-400 to-orange-500 shadow-amber-200/70",
  rose:
    "bg-gradient-to-br from-rose-400 via-pink-500 to-rose-500 shadow-rose-200/70"
};

export function StatCard({
  accent = "blue",
  badgeClassName,
  detail,
  icon: Icon,
  title,
  tone,
  value
}: StatCardProps) {
  return (
    <Card className="ys-kpi-card-surface min-h-36">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle>{title}</CardTitle>
        <span
          className={cn(
            "ys-material-accent flex h-9 w-9 items-center justify-center rounded-md text-white shadow-sm ring-1 ring-white/70",
            iconAccentClass[accent]
          )}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </CardHeader>
      <CardContent>
        <p className="type-metric text-slate-950">{value}</p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="type-body-sm text-slate-500">{detail}</p>
          <StatusBadge className={badgeClassName} variant={tone}>
            {tone}
          </StatusBadge>
        </div>
      </CardContent>
    </Card>
  );
}
