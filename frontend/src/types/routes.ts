export type RouteSegment =
  | "authentication"
  | "dashboard"
  | "products"
  | "inventory"
  | "sales"
  | "forecasts"
  | "recommendations"
  | "reports"
  | "settings";

export type PlannedRouteGroup = {
  label: string;
  path: string;
  segment: RouteSegment;
  status: "planned";
};
