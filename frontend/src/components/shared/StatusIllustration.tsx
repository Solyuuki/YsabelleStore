import authIllustration from "@/assets/status/401-login.svg";
import permissionIllustration from "@/assets/status/403-security.svg";
import notFoundIllustration from "@/assets/status/404-lost.svg";
import serviceIllustration from "@/assets/status/503-maintenance.svg";
import backendIllustration from "@/assets/status/service-unavailable.svg";
import databaseIllustration from "@/assets/status/database-unavailable.svg";
import offlineIllustration from "@/assets/status/offline.svg";
import timeoutIllustration from "@/assets/status/timeout.svg";

type StatusIllustrationProps = {
  statusLabel: string;
  variant: "auth" | "navigation" | "system";
};

const STATUS_ILLUSTRATIONS: Record<string, string> = {
  "401": authIllustration,
  "403": permissionIllustration,
  "404": notFoundIllustration,
  "503": serviceIllustration,
  DATABASE: databaseIllustration,
  OFFLINE: offlineIllustration,
  SERVICE: backendIllustration,
  TIMEOUT: timeoutIllustration
};

export function StatusIllustration({ statusLabel, variant }: StatusIllustrationProps) {
  const source = STATUS_ILLUSTRATIONS[statusLabel] ?? backendIllustration;

  return (
    <div
      aria-hidden="true"
      className="status-illustration"
      data-status-family={variant}
      data-status-illustration={statusLabel.toLowerCase()}
    >
      <span className="status-illustration__halo" />
      <img
        alt=""
        className="status-illustration__image"
        decoding="async"
        draggable={false}
        loading="eager"
        src={source}
      />
    </div>
  );
}
