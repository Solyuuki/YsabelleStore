export type RouteGroupStatus = "planned" | "implemented";

export type RouteGroup = {
  path: string;
  module: string;
  status: RouteGroupStatus;
};
