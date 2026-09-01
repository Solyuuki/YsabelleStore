import { REGEXP_ONLY_DIGITS } from "input-otp";
import { ArrowLeft, Mail } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { requestCustomerEmailAuth, verifyCustomerEmailAuth } from "@/services/customerAuthService";

const EMAIL_OTP_RESEND_SECONDS = 30;

export function CustomerEmailAuthPanel({
  onCancel,
  onVerified,
  rememberDisabled = false
}: {
  onCancel: () => void;
  onVerified: () => Promise<void> | void;
  rememberDisabled?: boolean;
}) {
  const [stage, setStage] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [rememberFor30Days, setRememberFor30Days] = useState(false);
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
      await requestCustomerEmailAuth(email);
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
    if (!/^\d{6}$/.test(verificationCode)) {
      setError("Enter the 6-digit verification code.");
      return;
    }

    setSubmitting(true);
    try {
      await verifyCustomerEmailAuth({ email, verificationCode, rememberFor30Days });
      await onVerified();
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
      await requestCustomerEmailAuth(email);
      setVerificationCode("");
      setResendSeconds(EMAIL_OTP_RESEND_SECONDS);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to resend the code.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="customer-mobile-auth" aria-label="Email OTP sign-in">
      <div className="customer-mobile-auth__heading">
        <span className="customer-mobile-auth__icon" aria-hidden="true">
          <Mail size={18} />
        </span>
        <div>
          <strong>{stage === "email" ? "Email sign-in" : "Enter code"}</strong>
          {stage === "code" ? <p className="customer-mobile-auth__meta">Sent to {email}</p> : null}
        </div>
      </div>

      {error ? (
        <div className="customer-auth-alert" role="alert">
          {error}
        </div>
      ) : null}

      {stage === "email" ? (
        <form className="customer-mobile-auth__form" onSubmit={handleEmailSubmit} noValidate>
          <label className="customer-auth-field" htmlFor="customer-email-auth-email">
            <span>Email address</span>
            <input
              autoComplete="email"
              id="customer-email-auth-email"
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
          <fieldset className="customer-email-otp" disabled={submitting}>
            <legend>Verification code</legend>
            <InputOTP
              aria-describedby="customer-email-otp-hint"
              aria-label="6-digit verification code"
              autoComplete="one-time-code"
              autoFocus
              className="customer-email-otp__control"
              containerClassName="customer-email-otp__container"
              inputMode="numeric"
              maxLength={6}
              onChange={setVerificationCode}
              pattern={REGEXP_ONLY_DIGITS}
              value={verificationCode}
            >
              <InputOTPGroup className="customer-email-otp__group">
                {Array.from({ length: 6 }, (_, index) => (
                  <InputOTPSlot className="customer-email-otp__slot" index={index} key={index} />
                ))}
              </InputOTPGroup>
            </InputOTP>
            <small id="customer-email-otp-hint">Paste the full code or enter one digit at a time.</small>
          </fieldset>

          <label className="customer-remember-choice">
            <input
              checked={rememberFor30Days}
              disabled={rememberDisabled || submitting}
              onChange={(event) => setRememberFor30Days(event.target.checked)}
              type="checkbox"
            />
            <span>
              Remember this account for 30 days
              <small>
                {rememberDisabled
                  ? "Forget a known account first to free one of the 3 slots."
                  : "Skip another sign-in code on this browser until the trust expires."}
              </small>
            </span>
          </label>

          <button className="customer-auth-submit" disabled={submitting} type="submit">
            {submitting ? "Verifying..." : "Verify"}
          </button>
          <div className="customer-mobile-auth__actions">
            {resendSeconds > 0 ? (
              <span className="customer-mobile-auth__countdown">Resend in {resendSeconds}s</span>
            ) : (
              <button
                className="customer-mobile-auth__secondary"
                disabled={submitting}
                onClick={() => void handleResend()}
                type="button"
              >
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

      <button
        className="customer-mobile-auth__back"
        disabled={submitting}
        onClick={onCancel}
        type="button"
      >
        <ArrowLeft size={15} aria-hidden="true" />
        Other sign-in methods
      </button>
    </section>
  );
}
