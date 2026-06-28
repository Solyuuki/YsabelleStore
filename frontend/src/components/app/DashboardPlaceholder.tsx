import { Boxes, Database, LineChart, Store } from "lucide-react";

import { EmptyState } from "@/components/shared/EmptyState";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const foundationItems = [
  {
    title: "Products",
    description: "Barcode-ready product records",
    icon: Store
  },
  {
    title: "Inventory",
    description: "Batch stock and expiry tracking",
    icon: Boxes
  },
  {
    title: "Sales",
    description: "History prepared for demand inputs",
    icon: Database
  },
  {
    title: "Forecasts",
    description: "SARIMA outputs reserved for later sprint work",
    icon: LineChart
  }
];

export function DashboardPlaceholder() {
  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <p className="text-sm font-medium text-primary">Ysabelle&apos;s Store</p>
        <h1 className="text-2xl font-semibold text-foreground">Dashboard foundation</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          The shell is ready for future inventory, sales, forecasting, and recommendation screens.
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {foundationItems.map((item) => {
          const Icon = item.icon;

          return (
            <Card key={item.title}>
              <CardHeader>
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon aria-hidden="true" className="h-5 w-5" />
                </div>
                <CardTitle>{item.title}</CardTitle>
                <CardDescription>{item.description}</CardDescription>
              </CardHeader>
            </Card>
          );
        })}
      </div>

      <EmptyState
        description="Business workflows remain intentionally inactive until their approved feature sprint."
        icon={<Store aria-hidden="true" className="h-8 w-8" />}
        title="Sprint 1 shell is ready"
      />
    </div>
  );
}
