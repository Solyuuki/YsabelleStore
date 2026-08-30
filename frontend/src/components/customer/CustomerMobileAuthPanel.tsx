import { ArrowLeft, Smartphone } from "lucide-react";
import { useState, type FormEvent } from "react";

import {
  requestCustomerMobileAuth,
  verifyCustomerMobileAuth
} from "@/services/customerAuthService";

export function CustomerMobileAuthPanel({
  onCancel,
  onVerified
}: {
  onCancel: () => void;
  onVerified: () => Promise<void> | void;
}) {
  const [stage, setStage] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePhoneSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!/^09\d{9}$/.test(phone.trim())) {
      setError("Enter a valid Philippine mobile number in 09XXXXXXXXX format.");
      return;
    }

    setSubmitting(true);
    try {
      await requestCustomerMobileAuth(phone);
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
      await verifyCustomerMobileAuth({ phone, verificationCode });
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

  return (
    <section className="customer-mobile-auth" aria-label="Mobile OTP sign in">
      <div className="customer-mobile-auth__heading">
        <span className="customer-mobile-auth__icon" aria-hidden="true">
          <Smartphone size={18} />
        </span>
        <div>
          <strong>{stage === "phone" ? "Sign in with mobile OTP" : "Enter verification code"}</strong>
          <p>
            {stage === "phone"
              ? "Use the Philippine mobile number already linked to your customer account."
              : `We sent a 6-digit code for ${phone.trim()}.`}
          </p>
        </div>
      </div>

      {error ? (
        <div className="customer-auth-alert" role="alert">
          {error}
        </div>
      ) : null}

      {stage === "phone" ? (
        <form className="customer-mobile-auth__form" onSubmit={handlePhoneSubmit} noValidate>
          <label className="customer-auth-field" htmlFor="customer-mobile-auth-phone">
            <span>PH mobile number</span>
            <input
              autoComplete="tel"
              id="customer-mobile-auth-phone"
              inputMode="tel"
              maxLength={11}
              onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 11))}
              placeholder="09XXXXXXXXX"
              type="tel"
              value={phone}
            />
          </label>
          <button className="customer-auth-submit" disabled={submitting} type="submit">
            {submitting ? "Sending code..." : "Send verification code"}
          </button>
        </form>
      ) : (
        <form className="customer-mobile-auth__form" onSubmit={handleCodeSubmit} noValidate>
          <label className="customer-auth-field" htmlFor="customer-mobile-auth-code">
            <span>6-digit verification code</span>
            <input
              autoComplete="one-time-code"
              id="customer-mobile-auth-code"
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
            {submitting ? "Verifying..." : "Verify and sign in"}
          </button>
          <button
            className="customer-mobile-auth__secondary"
            disabled={submitting}
            onClick={() => {
              setVerificationCode("");
              setError(null);
              setStage("phone");
            }}
            type="button"
          >
            Use a different mobile number
          </button>
        </form>
      )}

      <button className="customer-mobile-auth__back" disabled={submitting} onClick={onCancel} type="button">
        <ArrowLeft size={16} aria-hidden="true" />
        Back to sign-in options
      </button>
    </section>
  );
}
