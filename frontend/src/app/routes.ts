import {
  Boxes,
  ChartNoAxesCombined,
  FileBarChart,
  Headphones,
  History,
  LayoutDashboard,
  LineChart,
  Package,
  PackageCheck,
  ReceiptText,
  Tags,
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
  | "/categories"
  | "/inventory"
  | "/receiving"
  | "/sales"
  | "/deliveries"
  | "/customer-support"
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
    description: "Today's sales, stock, and store activity",
    icon: LayoutDashboard,
    allowedRoles: ["OWNER", "STAFF"]
  },
  {
    path: "/pos",
    label: "POS",
    description: "Scan items and complete counter sales",
    icon: ScanBarcode,
    allowedRoles: ["OWNER", "STAFF"]
  },
  {
    path: "/products",
    label: "Products",
    description: "Add products, import items, and update their details",
    icon: Package,
    allowedRoles: ["OWNER"]
  },
  {
    path: "/categories",
    label: "Categories",
    description: "Organize products into shopping categories",
    icon: Tags,
    allowedRoles: ["OWNER"]
  },
  {
    path: "/inventory",
    label: "Inventory",
    description: "View stock levels and inventory changes",
    icon: Boxes,
    allowedRoles: ["OWNER", "STAFF"]
  },
  {
    path: "/receiving",
    label: "Receiving",
    description: "Check incoming stock, restocks, and returns",
    icon: Truck,
    allowedRoles: ["OWNER"]
  },
  {
    path: "/sales",
    label: "Sales",
    description: "Review completed sales",
    icon: ReceiptText,
    allowedRoles: ["OWNER", "STAFF"]
  },
  {
    path: "/deliveries",
    label: "Deliveries",
    description: "Track deliveries and record payments",
    icon: PackageCheck,
    allowedRoles: ["OWNER", "STAFF"]
  },
  {
    path: "/customer-support",
    label: "Support",
    description: "Read and respond to customer questions",
    icon: Headphones,
    allowedRoles: ["OWNER", "STAFF"]
  },
  {
    path: "/forecast",
    label: "Forecast",
    description: "See estimated demand for future restocking",
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
    description: "Download sales, stock, and expiry reports",
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
    description: "Adjust store settings and check system status",
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
