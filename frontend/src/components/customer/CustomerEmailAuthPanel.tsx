import { ArrowLeft, Mail } from "lucide-react";
import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from "react";

import { requestCustomerEmailAuth, verifyCustomerEmailAuth } from "@/services/customerAuthService";

const EMAIL_OTP_RESEND_SECONDS = 30;
const EMAIL_OTP_LENGTH = 6;

function createEmptyOtpDigits() {
  return Array.from({ length: EMAIL_OTP_LENGTH }, () => "");
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
  const [otpDigits, setOtpDigits] = useState<string[]>(createEmptyOtpDigits);
  const [rememberFor30Days, setRememberFor30Days] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const otpInputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (stage !== "code" || resendSeconds <= 0) return;
    const timeout = globalThis.setTimeout(() => {
      setResendSeconds((current) => Math.max(0, current - 1));
    }, 1000);
    return () => globalThis.clearTimeout(timeout);
  }, [resendSeconds, stage]);

  function focusOtpDigit(index: number) {
    const safeIndex = Math.max(0, Math.min(EMAIL_OTP_LENGTH - 1, index));
    otpInputRefs.current[safeIndex]?.focus();
    otpInputRefs.current[safeIndex]?.select();
  }

  function applyOtpDigits(rawValue: string, startIndex = 0) {
    const digits = rawValue.replace(/\D/g, "").slice(0, EMAIL_OTP_LENGTH - startIndex);
    if (!digits) return;

    setOtpDigits((current) => {
      const next = [...current];
      for (let offset = 0; offset < digits.length; offset += 1) {
        next[startIndex + offset] = digits[offset] ?? "";
      }
      return next;
    });

    const nextFocus = Math.min(startIndex + digits.length, EMAIL_OTP_LENGTH - 1);
    globalThis.requestAnimationFrame(() => focusOtpDigit(nextFocus));
  }

  function handleOtpChange(index: number, rawValue: string) {
    const digits = rawValue.replace(/\D/g, "");
    if (digits.length > 1) {
      applyOtpDigits(digits, index);
      return;
    }

    const digit = digits.slice(-1);
    setOtpDigits((current) => {
      const next = [...current];
      next[index] = digit;
      return next;
    });

    if (digit && index < EMAIL_OTP_LENGTH - 1) {
      globalThis.requestAnimationFrame(() => focusOtpDigit(index + 1));
    }
  }

  function handleOtpPaste(index: number, event: ClipboardEvent<HTMLInputElement>) {
    const pastedDigits = event.clipboardData.getData("text").replace(/\D/g, "");
    if (!pastedDigits) return;
    event.preventDefault();
    applyOtpDigits(pastedDigits, index);
  }

  function handleOtpKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace") {
      if (otpDigits[index]) {
        setOtpDigits((current) => {
          const next = [...current];
          next[index] = "";
          return next;
        });
        return;
      }

      if (index > 0) {
        event.preventDefault();
        setOtpDigits((current) => {
          const next = [...current];
          next[index - 1] = "";
          return next;
        });
        globalThis.requestAnimationFrame(() => focusOtpDigit(index - 1));
      }
      return;
    }

    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      focusOtpDigit(index - 1);
      return;
    }

    if (event.key === "ArrowRight" && index < EMAIL_OTP_LENGTH - 1) {
      event.preventDefault();
      focusOtpDigit(index + 1);
    }
  }

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
      setOtpDigits(createEmptyOtpDigits());
      setResendSeconds(EMAIL_OTP_RESEND_SECONDS);
      setStage("code");
      globalThis.requestAnimationFrame(() => focusOtpDigit(0));
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
    const verificationCode = otpDigits.join("");
    if (!/^\d{6}$/.test(verificationCode)) {
      setError("Enter the 6-digit verification code.");
      const firstEmptyIndex = otpDigits.findIndex((digit) => !digit);
      globalThis.requestAnimationFrame(() => focusOtpDigit(firstEmptyIndex >= 0 ? firstEmptyIndex : 0));
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
      setOtpDigits(createEmptyOtpDigits());
      setResendSeconds(EMAIL_OTP_RESEND_SECONDS);
      globalThis.requestAnimationFrame(() => focusOtpDigit(0));
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
            <div
              aria-describedby="customer-email-otp-hint"
              aria-label="6-digit verification code"
              className="customer-email-otp__group"
              role="group"
            >
              {Array.from({ length: 6 }, (_, index) => (
                <input
                  aria-label={`Digit ${index + 1} of 6`}
                  autoComplete={index === 0 ? "one-time-code" : "off"}
                  className={`customer-email-otp__digit${otpDigits[index] ? " is-filled" : ""}`}
                  inputMode="numeric"
                  key={index}
                  maxLength={index === 0 ? 6 : 1}
                  onChange={(event) => handleOtpChange(index, event.target.value)}
                  onFocus={(event) => event.currentTarget.select()}
                  onKeyDown={(event) => handleOtpKeyDown(index, event)}
                  onPaste={(event) => handleOtpPaste(index, event)}
                  pattern="[0-9]*"
                  ref={(element) => {
                    otpInputRefs.current[index] = element;
                  }}
                  type="text"
                  value={otpDigits[index] ?? ""}
                />
              ))}
            </div>
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
                setOtpDigits(createEmptyOtpDigits());
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
