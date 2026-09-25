import { useEffect } from "react";

import { CheckCircle2, DatabaseZap, RefreshCw, ServerOff, WifiOff } from "lucide-react";

import { SystemStatusScreen } from "@/components/shared/SystemStatusScreen";
import { useSystemReliability } from "@/context/SystemReliabilityContext";

export function GlobalReliabilityUI() {
  const { healthState, httpStatus, lastHealthyAt, mode, recentlyRestored, retryNow } =
    useSystemReliability();

  useEffect(() => {
    const content = document.querySelector<HTMLElement>("[data-reliability-content]");

    if (!content) return;

    if (mode === "unavailable") {
      content.setAttribute("inert", "");
      content.setAttribute("aria-hidden", "true");
    } else {
      content.removeAttribute("inert");
      content.removeAttribute("aria-hidden");
    }

    return () => {
      content.removeAttribute("inert");
      content.removeAttribute("aria-hidden");
    };
  }, [mode]);

  if (recentlyRestored) {
    return (
      <div
        aria-live="polite"
        className="reliability-banner reliability-banner--restored"
        role="status"
      >
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
        <span>Connection restored. Ysabelle Store is ready.</span>
      </div>
    );
  }

  if (mode === "checking") {
    return (
      <div
        aria-live="polite"
        className="reliability-banner reliability-banner--reconnecting"
        role="status"
      >
        <span className="reliability-signal" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span>Checking Ysabelle Store system readiness&hellip;</span>
      </div>
    );
  }

  if (mode === "reconnecting") {
    return (
      <div
        aria-live="assertive"
        className="reliability-banner reliability-banner--reconnecting"
        role="status"
      >
        <span className="reliability-signal" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span>Connection interrupted. Reconnecting to Ysabelle Store&hellip;</span>
      </div>
    );
  }

  if (mode === "degraded") {
    return (
      <div
        aria-live="polite"
        className="reliability-banner reliability-banner--degraded"
        role="status"
      >
        <DatabaseZap className="h-4 w-4" aria-hidden="true" />
        <span>
          System readiness is degraded. Changes are temporarily paused while we verify services.
        </span>
        <button
          className="reliability-banner__action"
          onClick={() => void retryNow()}
          type="button"
        >
          Check again
        </button>
      </div>
    );
  }

  if (mode !== "unavailable") {
    return null;
  }

  const presentation = getUnavailablePresentation(healthState);

  return (
    <SystemStatusScreen
      code={httpStatus === 503 ? "503" : undefined}
      eyebrow={presentation.eyebrow}
      icon={presentation.Icon}
      message={presentation.message}
      modal
      noteMessage="Checkout, POS, inventory changes, receiving, and other write actions are paused until the system is healthy again. Existing data on this screen has not been submitted."
      noteTitle="Transaction protection is active"
      primaryAction={{
        icon: RefreshCw,
        label: "Try connection again",
        onClick: () => void retryNow()
      }}
      statusMeta={
        lastHealthyAt
          ? `Last healthy connection ${formatLastHealthy(lastHealthyAt)}`
          : "Waiting for the first healthy connection"
      }
      title={presentation.title}
    />
  );
}

function getUnavailablePresentation(
  healthState: ReturnType<typeof useSystemReliability>["healthState"]
) {
  if (healthState === "offline") {
    return {
      Icon: WifiOff,
      eyebrow: "Network status",
      message:
        "This device appears to be offline. Reconnect to the network and Ysabelle Store will verify the backend automatically.",
      title: "You are offline"
    };
  }

  if (healthState === "database-unavailable") {
    return {
      Icon: DatabaseZap,
      eyebrow: "System safety mode",
      message:
        "The application is running, but the database is not ready. Store-changing actions are paused to protect inventory and transaction integrity.",
      title: "Database temporarily unavailable"
    };
  }

  if (healthState === "timeout") {
    return {
      Icon: ServerOff,
      eyebrow: "Connection timeout",
      message:
        "The backend did not respond within the expected time. Ysabelle Store will keep checking and recover automatically when service returns.",
      title: "Store service is taking too long"
    };
  }

  return {
    Icon: ServerOff,
    eyebrow: "Service availability",
    message:
      "We cannot reach the Ysabelle Store backend right now. The application is preserving your current screen while it safely reconnects.",
    title: "Store service temporarily unavailable"
  };
}

function formatLastHealthy(value: Date) {
  return new Intl.DateTimeFormat("en-PH", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit"
  }).format(value);
}
