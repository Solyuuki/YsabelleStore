import { CheckCircle2, DatabaseZap, RefreshCw } from "lucide-react";

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
      eyebrow={presentation.eyebrow}
      footer={
        lastHealthyAt
          ? "Last healthy connection " + formatLastHealthy(lastHealthyAt)
          : "Waiting for the first healthy connection"
      }
      noteDescription="Checkout, POS, inventory, receiving, and other store-changing actions remain paused until system readiness is restored."
      noteTitle="Writes are temporarily paused"
      primaryAction={{
        icon: <RefreshCw className="h-4 w-4" aria-hidden="true" />,
        label: "Check connection",
        onClick: () => void retryNow()
      }}
      statusLabel={presentation.statusLabel}
      title={presentation.title}
      variant="system"
    />
  );
}

function getUnavailablePresentation(
  healthState: ReturnType<typeof useSystemReliability>["healthState"],
  lastHttpStatus: number | null
) {
  if (healthState === "offline") {
    return {
      eyebrow: "Connectivity status",
      message:
        "This device appears to be offline. Reconnect to the network and Ysabelle Store will verify services automatically.",
      statusLabel: "OFFLINE",
      title: "You’re offline"
    };
  }

  if (healthState === "database-unavailable") {
    return {
      eyebrow: "Data service status",
      message:
        "The application is available, but the database is not ready. Store-changing actions will resume after readiness is verified.",
      statusLabel: "DATABASE",
      title: "Database temporarily unavailable"
    };
  }

  if (healthState === "timeout") {
    return {
      eyebrow: "Service response status",
      message:
        "The backend did not respond within the expected time. Ysabelle Store will continue checking for recovery.",
      statusLabel: "TIMEOUT",
      title: "The service is taking too long"
    };
  }

  return {
    eyebrow: lastHttpStatus === 503 ? "Service availability" : "Connectivity status",
    message:
      lastHttpStatus === 503
        ? "Ysabelle Store is temporarily unable to handle requests. Please try again after the readiness check completes."
        : "The frontend is running, but the Ysabelle Store backend cannot be reached right now.",
    statusLabel: lastHttpStatus === 503 ? "503" : "SERVICE",
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
