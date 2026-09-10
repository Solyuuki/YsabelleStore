import { LoaderCircle, LogOut, ShieldCheck, TriangleAlert } from "lucide-react";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";

type LogoutConfirmationModalProps = {
  isLoggingOut: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function LogoutConfirmationModal({
  isLoggingOut,
  onCancel,
  onConfirm
}: LogoutConfirmationModalProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousActiveElement = document.activeElement;
    cancelButtonRef.current?.focus();

    return () => {
      if (previousActiveElement instanceof HTMLElement) {
        previousActiveElement.focus();
      }
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isLoggingOut) {
        event.preventDefault();
        onCancel();
        return;
      }

      if (event.key === "Tab") {
        const focusableButtons: HTMLButtonElement[] = [];

        if (cancelButtonRef.current && !cancelButtonRef.current.disabled) {
          focusableButtons.push(cancelButtonRef.current);
        }

        if (confirmButtonRef.current && !confirmButtonRef.current.disabled) {
          focusableButtons.push(confirmButtonRef.current);
        }

        if (focusableButtons.length === 0) {
          event.preventDefault();
          return;
        }

        const firstButton = focusableButtons[0] as HTMLButtonElement;
        const lastButton = focusableButtons[focusableButtons.length - 1] as HTMLButtonElement;

        if (event.shiftKey && document.activeElement === firstButton) {
          event.preventDefault();
          lastButton.focus();
        }

        if (!event.shiftKey && document.activeElement === lastButton) {
          event.preventDefault();
          firstButton.focus();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isLoggingOut, onCancel]);

  return (
    <div
      aria-labelledby="logout-confirmation-title"
      aria-modal="true"
      className="logout-modal-enter fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-6 py-8 backdrop-blur-sm"
      role="dialog"
    >
      <div className="w-[min(92vw,600px)] overflow-hidden rounded-xl border border-indigo-100 bg-white/95 text-slate-950 shadow-[0_28px_90px_rgba(30,41,59,0.26)] backdrop-blur-xl">
        <div className="flex items-start gap-5 border-b border-slate-100 px-7 py-6">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-amber-700"
            aria-hidden="true"
          >
            <TriangleAlert className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 id="logout-confirmation-title" className="type-h4 text-slate-950">
              End current session?
            </h2>
            <p className="type-body-sm mt-2.5 text-slate-600">
              You are about to sign out of YsabelleStore. Your autosaved changes and local workspace
              activity will remain available when you sign in again.
            </p>
          </div>
        </div>

        <div className="px-7 py-5">
          <div className="flex items-center gap-3.5 rounded-lg border border-indigo-200 bg-indigo-50/80 px-4 py-3.5 text-sm leading-6 text-indigo-800 shadow-[0_8px_24px_rgba(98,91,255,0.07)]">
            <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              {isLoggingOut
                ? "Checking autosaved changes before signing out."
                : "Your trusted device and remembered account stay available."}
            </span>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50/55 px-7 py-5">
          <Button
            className="h-11 px-4"
            disabled={isLoggingOut}
            onClick={onCancel}
            ref={cancelButtonRef}
            type="button"
            variant="secondary"
          >
            Cancel
          </Button>
          <Button
            className="h-11 border-0 bg-gradient-to-r from-rose-500 via-fuchsia-500 to-fuchsia-600 px-4 text-white shadow-[0_10px_26px_rgba(217,70,239,0.2)] hover:from-rose-600 hover:via-fuchsia-600 hover:to-fuchsia-700"
            disabled={isLoggingOut}
            onClick={onConfirm}
            ref={confirmButtonRef}
            type="button"
          >
            {isLoggingOut ? (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <LogOut className="h-4 w-4" aria-hidden="true" />
            )}
            {isLoggingOut ? "Securing session..." : "Yes, sign out"}
          </Button>
        </div>
      </div>
    </div>
  );
}
