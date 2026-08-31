import { ArrowLeft, Smartphone } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import {
  requestCustomerRegistrationMobileVerification,
  verifyCustomerRegistrationMobileVerification
} from "@/services/customerAuthService";

const MOBILE_OTP_RESEND_SECONDS = 30;

export function CustomerMobileRegistrationPanel({
  initialPhone = "",
  onCancel,
  onVerified
}: {
  initialPhone?: string;
  onCancel: () => void;
  onVerified: (phone: string) => Promise<void> | void;
}) {
  const [stage, setStage] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState(initialPhone.replace(/\D/g, "").slice(0, 11));
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

  async function handlePhoneSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!/^09\d{9}$/.test(phone.trim())) {
      setError("Enter a valid Philippine mobile number in 09XXXXXXXXX format.");
      return;
    }

    setSubmitting(true);
    try {
      await requestCustomerRegistrationMobileVerification(phone);
      setVerificationCode("");
      setResendSeconds(MOBILE_OTP_RESEND_SECONDS);
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
      await verifyCustomerRegistrationMobileVerification({ phone, verificationCode });
      await onVerified(phone);
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
      await requestCustomerRegistrationMobileVerification(phone);
      setVerificationCode("");
      setResendSeconds(MOBILE_OTP_RESEND_SECONDS);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to resend the code. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleChangeNumber() {
    setVerificationCode("");
    setResendSeconds(0);
    setError(null);
    setStage("phone");
  }

  return (
    <section className="customer-mobile-auth" aria-label="Mobile OTP registration verification">
      <div className="customer-mobile-auth__heading">
        <span className="customer-mobile-auth__icon" aria-hidden="true">
          <Smartphone size={18} />
        </span>
        <div>
          <strong>{stage === "phone" ? "Mobile sign-up" : "Enter code"}</strong>
          {stage === "code" ? (
            <p className="customer-mobile-auth__meta">Sent to •••• {phone.trim().slice(-4)}</p>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="customer-auth-alert" role="alert">
          {error}
        </div>
      ) : null}

      {stage === "phone" ? (
        <form className="customer-mobile-auth__form" onSubmit={handlePhoneSubmit} noValidate>
          <label className="customer-auth-field" htmlFor="customer-mobile-registration-phone">
            <span>PH mobile number</span>
            <input
              autoComplete="tel"
              id="customer-mobile-registration-phone"
              inputMode="tel"
              maxLength={11}
              onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 11))}
              placeholder="09XXXXXXXXX"
              type="tel"
              value={phone}
            />
          </label>
          <button className="customer-auth-submit" disabled={submitting} type="submit">
            {submitting ? "Sending..." : "Send code"}
          </button>
          <p className="customer-mobile-auth__hint">Code expires in 10 minutes</p>
        </form>
      ) : (
        <form className="customer-mobile-auth__form" onSubmit={handleCodeSubmit} noValidate>
          <label className="customer-auth-field" htmlFor="customer-mobile-registration-code">
            <span>Verification code</span>
            <input
              autoComplete="one-time-code"
              id="customer-mobile-registration-code"
              inputMode="numeric"
              maxLength={6}
              onChange={(event) =>
                setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
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
              onClick={handleChangeNumber}
              type="button"
            >
              Change number
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
        Other sign-up methods
      </button>
    </section>
  );
}
