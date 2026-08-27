import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  MailCheck,
  ShieldCheck
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";

import { CustomerAuthFrame } from "@/components/customer/CustomerAuthFrame";
import { CustomerLink } from "@/components/customer/CustomerLink";
import {
  requestCustomerPasswordRecovery,
  resetCustomerPassword
} from "@/services/customerAuthService";
import "@/styles/customer-auth-recovery.css";

type RecoveryStage = "identify" | "email-sent" | "reset" | "complete";

function errorMessage(reason: unknown, fallback: string) {
  return reason instanceof Error && reason.message ? reason.message : fallback;
}

export function CustomerAccountRecoveryPage({
  location,
  navigate
}: {
  location: string;
  navigate: (path: string) => void;
}) {
  const recoveryToken = useMemo(() => {
    try {
      return new URL(location, window.location.origin).searchParams.get("token")?.trim() ?? "";
    } catch {
      return "";
    }
  }, [location]);

  const [stage, setStage] = useState<RecoveryStage>(recoveryToken ? "reset" : "identify");
  const [identifier, setIdentifier] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRecoveryRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const normalizedIdentifier = identifier.trim();
    if (!normalizedIdentifier) {
      setError("Enter your username, email, or mobile number.");
      return;
    }

    setSubmitting(true);
    try {
      await requestCustomerPasswordRecovery(normalizedIdentifier);
      setStage("email-sent");
    } catch (reason) {
      setError(errorMessage(reason, "Recovery instructions could not be requested right now."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!recoveryToken) {
      setError("This recovery link is invalid or expired. Request a new one.");
      return;
    }
    if (newPassword.length < 8 || newPassword.length > 128) {
      setError("New password must be between 8 and 128 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    setSubmitting(true);
    try {
      await resetCustomerPassword({ token: recoveryToken, newPassword });
      setNewPassword("");
      setConfirmPassword("");
      setStage("complete");
    } catch (reason) {
      setError(
        errorMessage(reason, "This recovery link is invalid or expired. Request a new one.")
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <CustomerAuthFrame mode="recovery" navigate={navigate}>
      <div className="customer-auth-card customer-recovery-card">
        <div className="customer-auth-card__intro customer-recovery-intro">
          <span className="customer-auth-card__icon customer-recovery-icon" aria-hidden="true">
            {stage === "email-sent" ? (
              <MailCheck size={22} />
            ) : stage === "complete" ? (
              <CheckCircle2 size={22} />
            ) : stage === "reset" ? (
              <KeyRound size={22} />
            ) : (
              <ShieldCheck size={22} />
            )}
          </span>
          <p className="customer-eyebrow">Secure account recovery</p>
          {stage === "identify" ? (
            <>
              <h1>Recover your account</h1>
              <p>Enter the username, email, or mobile number connected to your customer account.</p>
            </>
          ) : stage === "email-sent" ? (
            <>
              <h1>Check your email</h1>
              <p>
                If an eligible account exists, we sent a secure recovery link to its registered
                email. The link expires in 15 minutes.
              </p>
            </>
          ) : stage === "reset" ? (
            <>
              <h1>Set a new password</h1>
              <p>Choose a new password for your Ysabelle Store customer account.</p>
            </>
          ) : (
            <>
              <h1>Password reset complete</h1>
              <p>Your old sessions were ended. Sign in again using your new password.</p>
            </>
          )}
        </div>

        {error ? (
          <div className="customer-auth-alert customer-recovery-alert" role="alert">
            {error}
          </div>
        ) : null}

        {stage === "identify" ? (
          <form
            aria-busy={submitting}
            className="customer-auth-form customer-recovery-form"
            onSubmit={(event) => void handleRecoveryRequest(event)}
            noValidate
          >
            <label className="customer-auth-field" htmlFor="customer-recovery-identifier">
              <span>Username, email or mobile number</span>
              <input
                aria-invalid={Boolean(error)}
                autoComplete="username"
                id="customer-recovery-identifier"
                onChange={(event) => setIdentifier(event.target.value)}
                placeholder="Username, email, or 09XXXXXXXXX"
                type="text"
                value={identifier}
              />
            </label>
            <button className="customer-auth-submit" disabled={submitting} type="submit">
              {submitting ? "Sending secure link..." : "Send recovery link"}
            </button>
          </form>
        ) : null}

        {stage === "email-sent" ? (
          <div className="customer-recovery-status" role="status">
            <MailCheck size={20} aria-hidden="true" />
            <div>
              <strong>Recovery request received</strong>
              <span>
                For privacy, this confirmation is the same whether or not an account matches your
                entry.
              </span>
            </div>
          </div>
        ) : null}

        {stage === "reset" ? (
          <form
            aria-busy={submitting}
            className="customer-auth-form customer-recovery-form"
            onSubmit={(event) => void handlePasswordReset(event)}
            noValidate
          >
            <label className="customer-auth-field" htmlFor="customer-recovery-new-password">
              <span>New password</span>
              <span className="customer-auth-password">
                <input
                  aria-invalid={Boolean(error)}
                  autoComplete="new-password"
                  id="customer-recovery-new-password"
                  maxLength={128}
                  minLength={8}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="Create a secure password"
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                />
                <button
                  aria-label={showPassword ? "Hide new password" : "Show new password"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((current) => !current)}
                  type="button"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </label>

            <label className="customer-auth-field" htmlFor="customer-recovery-confirm-password">
              <span>Confirm new password</span>
              <span className="customer-auth-password">
                <input
                  aria-invalid={Boolean(error)}
                  autoComplete="new-password"
                  id="customer-recovery-confirm-password"
                  maxLength={128}
                  minLength={8}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Re-enter your new password"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                />
                <button
                  aria-label={showConfirmPassword ? "Hide confirmation" : "Show confirmation"}
                  aria-pressed={showConfirmPassword}
                  onClick={() => setShowConfirmPassword((current) => !current)}
                  type="button"
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </label>

            <button className="customer-auth-submit" disabled={submitting} type="submit">
              {submitting ? "Securing account..." : "Reset password"}
            </button>
          </form>
        ) : null}

        {stage === "complete" ? (
          <div className="customer-recovery-status customer-recovery-status--success" role="status">
            <CheckCircle2 size={20} aria-hidden="true" />
            <div>
              <strong>Your account is secured</strong>
              <span>All previous customer sessions have been signed out.</span>
            </div>
          </div>
        ) : null}

        <div className="customer-recovery-actions">
          {stage === "email-sent" ? (
            <button
              className="customer-recovery-secondary"
              onClick={() => {
                setError(null);
                setStage("identify");
              }}
              type="button"
            >
              Try another identifier
            </button>
          ) : null}

          <CustomerLink className="customer-recovery-back" href="/login" navigate={navigate}>
            <ArrowLeft size={16} aria-hidden="true" />
            {stage === "complete" ? "Sign in with new password" : "Back to sign in"}
          </CustomerLink>
        </div>
      </div>
    </CustomerAuthFrame>
  );
}
