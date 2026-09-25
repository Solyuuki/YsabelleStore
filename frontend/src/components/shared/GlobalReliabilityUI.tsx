import { CheckCircle2, DatabaseZap, RefreshCw, ServerOff, WifiOff } from "lucide-react";

import { StatusScreen } from "@/components/shared/StatusScreen";
import { useSystemReliability } from "@/context/SystemReliabilityContext";

export function GlobalReliabilityUI() {
  const { healthState, lastHealthyAt, lastHttpStatus, mode, recentlyRestored, retryNow } =
    useSystemReliability();

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

  const presentation = getUnavailablePresentation(healthState, lastHttpStatus);

  return (
    <StatusScreen
      critical
      description={presentation.message}
      eyebrow="System safety mode"
      footer={
        lastHealthyAt
          ? "Last healthy connection " + formatLastHealthy(lastHealthyAt)
          : "Waiting for the first healthy connection"
      }
      icon={presentation.Icon}
      noteDescription="Checkout, POS, inventory changes, receiving, and other write actions are paused until the system is healthy again. Existing data on this screen has not been submitted."
      noteTitle="Transaction protection is active"
      primaryAction={{
        icon: <RefreshCw className="h-4 w-4" aria-hidden="true" />,
        label: "Try connection again",
        onClick: () => void retryNow()
      }}
      statusLabel={presentation.statusLabel}
      title={presentation.title}
    />
  );
}

function getUnavailablePresentation(
  healthState: ReturnType<typeof useSystemReliability>["healthState"],
  lastHttpStatus: number | null
) {
  if (healthState === "offline") {
    return {
      Icon: WifiOff,
      message:
        "This device appears to be offline. Reconnect to the network and Ysabelle Store will verify the backend automatically.",
      statusLabel: "OFFLINE",
      title: "You are offline"
    };
  }

  if (healthState === "database-unavailable") {
    return {
      Icon: DatabaseZap,
      message:
        "The application is running, but the database is not ready. Store-changing actions are paused to protect inventory and transaction integrity.",
      statusLabel: "DATABASE",
      title: "Database temporarily unavailable"
    };
  }

  if (healthState === "timeout") {
    return {
      Icon: ServerOff,
      message:
        "The backend did not respond within the expected time. Ysabelle Store will keep checking and recover automatically when service returns.",
      statusLabel: "TIMEOUT",
      title: "Store service is taking too long"
    };
  }

  return {
    Icon: ServerOff,
    message:
      lastHttpStatus === 503
        ? "The Ysabelle Store service is temporarily unable to handle requests. Your current screen is preserved while readiness is rechecked."
        : "We cannot reach the Ysabelle Store backend right now. The application is preserving your current screen while it safely reconnects.",
    statusLabel: lastHttpStatus === 503 ? "HTTP 503" : "SERVICE",
    title:
      lastHttpStatus === 503
        ? "Service temporarily unavailable"
        : "Store service temporarily unavailable"
  };
}

function formatLastHealthy(value: Date) {
  return new Intl.DateTimeFormat("en-PH", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit"
  }).format(value);
}
