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
    (id: string, durationMs: number) => {
      const existingTimeout = timersRef.current[id];

      if (existingTimeout) {
        window.clearTimeout(existingTimeout);
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
          currentToast.variant === toast.variant
      );
      const id = createToastId();
      const durationMs = toast.durationMs ?? DEFAULT_TOAST_DURATION_MS;
      const nextToast: ToastItem = {
        closing: false,
        durationMs,
        id,
        message: toast.message,
        title: toast.title,
        variant: toast.variant
      };

      if (matchingToast) {
        setToasts((currentToasts) =>
          currentToasts.map((currentToast) =>
            currentToast.id === matchingToast.id ? { ...currentToast, ...nextToast } : currentToast
          )
        );
        restartToastTimer(matchingToast.id, durationMs);
        return matchingToast.id;
      }

      setToasts((currentToasts) => [nextToast, ...currentToasts]);
      restartToastTimer(id, durationMs);

      return id;
    },
    [dismissToast, restartToastTimer, toasts]
  );

  const clearToasts = useCallback(() => {
    setToasts([]);

    Object.values(timersRef.current).forEach((timeoutId) => {
      window.clearTimeout(timeoutId);
    });

    timersRef.current = {};
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
      clearToasts,
      dismissToast,
      pushToast,
      toasts
    }),
    [clearToasts, dismissToast, pushToast, toasts]
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
