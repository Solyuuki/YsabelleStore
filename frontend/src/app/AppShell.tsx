import { Boxes, Package, ReceiptText } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { canRoleAccessRoute, getRouteByPath, type AppRoute, type AppRoutePath } from "@/app/routes";
import { AppLayout } from "@/layouts/AppLayout";
import { useAuth } from "@/context/AuthContext";
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
    continueWithTrustedDevice,
    isAuthReady,
    login,
    logout,
    rememberedAccounts,
    removeRememberedAccount,
    register,
    status,
    switchUser,
    user
  } = useAuth();
  const [path, setPath] = useState(getCurrentPath);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.innerWidth < 1280);
  const [showLaunchSplash, setShowLaunchSplash] = useState(false);

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

  const handleLogout = useCallback(() => {
    void logout();
    navigate("/");
  }, [logout, navigate]);

  useEffect(() => {
    if (!isAuthReady) {
      return;
    }

    if (status === "authenticated" && path === "/") {
      navigate("/dashboard");
    }

    if (status === "unauthenticated" && path !== "/") {
      navigate("/");
    }
  }, [isAuthReady, navigate, path, status]);

  useEffect(() => {
    if (isAuthReady) {
      setShowLaunchSplash(false);
      return;
    }

    const splashTimer = window.setTimeout(() => {
      setShowLaunchSplash(true);
    }, 180);

    return () => {
      window.clearTimeout(splashTimer);
    };
  }, [isAuthReady]);

  if (!isAuthReady || (status === "authenticated" && path === "/")) {
    return showLaunchSplash ? <LaunchSplash /> : null;
  }

  if (status !== "authenticated" || path === "/") {
    return (
      <WelcomePage
        error={error}
        rememberedAccounts={rememberedAccounts}
        status={status}
        user={user}
        onLogin={login}
        onNavigate={navigate}
        onContinueWithTrustedDevice={continueWithTrustedDevice}
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
      onLogout={handleLogout}
      onToggleSidebar={() => setSidebarCollapsed((current) => !current)}
      user={user}
    >
      {renderRoute(path, routeForLayout, navigate, user, error, register)}
    </AppLayout>
  );
}

function LaunchSplash() {
  return (
    <main className="welcome-ambient relative flex min-h-screen overflow-hidden text-slate-950">
      <div className="welcome-ambient-blob left-[8%] top-[12%] h-[clamp(15rem,24vw,28rem)] w-[clamp(15rem,24vw,28rem)] bg-emerald-200" />
      <div className="welcome-ambient-blob right-[7%] top-[8%] h-[clamp(16rem,26vw,32rem)] w-[clamp(16rem,26vw,32rem)] bg-blue-200 animation-delay-7000" />
      <div className="welcome-ambient-blob bottom-[2%] left-[38%] h-[clamp(14rem,22vw,26rem)] w-[clamp(14rem,22vw,26rem)] bg-violet-200 animation-delay-14000" />

      <div className="relative z-10 flex flex-1 items-center justify-center px-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/70 bg-white/75 shadow-[0_18px_48px_rgba(15,23,42,0.12)] backdrop-blur-md">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-700 border-t-transparent" />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-700/90">
            Checking session
          </p>
          <p className="text-sm font-medium text-slate-700">Opening YsabelleStore...</p>
        </div>
      </div>
    </main>
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
