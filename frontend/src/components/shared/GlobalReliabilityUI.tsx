import {
  CheckCircle2,
  DatabaseZap,
  RefreshCw,
  ServerOff,
  WifiOff
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useSystemReliability } from "@/context/SystemReliabilityContext";

export function GlobalReliabilityUI() {
  const { healthState, lastHealthyAt, mode, recentlyRestored, retryNow } =
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
        <span>
          Connection interrupted. Reconnecting to Ysabelle Store&hellip;
        </span>
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
        <button className="reliability-banner__action" onClick={() => void retryNow()} type="button">
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
    <div
      aria-describedby="system-unavailable-description"
      aria-labelledby="system-unavailable-title"
      aria-live="assertive"
      className="reliability-overlay"
      role="alertdialog"
    >
      <div className="reliability-grid" aria-hidden="true" />
      <div className="reliability-orb reliability-orb--one" aria-hidden="true" />
      <div className="reliability-orb reliability-orb--two" aria-hidden="true" />

      <section className="reliability-card">
        <div className="reliability-card__beam" aria-hidden="true" />

        <div className="reliability-status-visual" aria-hidden="true">
          <span className="reliability-ring reliability-ring--outer" />
          <span className="reliability-ring reliability-ring--inner" />
          <span className="reliability-status-visual__icon">
            <presentation.Icon className="h-8 w-8" />
          </span>
        </div>

        <div className="reliability-card__content">
          <div className="reliability-eyebrow">
            <span className="reliability-eyebrow__dot" aria-hidden="true" />
            System safety mode
          </div>

          <h1 className="type-h1 text-slate-950" id="system-unavailable-title">
            {presentation.title}
          </h1>

          <p
            className="type-body-lg type-readable text-slate-600"
            id="system-unavailable-description"
          >
            {presentation.message}
          </p>

          <div className="reliability-safety-note">
            <span className="reliability-safety-note__indicator" aria-hidden="true" />
            <div>
              <p className="font-semibold text-slate-900">Transaction protection is active</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Checkout, POS, inventory changes, receiving, and other write actions are paused
                until the system is healthy again. Existing data on this screen has not been
                submitted.
              </p>
            </div>
          </div>

          <div className="reliability-card__actions">
            <Button onClick={() => void retryNow()} type="button">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Try connection again
            </Button>
            <span className="text-xs text-slate-500">
              {lastHealthyAt
                ? `Last healthy connection ${formatLastHealthy(lastHealthyAt)}`
                : "Waiting for the first healthy connection"}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}

function getUnavailablePresentation(healthState: ReturnType<typeof useSystemReliability>["healthState"]) {
  if (healthState === "offline") {
    return {
      Icon: WifiOff,
      message:
        "This device appears to be offline. Reconnect to the network and Ysabelle Store will verify the backend automatically.",
      title: "You are offline"
    };
  }

  if (healthState === "database-unavailable") {
    return {
      Icon: DatabaseZap,
      message:
        "The application is running, but the database is not ready. Store-changing actions are paused to protect inventory and transaction integrity.",
      title: "Database temporarily unavailable"
    };
  }

  if (healthState === "timeout") {
    return {
      Icon: ServerOff,
      message:
        "The backend did not respond within the expected time. Ysabelle Store will keep checking and recover automatically when service returns.",
      title: "Store service is taking too long"
    };
  }

  return {
    Icon: ServerOff,
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
