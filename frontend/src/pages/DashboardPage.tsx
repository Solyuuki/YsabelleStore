import { Boxes, ChartNoAxesCombined, LineChart, PackageOpen, ReceiptText } from "lucide-react";

import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/StatusBadge";

const dashboardStats = [
  {
    title: "Today's Sales",
    value: "PHP 0.00",
    detail: "No sales recorded",
    tone: "info",
    icon: ReceiptText
  },
  {
    title: "Inventory Status",
    value: "Ready",
    detail: "Stock workspace ready",
    tone: "success",
    icon: Boxes
  },
  {
    title: "Low Stock",
    value: "0 items",
    detail: "No items flagged",
    tone: "warning",
    icon: PackageOpen
  },
  {
    title: "Near Expiry",
    value: "0 batches",
    detail: "No batches flagged",
    tone: "warning",
    icon: ChartNoAxesCombined
  },
  {
    title: "Forecast Summary",
    value: "Protected",
    detail: "Owner verification required",
    tone: "info",
    icon: LineChart
  }
] as const;

export function DashboardPage() {
  return (
    <>
      <PageHeader
        eyebrow="Store overview"
        title="Dashboard"
        description="A quick operating view for sales, stock, expiry attention, and forecast access."
      />

      <section className="grid gap-4 xl:grid-cols-5 lg:grid-cols-3">
        {dashboardStats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <CardTitle>Retail activity</CardTitle>
              <StatusBadge variant="info">Today</StatusBadge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid h-60 grid-cols-12 items-end gap-2 rounded-md border border-slate-200 bg-slate-50 p-4">
              {[32, 44, 28, 56, 40, 70, 54, 62, 38, 80, 52, 66].map((height, index) => (
                <div
                  className="rounded-sm bg-emerald-600"
                  key={`${height}-${index}`}
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Opening checklist</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                "Ready to continue",
                "Navigation ready",
                "Owner areas marked",
                "Counter workspace ready"
              ].map((item) => (
                <div
                  className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
                  key={item}
                >
                  <span className="text-sm text-slate-700">{item}</span>
                  <StatusBadge variant="success">Ready</StatusBadge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
    </>
  );
}
