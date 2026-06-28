import type { ComponentType, SVGProps } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/StatusBadge";

type StatCardTone = "success" | "warning" | "info";

type StatCardProps = {
  title: string;
  value: string;
  detail: string;
  tone: StatCardTone;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

export function StatCard({ detail, icon: Icon, title, tone, value }: StatCardProps) {
  return (
    <Card className="min-h-36">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle>{title}</CardTitle>
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-slate-700">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold text-slate-950">{value}</p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-sm text-slate-500">{detail}</p>
          <StatusBadge variant={tone}>{tone}</StatusBadge>
        </div>
      </CardContent>
    </Card>
  );
}
