import { ArrowLeft, KeyRound, LogIn } from "lucide-react";

import { SystemStatusScreen } from "@/components/shared/SystemStatusScreen";

type SessionRequiredPageProps = {
  audience?: "customer" | "staff";
  onBack?: () => void;
  onSignIn: () => void;
};

export function SessionRequiredPage({
  audience = "staff",
  onBack,
  onSignIn
}: SessionRequiredPageProps) {
  const customer = audience === "customer";

  return (
    <SystemStatusScreen
      code="401"
      eyebrow="Authentication"
      icon={KeyRound}
      message={
        customer
          ? "Your customer session is missing or has expired. Sign in again to continue to this protected store area."
          : "Your store session is missing or has expired. Sign in again before opening protected operational modules."
      }
      noteMessage={
        customer
          ? "No checkout, account, or order-changing action was submitted while authentication was unavailable."
          : "No protected inventory, POS, receiving, reporting, or administration action was submitted without an authenticated session."
      }
      noteTitle="Protected access is active"
      primaryAction={{
        icon: LogIn,
        label: "Sign in again",
        onClick: onSignIn
      }}
      secondaryAction={
        onBack
          ? {
              icon: ArrowLeft,
              label: customer ? "Back to store" : "Go back",
              onClick: onBack,
              variant: "secondary"
            }
          : undefined
      }
      statusMeta="HTTP 401 · authentication required"
      title="Sign in required"
    />
  );
}
