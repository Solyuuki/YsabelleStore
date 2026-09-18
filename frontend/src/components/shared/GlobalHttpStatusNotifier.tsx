import { useEffect } from "react";

import { useToast } from "@/components/shared/ToastProvider";
import type { HttpErrorEventDetail } from "@/services/apiClient";
import { resolveHttpStatusUi } from "@/services/httpStatusUi";

const GLOBAL_NOTICE_STATUSES = new Set([405, 409, 413, 415, 429, 500, 502, 504]);

export function GlobalHttpStatusNotifier() {
  const { pushToast } = useToast();

  useEffect(() => {
    const handleHttpError = (event: Event) => {
      const detail = (event as CustomEvent<HttpErrorEventDetail>).detail;

      if (!detail || detail.status === undefined || !GLOBAL_NOTICE_STATUSES.has(detail.status)) {
        return;
      }

      const presentation = resolveHttpStatusUi(detail.status, {
        message: detail.message,
        retryAfterSeconds: detail.retryAfterSeconds
      });

      pushToast({
        durationMs: detail.status === 429 ? 6_500 : 5_000,
        message: presentation.message,
        scope: `http-status-${detail.status}`,
        title: presentation.title,
        variant: presentation.severity
      });
    };

    window.addEventListener("ysabelle:http-error", handleHttpError);

    return () => {
      window.removeEventListener("ysabelle:http-error", handleHttpError);
    };
  }, [pushToast]);

  return null;
}
