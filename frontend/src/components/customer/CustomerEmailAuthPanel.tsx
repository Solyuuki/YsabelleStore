import { ArrowLeft, CheckCircle2, Mail, ShieldCheck } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { CustomerVerificationCode } from "@/components/customer/CustomerVerificationCode";
import { requestCustomerEmailAuth, verifyCustomerEmailAuth } from "@/services/customerAuthService";

const EMAIL_OTP_RESEND_SECONDS = 30;

function EmailQuickSignProgress({ stage }: { stage: "email" | "code" }) {
  const verifying = stage === "code";

  return (
    <div className="customer-email-quick-sign__progress" aria-label="Email Quick Sign progress">
      <div className="customer-email-quick-sign__progress-item">
        <span
          className={`customer-email-quick-sign__progress-dot${verifying ? " is-complete" : " is-active"}`}
          aria-hidden="true"
        >
          {verifying ? <CheckCircle2 size={14} /> : 1}
        </span>
        <span>Email</span>
        <span className={`customer-email-quick-sign__progress-line${verifying ? " is-complete" : ""}`} />
      </div>
      <div className="customer-email-quick-sign__progress-item">
        <span
          className={`customer-email-quick-sign__progress-dot${verifying ? " is-active" : ""}`}
          aria-hidden="true"
        >
          2
        </span>
        <span>Verify</span>
      </div>
    </div>
  );
}

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
    <section className="customer-mobile-auth customer-email-quick-sign" aria-label="Email OTP sign-in">
      <EmailQuickSignProgress stage={stage} />

      <div className="customer-email-quick-sign__intro">
        <span className="customer-email-quick-sign__icon" aria-hidden="true">
          {stage === "email" ? <Mail size={22} /> : <ShieldCheck size={22} />}
        </span>
        <p className="customer-email-quick-sign__eyebrow">Email Quick Sign</p>
        <h2>{stage === "email" ? "Sign in with email" : "Enter verification code"}</h2>
        <p>
          {stage === "email"
            ? "Use your verified customer email to continue without a password."
            : `We sent a 6-digit sign-in code to ${email}. The code expires in 10 minutes.`}
        </p>
      </div>

      {error ? (
        <div className="customer-auth-alert customer-email-quick-sign__alert" role="alert">
          {error}
        </div>
      ) : null}

      {stage === "email" ? (
        <form
          className="customer-mobile-auth__form customer-email-quick-sign__form"
          onSubmit={handleEmailSubmit}
          noValidate
        >
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
            {submitting ? "Sending verification code..." : "Send verification code"}
          </button>
        </form>
      ) : (
        <form
          className="customer-mobile-auth__form customer-email-quick-sign__form customer-email-quick-sign__form--verify"
          onSubmit={handleCodeSubmit}
          noValidate
        >
          <CustomerVerificationCode
            autoFocus
            disabled={submitting}
            invalid={Boolean(error)}
            label="6-digit verification code"
            onChange={setVerificationCode}
            value={verificationCode}
          />

          <label className="customer-remember-choice customer-email-quick-sign__remember">
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
                  ? "Forget a saved email account first to free one of the 3 slots."
                  : "Skip another email code on this browser while the trust is active."}
              </small>
            </span>
          </label>

          <button className="customer-auth-submit" disabled={submitting} type="submit">
            {submitting ? "Verifying code..." : "Verify code"}
          </button>

          <div className="customer-email-quick-sign__status" role="status">
            <span className="customer-email-quick-sign__status-icon" aria-hidden="true">
              <Mail size={18} />
            </span>
            <div>
              <strong>Sign-in code sent</strong>
              <span>Paste the full code or enter the six digits above.</span>
            </div>
          </div>

          <div className="customer-mobile-auth__actions customer-email-quick-sign__actions">
            {resendSeconds > 0 ? (
              <span className="customer-mobile-auth__countdown">Resend code in {resendSeconds}s</span>
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
        className="customer-mobile-auth__back customer-email-quick-sign__back"
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
