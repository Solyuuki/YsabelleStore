import { Boxes } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { canRoleAccessRoute, getRouteByPath, type AppRoute, type AppRoutePath } from "@/app/routes";
import { LogoutConfirmationModal } from "@/components/shared/LogoutConfirmationModal";
import { AppLayout } from "@/layouts/AppLayout";
import { useAuth } from "@/context/AuthContext";
import { AccessDeniedPage } from "@/pages/AccessDeniedPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { ProductsPage } from "@/pages/ProductsPage";
import { ModulePage } from "@/pages/ModulePage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { PosPage } from "@/pages/PosPage";
import { SalesPage } from "@/pages/SalesPage";
import { ProtectedPage } from "@/pages/ProtectedPage";
import { UserManagementPage } from "@/pages/UserManagementPage";
import { WelcomePage } from "@/pages/WelcomePage";
import { wait } from "@/utils/timing";

const LAUNCH_SPLASH_DELAY_MS = 250;
const LOGOUT_CONFIRMATION_MINIMUM_MS = 700;

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
  const shouldHoldForAuth = !isAuthReady || (status === "authenticated" && path === "/");
  const [showLaunchSplash, setShowLaunchSplash] = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [logoutSubmitting, setLogoutSubmitting] = useState(false);
  const logoutSubmittingRef = useRef(false);

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
    setLogoutModalOpen(true);
  }, []);

  const handleCancelLogout = useCallback(() => {
    if (logoutSubmitting) {
      return;
    }

    setLogoutModalOpen(false);
  }, [logoutSubmitting]);

  const handleConfirmLogout = useCallback(async () => {
    if (logoutSubmittingRef.current) {
      return;
    }

    logoutSubmittingRef.current = true;
    setLogoutSubmitting(true);

    await wait(LOGOUT_CONFIRMATION_MINIMUM_MS);
    await logout();

    logoutSubmittingRef.current = false;
    setLogoutModalOpen(false);
    setLogoutSubmitting(false);
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
    if (!shouldHoldForAuth) {
      setShowLaunchSplash(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setShowLaunchSplash(true);
    }, LAUNCH_SPLASH_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [shouldHoldForAuth]);

  if (shouldHoldForAuth) {
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
    <>
      <AppLayout
        activePath={validRoutePaths.has(path) ? path : "/not-found"}
        collapsed={sidebarCollapsed}
        onNavigate={navigate}
        onLogout={handleLogout}
        onToggleSidebar={() => setSidebarCollapsed((current) => !current)}
        user={user}
      >
        <div className="auth-panel-enter" key={path}>
          {renderRoute(path, routeForLayout, navigate, user, error, register)}
        </div>
      </AppLayout>
      {logoutModalOpen ? (
        <LogoutConfirmationModal
          isLoggingOut={logoutSubmitting}
          onCancel={handleCancelLogout}
          onConfirm={() => void handleConfirmLogout()}
        />
      ) : null}
    </>
  );
}

function LaunchSplash() {
  return (
    <main className="welcome-ambient auth-page-enter relative flex min-h-screen overflow-hidden text-slate-950">
      <div className="welcome-ambient-blob left-[8%] top-[12%] h-[clamp(15rem,24vw,28rem)] w-[clamp(15rem,24vw,28rem)] bg-emerald-200" />
      <div className="welcome-ambient-blob right-[7%] top-[8%] h-[clamp(16rem,26vw,32rem)] w-[clamp(16rem,26vw,32rem)] bg-blue-200 animation-delay-7000" />
      <div className="welcome-ambient-blob bottom-[2%] left-[38%] h-[clamp(14rem,22vw,26rem)] w-[clamp(14rem,22vw,26rem)] bg-violet-200 animation-delay-14000" />

      <div className="relative z-10 flex flex-1 items-center justify-center px-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/70 bg-white/75 shadow-[0_18px_48px_rgba(15,23,42,0.12)] backdrop-blur-md">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-700 border-t-transparent" />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-700/90">
            Restoring session
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
      return <ProductsPage />;
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
      return <SalesPage />;
    case "/users":
      return <UserManagementPage error={error} onRegister={register} user={user} />;
    default:
      return <NotFoundPage onNavigate={navigate} />;
  }
}
