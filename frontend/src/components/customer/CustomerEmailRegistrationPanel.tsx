import { ArrowLeft, Mail } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import {
  requestCustomerRegistrationEmailVerification,
  verifyCustomerRegistrationEmailVerification
} from "@/services/customerAuthService";

const EMAIL_OTP_RESEND_SECONDS = 30;

export function CustomerEmailRegistrationPanel({
  initialEmail = "",
  onCancel,
  onVerified
}: {
  initialEmail?: string;
  onCancel: () => void;
  onVerified: (email: string) => Promise<void> | void;
}) {
  const [stage, setStage] = useState<"email" | "code">("email");
  const [email, setEmail] = useState(initialEmail.trim());
  const [verificationCode, setVerificationCode] = useState("");
  const [resendSeconds, setResendSeconds] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (stage !== "code" || resendSeconds <= 0) return;
    const timeout = globalThis.setTimeout(() => {
      setResendSeconds((current) => Math.max(0, current - 1));
    }, 1000);
    return () => globalThis.clearTimeout(timeout);
  }, [resendSeconds, stage]);

  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }

    setSubmitting(true);
    try {
      await requestCustomerRegistrationEmailVerification(email);
      setVerificationCode("");
      setResendSeconds(EMAIL_OTP_RESEND_SECONDS);
      setStage("code");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to request a verification code. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCodeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!/^\d{6}$/.test(verificationCode.trim())) {
      setError("Enter the 6-digit verification code.");
      return;
    }

    setSubmitting(true);
    try {
      await verifyCustomerRegistrationEmailVerification({ email, verificationCode });
      await onVerified(email.trim());
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to verify the code. Please request a new code and try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    if (submitting || resendSeconds > 0) return;
    setError(null);
    setSubmitting(true);
    try {
      await requestCustomerRegistrationEmailVerification(email);
      setVerificationCode("");
      setResendSeconds(EMAIL_OTP_RESEND_SECONDS);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to resend the code.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="customer-mobile-auth" aria-label="Email OTP registration verification">
      <div className="customer-mobile-auth__heading">
        <span className="customer-mobile-auth__icon" aria-hidden="true">
          <Mail size={18} />
        </span>
        <div>
          <strong>{stage === "email" ? "Email sign-up" : "Enter code"}</strong>
          {stage === "code" ? <p className="customer-mobile-auth__meta">Sent to {email}</p> : null}
        </div>
      </div>

      {error ? <div className="customer-auth-alert" role="alert">{error}</div> : null}

      {stage === "email" ? (
        <form className="customer-mobile-auth__form" onSubmit={handleEmailSubmit} noValidate>
          <label className="customer-auth-field" htmlFor="customer-email-registration-email">
            <span>Email address</span>
            <input
              autoComplete="email"
              id="customer-email-registration-email"
              inputMode="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              type="email"
              value={email}
            />
          </label>
          <button className="customer-auth-submit" disabled={submitting} type="submit">
            {submitting ? "Sending..." : "Send code"}
          </button>
          <p className="customer-mobile-auth__hint">Code expires in 10 minutes</p>
        </form>
      ) : (
        <form className="customer-mobile-auth__form" onSubmit={handleCodeSubmit} noValidate>
          <label className="customer-auth-field" htmlFor="customer-email-registration-code">
            <span>Verification code</span>
            <input
              autoComplete="one-time-code"
              id="customer-email-registration-code"
              inputMode="numeric"
              maxLength={6}
              onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              type="text"
              value={verificationCode}
            />
          </label>
          <button className="customer-auth-submit" disabled={submitting} type="submit">
            {submitting ? "Verifying..." : "Verify"}
          </button>
          <div className="customer-mobile-auth__actions">
            {resendSeconds > 0 ? (
              <span className="customer-mobile-auth__countdown">Resend in {resendSeconds}s</span>
            ) : (
              <button className="customer-mobile-auth__secondary" disabled={submitting} onClick={() => void handleResend()} type="button">
                Resend code
              </button>
            )}
            <button
              className="customer-mobile-auth__secondary"
              disabled={submitting}
              onClick={() => {
                setVerificationCode("");
                setResendSeconds(0);
                setError(null);
                setStage("email");
              }}
              type="button"
            >
              Change email
            </button>
          </div>
        </form>
      )}

      <button className="customer-mobile-auth__back" disabled={submitting} onClick={onCancel} type="button">
        <ArrowLeft size={15} aria-hidden="true" />
        Other sign-up methods
      </button>
    </section>
  );
}
