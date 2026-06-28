import type { PlannedRouteGroup } from "@/types/routes";

export const plannedRouteGroups: readonly PlannedRouteGroup[] = [
  { label: "Authentication", path: "/auth", segment: "authentication", status: "planned" },
  { label: "Dashboard", path: "/dashboard", segment: "dashboard", status: "planned" },
  { label: "Products", path: "/products", segment: "products", status: "planned" },
  { label: "Inventory", path: "/inventory", segment: "inventory", status: "planned" },
  { label: "Sales", path: "/sales", segment: "sales", status: "planned" },
  { label: "Forecasts", path: "/forecasts", segment: "forecasts", status: "planned" },
  {
    label: "Recommendations",
    path: "/recommendations",
    segment: "recommendations",
    status: "planned"
  },
  { label: "Reports", path: "/reports", segment: "reports", status: "planned" },
  { label: "Settings", path: "/settings", segment: "settings", status: "planned" }
];
