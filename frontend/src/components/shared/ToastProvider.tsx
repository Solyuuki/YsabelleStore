import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import type { ReactNode } from "react";

import type { ToastInput, ToastItem } from "@/components/shared/toast.types";

type ToastContextValue = {
  clearToastScope: (scope: string) => void;
  clearToasts: () => void;
  dismissToast: (id: string) => void;
  pushToast: (toast: ToastInput) => string;
  toasts: ToastItem[];
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const DEFAULT_TOAST_DURATION_MS = 3800;
const TOAST_EXIT_DURATION_MS = 220;

let toastSequence = 0;

function createToastId() {
  toastSequence += 1;
  return `toast-${toastSequence}`;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Record<string, number>>({});

  const dismissToast = useCallback((id: string) => {
    let shouldScheduleRemoval = true;

    setToasts((currentToasts) =>
      currentToasts.map((toast) => {
        if (toast.id !== id) {
          return toast;
        }

        if (toast.closing) {
          shouldScheduleRemoval = false;
          return toast;
        }

        return { ...toast, closing: true };
      })
    );

    if (!shouldScheduleRemoval) {
      return;
    }

    const existingTimeout = timersRef.current[id];

    if (existingTimeout) {
      window.clearTimeout(existingTimeout);
    }

    timersRef.current[id] = window.setTimeout(() => {
      setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== id));
      delete timersRef.current[id];
    }, TOAST_EXIT_DURATION_MS);
  }, []);

  const restartToastTimer = useCallback(
    (toast: ToastItem) => {
      const { durationMs, id, persistent } = toast;
      const existingTimeout = timersRef.current[id];

      if (existingTimeout) {
        window.clearTimeout(existingTimeout);
        delete timersRef.current[id];
      }

      if (persistent) {
        return;
      }

      timersRef.current[id] = window.setTimeout(() => dismissToast(id), durationMs);
    },
    [dismissToast]
  );

  const pushToast = useCallback(
    (toast: ToastInput) => {
      const matchingToast = toasts.find(
        (currentToast) =>
          currentToast.title === toast.title &&
          currentToast.message === toast.message &&
          currentToast.variant === toast.variant &&
          currentToast.scope === toast.scope
      );
      const id = createToastId();
      const durationMs = toast.durationMs ?? DEFAULT_TOAST_DURATION_MS;
      const nextToast: ToastItem = {
        closing: false,
        createdAt: Date.now(),
        durationMs,
        id,
        message: toast.message,
        persistent: toast.persistent,
        scope: toast.scope,
        title: toast.title,
        variant: toast.variant
      };

      if (matchingToast) {
        const refreshedToast = {
          ...nextToast,
          id: matchingToast.id
        };

        setToasts((currentToasts) =>
          currentToasts.map((currentToast) =>
            currentToast.id === matchingToast.id ? refreshedToast : currentToast
          )
        );
        restartToastTimer(refreshedToast);
        return matchingToast.id;
      }

      setToasts((currentToasts) => [nextToast, ...currentToasts]);
      restartToastTimer(nextToast);

      return id;
    },
    [restartToastTimer, toasts]
  );

  const clearToasts = useCallback(() => {
    setToasts([]);

    Object.values(timersRef.current).forEach((timeoutId) => {
      window.clearTimeout(timeoutId);
    });

    timersRef.current = {};
  }, []);

  const clearToastScope = useCallback((scope: string) => {
    setToasts((currentToasts) => {
      const toastIdsToClear = currentToasts
        .filter((toast) => toast.scope === scope)
        .map((toast) => toast.id);

      toastIdsToClear.forEach((toastId) => {
        const existingTimeout = timersRef.current[toastId];

        if (existingTimeout) {
          window.clearTimeout(existingTimeout);
          delete timersRef.current[toastId];
        }
      });

      return currentToasts.filter((toast) => toast.scope !== scope);
    });
  }, []);

  useEffect(
    () => () => {
      Object.values(timersRef.current).forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
    },
    []
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      clearToastScope,
      clearToasts,
      dismissToast,
      pushToast,
      toasts
    }),
    [clearToastScope, clearToasts, dismissToast, pushToast, toasts]
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within ToastProvider.");
  }

  return context;
}
