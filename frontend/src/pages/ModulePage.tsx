import type { ComponentType, SVGProps } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ModulePageProps = {
  title: string;
  description: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  focusItems: string[];
};

export function ModulePage({ description, focusItems, icon, title }: ModulePageProps) {
  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title={title}
        description={description}
        actions={<StatusBadge variant="info">Ready</StatusBadge>}
      />

      <section className="grid gap-4 xl:grid-cols-[0.7fr_1.3fr]">
        <Card>
          <CardHeader>
            <CardTitle>Prepared areas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {focusItems.map((item) => (
                <div
                  className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                  key={item}
                >
                  {item}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <EmptyState
          description="Records, filters, and actions will appear here when store data is available."
          icon={icon}
          title={`No ${title.toLowerCase()} records yet`}
        />
      </section>
    </>
  );
}
