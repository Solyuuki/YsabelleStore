import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { canRoleAccessRoute, getRouteByPath, type AppRoute, type AppRoutePath } from "@/app/routes";
import { LogoutConfirmationModal } from "@/components/shared/LogoutConfirmationModal";
import { AppLayout } from "@/layouts/AppLayout";
import { useAuth } from "@/context/AuthContext";
import { AccessDeniedPage } from "@/pages/AccessDeniedPage";
import { ReceiptPrintPage } from "@/pages/ReceiptPrintPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { WelcomePage } from "@/pages/WelcomePage";
import "@/styles/auth-brand.css";
import { wait } from "@/utils/timing";

const CustomerApp = lazy(() =>
  import("@/app/CustomerApp").then(({ CustomerApp }) => ({ default: CustomerApp }))
);
const DashboardPage = lazy(() =>
  import("@/pages/DashboardPage").then(({ DashboardPage }) => ({ default: DashboardPage }))
);
const ProductsPage = lazy(() =>
  import("@/pages/ProductsPage").then(({ ProductsPage }) => ({ default: ProductsPage }))
);
const InventoryPage = lazy(() =>
  import("@/pages/InventoryPage").then(({ InventoryPage }) => ({ default: InventoryPage }))
);
const ReceivingPage = lazy(() =>
  import("@/pages/ReceivingPage").then(({ ReceivingPage }) => ({ default: ReceivingPage }))
);
const PosPage = lazy(() =>
  import("@/pages/PosPage").then(({ PosPage }) => ({ default: PosPage }))
);
const SalesPage = lazy(() =>
  import("@/pages/SalesPage").then(({ SalesPage }) => ({ default: SalesPage }))
);
const ForecastPage = lazy(() =>
  import("@/pages/ForecastPage").then(({ ForecastPage }) => ({ default: ForecastPage }))
);
const HistoricalSalesPage = lazy(() =>
  import("@/pages/HistoricalSalesPage").then(({ HistoricalSalesPage }) => ({
    default: HistoricalSalesPage
  }))
);
const ReportsPage = lazy(() =>
  import("@/pages/ReportsPage").then(({ ReportsPage }) => ({ default: ReportsPage }))
);
const SettingsPage = lazy(() =>
  import("@/pages/SettingsPage").then(({ SettingsPage }) => ({ default: SettingsPage }))
);
const UserManagementPage = lazy(() =>
  import("@/pages/UserManagementPage").then(({ UserManagementPage }) => ({
    default: UserManagementPage
  }))
);

const LAUNCH_SPLASH_DELAY_MS = 250;
const LOGOUT_CONFIRMATION_MINIMUM_MS = 700;

const validRoutePaths = new Set<string>([
  "/dashboard",
  "/pos",
  "/products",
  "/inventory",
  "/receiving",
  "/sales",
  "/forecast",
  "/historical-sales",
  "/reports",
  "/users",
  "/settings",
  "/not-found"
]);

const internalRoutePaths = new Set<string>([...validRoutePaths, "/staff-login"]);

function getCurrentLocation() {
  return `${window.location.pathname || "/"}${window.location.search}${window.location.hash}`;
}

function getReceiptPrintRequest() {
  const url = new URL(window.location.href);

  if (url.searchParams.get("print") !== "receipt") {
    return null;
  }

  return {
    payload: url.searchParams.get("data"),
    requestId: url.searchParams.get("requestId")
  };
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
  const [location, setLocation] = useState(getCurrentLocation);
  const path = new URL(location, window.location.origin).pathname;
  const isCustomerRoute = !internalRoutePaths.has(path);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.innerWidth < 1280);
  const shouldHoldForAuth = !isCustomerRoute && !isAuthReady;
  const [showLaunchSplash, setShowLaunchSplash] = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [logoutSubmitting, setLogoutSubmitting] = useState(false);
  const logoutSubmittingRef = useRef(false);
  const receiptPrintRequest = getReceiptPrintRequest();

  useEffect(() => {
    const handlePopState = () => setLocation(getCurrentLocation());

    window.addEventListener("popstate", handlePopState);

    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = useCallback((nextPath: string) => {
    if (getCurrentLocation() !== nextPath) {
      window.history.pushState({}, "", nextPath);
    }

    setLocation(getCurrentLocation());
    const hash = new URL(nextPath, window.location.origin).hash;
    if (hash) {
      window.requestAnimationFrame(() => document.querySelector(hash)?.scrollIntoView());
    } else {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
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
    navigate("/staff-login");
  }, [logout, navigate]);

  useEffect(() => {
    if (!isAuthReady) {
      return;
    }

    if (status === "authenticated" && path === "/staff-login") {
      navigate("/dashboard");
    }

    if (status === "unauthenticated" && internalRoutePaths.has(path) && path !== "/staff-login") {
      navigate("/staff-login");
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

  if (receiptPrintRequest) {
    return (
      <ReceiptPrintPage
        payload={receiptPrintRequest.payload}
        requestId={receiptPrintRequest.requestId}
      />
    );
  }

  if (isCustomerRoute) {
    return (
      <Suspense fallback={<RouteLoadingFallback fullScreen label="Loading storefront..." />}>
        <CustomerApp location={location} navigate={navigate} />
      </Suspense>
    );
  }

  if (shouldHoldForAuth) {
    return showLaunchSplash ? <LaunchSplash /> : null;
  }

  if (status !== "authenticated" || path === "/staff-login") {
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
          <Suspense fallback={<RouteLoadingFallback label="Loading module..." />}>
            {renderRoute(path, routeForLayout, navigate, user, error, register)}
          </Suspense>
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
          <p className="type-label text-emerald-700/90">Restoring session</p>
          <p className="type-body-sm font-semibold text-slate-700">Opening YsabelleStore...</p>
        </div>
      </div>
    </main>
  );
}

function RouteLoadingFallback({ fullScreen = false, label }: { fullScreen?: boolean; label: string }) {
  return (
    <div
      className={`flex items-center justify-center ${fullScreen ? "min-h-screen" : "min-h-[45vh]"}`}
      role="status"
    >
      <div className="flex items-center gap-3 text-sm font-semibold text-slate-600">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
        {label}
      </div>
    </div>
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

  switch (route.path) {
    case "/dashboard":
      return <DashboardPage />;
    case "/pos":
      return <PosPage />;
    case "/products":
      return <ProductsPage />;
    case "/inventory":
      return <InventoryPage />;
    case "/receiving":
      return <ReceivingPage />;
    case "/sales":
      return <SalesPage />;
    case "/forecast":
      return <ForecastPage />;
    case "/historical-sales":
      return <HistoricalSalesPage />;
    case "/reports":
      return <ReportsPage />;
    case "/users":
      return <UserManagementPage error={error} onRegister={register} user={user} />;
    case "/settings":
      return <SettingsPage />;
    default:
      return <NotFoundPage onNavigate={navigate} />;
  }
}
