import type { PlannedRouteGroup } from "@/types/routes";

export const plannedRouteGroups: readonly PlannedRouteGroup[] = [
  { segment: "authentication", path: "/auth", status: "planned" },
  { segment: "dashboard", path: "/dashboard", status: "planned" },
  { segment: "products", path: "/products", status: "planned" },
  { segment: "inventory", path: "/inventory", status: "planned" },
  { segment: "sales", path: "/sales", status: "planned" },
  { segment: "forecasts", path: "/forecasts", status: "planned" },
  { segment: "recommendations", path: "/recommendations", status: "planned" },
  { segment: "reports", path: "/reports", status: "planned" },
  { segment: "settings", path: "/settings", status: "planned" }
];
