import { Boxes, Package, ReceiptText } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { canRoleAccessRoute, getRouteByPath, type AppRoute, type AppRoutePath } from "@/app/routes";
import { useAuth } from "@/context/AuthContext";
import { AppLayout } from "@/layouts/AppLayout";
import { AccessDeniedPage } from "@/pages/AccessDeniedPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { ModulePage } from "@/pages/ModulePage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { PosPage } from "@/pages/PosPage";
import { ProtectedPage } from "@/pages/ProtectedPage";
import { UserManagementPage } from "@/pages/UserManagementPage";
import { WelcomePage } from "@/pages/WelcomePage";

const validRoutePaths = new Set<string>([
  "/",
  "/dashboard",
  "/pos",
  "/products",
  "/inventory",
  "/sales",
  "/forecast",
  "/reports",
  "/users",
  "/settings",
  "/not-found"
]);

function getCurrentPath() {
  return window.location.pathname || "/";
}

export function AppShell() {
  const {
    error,
    login,
    logout,
    rememberedAccounts,
    removeRememberedAccount,
    register,
    selectRememberedAccount,
    status,
    switchUser,
    user
  } = useAuth();
  const [path, setPath] = useState(getCurrentPath);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.innerWidth < 1280);

  useEffect(() => {
    const handlePopState = () => setPath(getCurrentPath());

    window.addEventListener("popstate", handlePopState);

    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = useCallback((nextPath: AppRoutePath) => {
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, "", nextPath);
    }

    setPath(nextPath);
  }, []);

  const route = useMemo(() => getRouteByPath(path), [path]);
  const routeForLayout = route ?? getRouteByPath("/not-found");

  if (status !== "authenticated" || path === "/") {
    return (
      <WelcomePage
        error={error}
        rememberedAccounts={rememberedAccounts}
        status={status}
        user={user}
        onLogin={login}
        onNavigate={navigate}
        onRememberedAccountSelect={selectRememberedAccount}
        onRemoveRememberedAccount={removeRememberedAccount}
        onSwitchUser={switchUser}
      />
    );
  }

  return (
    <AppLayout
      activePath={validRoutePaths.has(path) ? path : "/not-found"}
      collapsed={sidebarCollapsed}
      onNavigate={navigate}
      onLogout={() => {
        void logout().then(() => navigate("/"));
      }}
      onToggleSidebar={() => setSidebarCollapsed((current) => !current)}
      user={user}
    >
      {renderRoute(path, routeForLayout, navigate, user, error, register)}
    </AppLayout>
  );
}

function renderRoute(
  path: string,
  route: AppRoute | undefined,
  navigate: (path: AppRoutePath) => void,
  user: ReturnType<typeof useAuth>["user"],
  error: ReturnType<typeof useAuth>["error"],
  register: ReturnType<typeof useAuth>["register"]
) {
  if (!route || path === "/not-found") {
    return <NotFoundPage onNavigate={navigate} />;
  }

  if (!canRoleAccessRoute(route, user?.role)) {
    return <AccessDeniedPage moduleName={route.label} onNavigate={navigate} />;
  }

  if (route.protected) {
    return (
      <ProtectedPage
        description={route.description}
        hasOwnerAccess={user?.role === "OWNER"}
        icon={route.icon}
        title={route.label}
      />
    );
  }

  switch (route.path) {
    case "/dashboard":
      return <DashboardPage />;
    case "/pos":
      return <PosPage />;
    case "/products":
      return (
        <ModulePage
          description={route.description}
          focusItems={[
            "Catalog table area",
            "Product search and filters",
            "Create and edit actions reserved",
            "Category and unit fields reserved"
          ]}
          icon={Package}
          title={route.label}
        />
      );
    case "/inventory":
      return (
        <ModulePage
          description={route.description}
          focusItems={[
            "Stock level table area",
            "Low-stock status badges",
            "Batch and expiry columns reserved",
            "Stock movement actions reserved"
          ]}
          icon={Boxes}
          title={route.label}
        />
      );
    case "/sales":
      return (
        <ModulePage
          description={route.description}
          focusItems={[
            "Receipt history table area",
            "Date and cashier filters",
            "Sale detail panel reserved",
            "Export action reserved"
          ]}
          icon={ReceiptText}
          title={route.label}
        />
      );
    case "/users":
      return <UserManagementPage error={error} onRegister={register} user={user} />;
    default:
      return <NotFoundPage onNavigate={navigate} />;
  }
}
