import { useEffect, useState } from "react";
import { KeyRound, LogIn } from "lucide-react";

import { StatusScreen } from "@/components/shared/StatusScreen";
import type { HttpErrorEventDetail } from "@/services/apiClient";
import { buildCustomerAuthPath, isCustomerProtectedRoute } from "@/utils/customerRoutes";
import { isInternalAppRoutePath } from "@/utils/internalAuthRoutes";

export function GlobalAuthenticationStatusScreen() {
  const [unauthorized, setUnauthorized] = useState<HttpErrorEventDetail | null>(null);

  useEffect(() => {
    const handleHttpError = (event: Event) => {
      const detail = (event as CustomEvent<HttpErrorEventDetail>).detail;

      if (!detail || !shouldPresentUnauthorized(detail, window.location.pathname)) {
        return;
      }

      setUnauthorized(detail);
    };

    const clearOnNavigation = () => setUnauthorized(null);

    window.addEventListener("ysabelle:http-error", handleHttpError);
    window.addEventListener("popstate", clearOnNavigation);

    return () => {
      window.removeEventListener("ysabelle:http-error", handleHttpError);
      window.removeEventListener("popstate", clearOnNavigation);
    };
  }, []);

  if (!unauthorized) {
    return null;
  }

  const currentLocation = window.location.pathname + window.location.search + window.location.hash;
  const internalRoute = isInternalAppRoutePath(window.location.pathname);
  const signInPath = internalRoute
    ? "/staff-login"
    : buildCustomerAuthPath("/login", currentLocation);

  return (
    <StatusScreen
      critical
      description="Your session ended before this protected request could continue. Sign in again to return to Ysabelle Store."
      eyebrow="Authentication required"
      icon={KeyRound}
      primaryAction={{
        icon: <LogIn className="h-4 w-4" aria-hidden="true" />,
        label: "Sign in again",
        onClick: () => window.location.assign(signInPath)
      }}
      statusLabel="401"
      title="Your session has expired"
      variant="auth"
    />
  );
}

function shouldPresentUnauthorized(detail: HttpErrorEventDetail, pathname: string) {
  if (detail.status !== 401) {
    return false;
  }

  if (detail.hadAuthorization) {
    return true;
  }

  return isCustomerProtectedRoute(pathname);
}
