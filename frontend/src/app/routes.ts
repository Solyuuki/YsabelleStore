import {
  Boxes,
  ChartNoAxesCombined,
  FileBarChart,
  LayoutDashboard,
  LineChart,
  Package,
  ReceiptText,
  ScanBarcode,
  Settings
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";

export type AppRoutePath =
  | "/"
  | "/dashboard"
  | "/pos"
  | "/products"
  | "/inventory"
  | "/sales"
  | "/forecast"
  | "/reports"
  | "/settings"
  | "/not-found";

export type AppRoute = {
  path: AppRoutePath;
  label: string;
  description: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  protected?: boolean;
};

export const appRoutes: readonly AppRoute[] = [
  {
    path: "/dashboard",
    label: "Dashboard",
    description: "Retail overview and system status",
    icon: LayoutDashboard
  },
  {
    path: "/pos",
    label: "POS",
    description: "Barcode-first selling workspace",
    icon: ScanBarcode
  },
  {
    path: "/products",
    label: "Products",
    description: "Product catalog module shell",
    icon: Package
  },
  {
    path: "/inventory",
    label: "Inventory",
    description: "Stock monitoring module shell",
    icon: Boxes
  },
  {
    path: "/sales",
    label: "Sales",
    description: "Sales history module shell",
    icon: ReceiptText
  },
  {
    path: "/forecast",
    label: "Forecast",
    description: "Demand forecast module shell",
    icon: LineChart,
    protected: true
  },
  {
    path: "/reports",
    label: "Reports",
    description: "Protected reporting module shell",
    icon: FileBarChart,
    protected: true
  },
  {
    path: "/settings",
    label: "Settings",
    description: "Protected system settings shell",
    icon: Settings,
    protected: true
  }
];

export const utilityRoutes: readonly AppRoute[] = [
  {
    path: "/",
    label: "Welcome",
    description: "Continue screen",
    icon: ChartNoAxesCombined
  },
  {
    path: "/not-found",
    label: "Not Found",
    description: "Unknown route screen",
    icon: ChartNoAxesCombined
  }
];

export const allRoutes = [...utilityRoutes, ...appRoutes] as const;

export function getRouteByPath(path: string) {
  return allRoutes.find((route) => route.path === path);
}
