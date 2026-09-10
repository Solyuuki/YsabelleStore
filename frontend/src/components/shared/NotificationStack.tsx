import { useToast } from "@/components/shared/ToastProvider";
import { Toast } from "@/components/shared/Toast";
import { isInternalAppRoutePath } from "@/utils/internalAuthRoutes";

export function NotificationStack() {
  const { dismissToast, toasts } = useToast();
  const isInternalRoute = isInternalAppRoutePath(window.location.pathname);
  const visibleToasts = isInternalRoute ? toasts : toasts.filter((toast) => toast.scope !== "auth");

  if (visibleToasts.length === 0) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      aria-relevant="additions removals"
      className="pointer-events-none fixed right-4 top-4 z-[90] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3 sm:right-6 sm:top-6"
    >
      {visibleToasts.map((toast) => (
        <Toast key={toast.id} onDismiss={dismissToast} toast={toast} />
      ))}
    </div>
  );
}
