import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  MailCheck,
  ShieldCheck
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { CustomerAuthFrame } from "@/components/customer/CustomerAuthFrame";
import { CustomerLink } from "@/components/customer/CustomerLink";
import {
  requestCustomerPasswordRecovery,
  resetCustomerPassword,
  verifyCustomerPasswordRecoveryCode
} from "@/services/customerAuthService";
import "@/styles/customer-auth-recovery.css";

type RecoveryStage = "identify" | "verify" | "reset" | "complete";

const RESEND_COOLDOWN_SECONDS = 30;

function errorMessage(reason: unknown, fallback: string) {
  return reason instanceof Error && reason.message ? reason.message : fallback;
}

function RecoveryProgress({ stage }: { stage: RecoveryStage }) {
  const currentStep = stage === "identify" ? 1 : stage === "verify" ? 2 : 3;
  const steps = [
    { label: "Identify", step: 1 },
    { label: "Verify", step: 2 },
    { label: "Secure", step: 3 }
  ];

  return (
    <div className="customer-recovery-progress" aria-label="Recovery progress">
      {steps.map(({ label, step }, index) => {
        const completed = currentStep > step || stage === "complete";
        const active = currentStep === step && stage !== "complete";
        return (
          <div className="customer-recovery-progress__item" key={label}>
            <div
              className={`customer-recovery-progress__step${
                active ? " customer-recovery-progress__step--active" : ""
              }${completed ? " customer-recovery-progress__step--complete" : ""}`}
            >
              <span className="customer-recovery-progress__dot" aria-hidden="true">
                {completed ? <CheckCircle2 size={14} /> : step}
              </span>
              <span>{label}</span>
            </div>
            {index < steps.length - 1 ? (
              <span
                className={`customer-recovery-progress__line${
                  currentStep > step || stage === "complete"
                    ? " customer-recovery-progress__line--complete"
                    : ""
                }`}
                aria-hidden="true"
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function CustomerAccountRecoveryPage({
  navigate
}: {
  location: string;
  navigate: (path: string) => void;
}) {
  const [stage, setStage] = useState<RecoveryStage>("identify");
  const [identifier, setIdentifier] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (resendCooldown <= 0) return undefined;
    const timer = window.setTimeout(() => {
      setResendCooldown((current) => Math.max(0, current - 1));
    }, 1_000);
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  async function sendRecoveryCode(normalizedIdentifier: string) {
    await requestCustomerPasswordRecovery(normalizedIdentifier);
    setVerificationCode("");
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
    setStage("verify");
  }

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
      await sendRecoveryCode(normalizedIdentifier);
    } catch (reason) {
      setError(errorMessage(reason, "A verification code could not be requested right now."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCodeVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!/^\d{6}$/.test(verificationCode)) {
      setError("Enter the 6-digit verification code from your email.");
      return;
    }

    setSubmitting(true);
    try {
      await verifyCustomerPasswordRecoveryCode({
        identifier,
        verificationCode
      });
      setVerificationCode("");
      setStage("reset");
    } catch (reason) {
      setError(
        errorMessage(reason, "The verification code is invalid or expired. Request a new code.")
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResendCode() {
    if (submitting || resendCooldown > 0) return;
    setError(null);
    setSubmitting(true);
    try {
      await sendRecoveryCode(identifier.trim());
    } catch (reason) {
      setError(errorMessage(reason, "A new verification code could not be requested right now."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

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
      await resetCustomerPassword({ newPassword });
      setNewPassword("");
      setConfirmPassword("");
      setStage("complete");
    } catch (reason) {
      setError(
        errorMessage(reason, "This recovery session is invalid or expired. Request a new code.")
      );
    } finally {
      setSubmitting(false);
    }
  }

  function startOver() {
    setError(null);
    setVerificationCode("");
    setNewPassword("");
    setConfirmPassword("");
    setResendCooldown(0);
    setStage("identify");
  }

  return (
    <CustomerAuthFrame mode="recovery" navigate={navigate}>
      <div className="customer-auth-card customer-recovery-card">
        <RecoveryProgress stage={stage} />

        <div className="customer-auth-card__intro customer-recovery-intro">
          <span className="customer-auth-card__icon customer-recovery-icon" aria-hidden="true">
            {stage === "verify" ? (
              <MailCheck size={23} />
            ) : stage === "complete" ? (
              <CheckCircle2 size={23} />
            ) : stage === "reset" ? (
              <KeyRound size={23} />
            ) : (
              <ShieldCheck size={23} />
            )}
          </span>
          <p className="customer-eyebrow">Secure account recovery</p>
          {stage === "identify" ? (
            <>
              <h1>Recover your account</h1>
              <p>Enter the username, email, or mobile number connected to your customer account.</p>
            </>
          ) : stage === "verify" ? (
            <>
              <h1>Enter verification code</h1>
              <p>
                If an eligible account exists, a 6-digit code was sent to its registered email.
                The code expires in 10 minutes.
              </p>
            </>
          ) : stage === "reset" ? (
            <>
              <h1>Set a new password</h1>
              <p>Your email code was verified. Choose a new password for your account.</p>
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
              {submitting ? "Sending verification code..." : "Send verification code"}
            </button>
          </form>
        ) : null}

        {stage === "verify" ? (
          <>
            <form
              aria-busy={submitting}
              className="customer-auth-form customer-recovery-form"
              onSubmit={(event) => void handleCodeVerification(event)}
              noValidate
            >
              <label className="customer-auth-field" htmlFor="customer-recovery-code">
                <span>6-digit verification code</span>
                <div className="customer-recovery-code-shell">
                  <div className="customer-recovery-code-slots" aria-hidden="true">
                    {Array.from({ length: 6 }, (_, index) => {
                      const digit = verificationCode[index] ?? "";
                      const isActive = index === Math.min(verificationCode.length, 5);
                      return (
                        <span
                          className={`customer-recovery-code-slot${
                            digit ? " customer-recovery-code-slot--filled" : ""
                          }${isActive ? " customer-recovery-code-slot--active" : ""}`}
                          key={index}
                        >
                          {digit || "0"}
                        </span>
                      );
                    })}
                  </div>
                  <input
                    aria-invalid={Boolean(error)}
                    aria-label="6-digit verification code"
                    autoComplete="one-time-code"
                    className="customer-recovery-code-input"
                    id="customer-recovery-code"
                    inputMode="numeric"
                    maxLength={6}
                    onChange={(event) =>
                      setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    pattern="[0-9]{6}"
                    type="text"
                    value={verificationCode}
                  />
                </div>
              </label>
              <button className="customer-auth-submit" disabled={submitting} type="submit">
                {submitting ? "Verifying code..." : "Verify code"}
              </button>
            </form>

            <div className="customer-recovery-status" role="status">
              <span className="customer-recovery-status__icon" aria-hidden="true">
                <MailCheck size={19} />
              </span>
              <div>
                <strong>Verification code requested</strong>
                <span>
                  For privacy, this confirmation is the same whether or not an account matches your
                  entry.
                </span>
              </div>
            </div>
          </>
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
            <span className="customer-recovery-status__icon" aria-hidden="true">
              <CheckCircle2 size={19} />
            </span>
            <div>
              <strong>Your account is secured</strong>
              <span>All previous customer sessions have been signed out.</span>
            </div>
          </div>
        ) : null}

        <div className="customer-recovery-actions">
          {stage === "verify" ? (
            <button
              className="customer-recovery-secondary"
              disabled={submitting || resendCooldown > 0}
              onClick={() => void handleResendCode()}
              type="button"
            >
              {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend code"}
            </button>
          ) : null}

          {stage === "verify" || stage === "reset" ? (
            <button className="customer-recovery-tertiary" onClick={startOver} type="button">
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
