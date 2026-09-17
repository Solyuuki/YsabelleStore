import {
  Boxes,
  ChartNoAxesCombined,
  FileBarChart,
  History,
  LayoutDashboard,
  LineChart,
  Package,
  ReceiptText,
  ScanBarcode,
  Settings,
  Truck,
  UsersRound
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import type { AuthUserRole } from "@/types/auth";

export type AppRoutePath =
  | "/"
  | "/staff-login"
  | "/dashboard"
  | "/pos"
  | "/products"
  | "/inventory"
  | "/receiving"
  | "/sales"
  | "/forecast"
  | "/historical-sales"
  | "/reports"
  | "/users"
  | "/settings"
  | "/not-found";

export type AppRoute = {
  path: AppRoutePath;
  label: string;
  description: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  allowedRoles: readonly AuthUserRole[];
  protected?: boolean;
};

export const appRoutes: readonly AppRoute[] = [
  {
    path: "/dashboard",
    label: "Dashboard",
    description: "Retail overview and system status",
    icon: LayoutDashboard,
    allowedRoles: ["OWNER", "STAFF"]
  },
  {
    path: "/pos",
    label: "POS",
    description: "Barcode-first selling workspace",
    icon: ScanBarcode,
    allowedRoles: ["OWNER", "STAFF"]
  },
  {
    path: "/products",
    label: "Products",
    description: "Product catalog, import, and inventory workspace",
    icon: Package,
    allowedRoles: ["OWNER"]
  },
  {
    path: "/inventory",
    label: "Inventory",
    description: "Stock monitoring and movement workspace",
    icon: Boxes,
    allowedRoles: ["OWNER", "STAFF"]
  },
  {
    path: "/receiving",
    label: "Receiving",
    description: "Approved restock tickets, physical delivery checks, and returns",
    icon: Truck,
    allowedRoles: ["OWNER"]
  },
  {
    path: "/sales",
    label: "Sales",
    description: "Sales history module shell",
    icon: ReceiptText,
    allowedRoles: ["OWNER", "STAFF"]
  },
  {
    path: "/forecast",
    label: "Forecast",
    description: "Demand forecast module shell",
    icon: LineChart,
    allowedRoles: ["OWNER"],
    protected: true
  },
  {
    path: "/historical-sales",
    label: "Historical Sales",
    description: "Approved monthly sales history and SARIMA data management",
    icon: History,
    allowedRoles: ["OWNER"],
    protected: true
  },
  {
    path: "/reports",
    label: "Reports",
    description: "Live sales, inventory, and expiry reporting",
    icon: FileBarChart,
    allowedRoles: ["OWNER"],
    protected: true
  },
  {
    path: "/users",
    label: "User Management",
    description: "User management module",
    icon: UsersRound,
    allowedRoles: ["OWNER"]
  },
  {
    path: "/settings",
    label: "Settings",
    description: "Owner workstation preferences and system readiness",
    icon: Settings,
    allowedRoles: ["OWNER"],
    protected: true
  }
];

export const utilityRoutes: readonly AppRoute[] = [
  {
    path: "/",
    label: "Welcome",
    description: "Continue screen",
    icon: ChartNoAxesCombined,
    allowedRoles: ["OWNER", "STAFF"]
  },
  {
    path: "/staff-login",
    label: "Staff Login",
    description: "Owner and staff account access",
    icon: ChartNoAxesCombined,
    allowedRoles: ["OWNER", "STAFF"]
  },
  {
    path: "/not-found",
    label: "Not Found",
    description: "Unknown route screen",
    icon: ChartNoAxesCombined,
    allowedRoles: ["OWNER", "STAFF"]
  }
];

export const allRoutes = [...utilityRoutes, ...appRoutes] as const;

export function getRouteByPath(path: string) {
  return allRoutes.find((route) => route.path === path);
}

export function canRoleAccessRoute(route: AppRoute, role: AuthUserRole | undefined) {
  return Boolean(role && route.allowedRoles.includes(role));
}
