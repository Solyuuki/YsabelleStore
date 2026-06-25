export type PlannedRouteGroup = {
  segment:
    | "authentication"
    | "dashboard"
    | "products"
    | "inventory"
    | "sales"
    | "forecasts"
    | "recommendations"
    | "reports"
    | "settings";
  path: string;
  status: "planned";
};
