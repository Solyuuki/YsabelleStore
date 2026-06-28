import { Navigate, Route, Routes } from "react-router-dom";

import { plannedRouteGroups } from "@/app/routes";
import { DashboardPlaceholder } from "@/components/app/DashboardPlaceholder";
import { PlannedRoutePlaceholder } from "@/components/app/PlannedRoutePlaceholder";
import { AppLayout } from "@/layouts/AppLayout";

export function AppShell() {
  return (
    <AppLayout>
      <Routes>
        <Route element={<Navigate replace to="/dashboard" />} path="/" />
        <Route element={<DashboardPlaceholder />} path="/dashboard" />
        {plannedRouteGroups
          .filter((route) => route.segment !== "dashboard")
          .map((route) => (
            <Route
              element={<PlannedRoutePlaceholder label={route.label} />}
              key={route.path}
              path={route.path}
            />
          ))}
        <Route element={<Navigate replace to="/dashboard" />} path="*" />
      </Routes>
    </AppLayout>
  );
}
