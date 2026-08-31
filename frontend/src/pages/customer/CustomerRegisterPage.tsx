import { CheckCircle2, Eye, EyeOff, UserPlus } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { CustomerAuthFrame } from "@/components/customer/CustomerAuthFrame";
import { CustomerLink } from "@/components/customer/CustomerLink";
import { CustomerSocialAuthButtons } from "@/components/customer/CustomerSocialAuthButtons";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import {
  prepareCustomerRegistrationIntent,
  requestCustomerRegistrationMobileVerification,
  verifyCustomerRegistrationMobileVerification
} from "@/services/customerAuthService";
import {
  getCustomerSocialAuthNotice,
  startCustomerSocialAuth,
  type CustomerSocialAuthProvider
} from "@/services/customerSocialAuthService";
import "@/styles/customer-auth-quick-sign.css";
import "@/styles/customer-register-mobile-otp.css";
import {
  isValidPhilippineMobile,
  validateCustomerRegisterForm
} from "@/utils/customerAuthForms";

type MobileVerificationState = "idle" | "sent" | "verified";

const MOBILE_RESEND_COOLDOWN_SECONDS = 30;

export function CustomerRegisterPage({ navigate }: { navigate: (path: string) => void }) {
  const { register } = useCustomerAuth();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [busySocialProvider, setBusySocialProvider] = useState<CustomerSocialAuthProvider | null>(
    null
  );
  const [mobileVerificationState, setMobileVerificationState] =
    useState<MobileVerificationState>("idle");
  const [mobileVerificationCode, setMobileVerificationCode] = useState("");
  const [mobileVerificationBusy, setMobileVerificationBusy] = useState(false);
  const [mobileResendSeconds, setMobileResendSeconds] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(() =>
    getCustomerSocialAuthNotice(globalThis.location?.search ?? "")
  );

  useEffect(() => {
    function restoreInteractiveState() {
      setSubmitting(false);
      setBusySocialProvider(null);
      setMobileVerificationBusy(false);
    }

    globalThis.addEventListener("pageshow", restoreInteractiveState);
    return () => {
      globalThis.removeEventListener("pageshow", restoreInteractiveState);
    };
  }, []);

  useEffect(() => {
    void prepareCustomerRegistrationIntent().catch(() => {
      // Submission and mobile verification retry preparation and surface an actionable error.
    });
  }, []);

  useEffect(() => {
    if (mobileResendSeconds <= 0) return;

    const timer = globalThis.setInterval(() => {
      setMobileResendSeconds((current) => Math.max(0, current - 1));
    }, 1_000);

    return () => globalThis.clearInterval(timer);
  }, [mobileResendSeconds]);

  function handlePhoneChange(value: string) {
    setPhone(value);
    setMobileVerificationState("idle");
    setMobileVerificationCode("");
    setMobileResendSeconds(0);
    setFieldErrors((current) => {
      if (!current.phone) return current;
      const next = { ...current };
      delete next.phone;
      return next;
    });
  }

  async function handleRequestMobileCode() {
    const trimmedPhone = phone.trim();
    setServerError(null);

    if (!trimmedPhone || !isValidPhilippineMobile(trimmedPhone)) {
      setFieldErrors((current) => ({
        ...current,
        phone: "Enter a valid Philippine mobile number before requesting a code."
      }));
      return;
    }

    setMobileVerificationBusy(true);
    try {
      await requestCustomerRegistrationMobileVerification(trimmedPhone);
      setMobileVerificationState("sent");
      setMobileVerificationCode("");
      setMobileResendSeconds(MOBILE_RESEND_COOLDOWN_SECONDS);
      setFieldErrors((current) => {
        if (!current.phone) return current;
        const next = { ...current };
        delete next.phone;
        return next;
      });
    } catch (error) {
      setServerError(
        error instanceof Error
          ? error.message
          : "Unable to send the mobile verification code. Please try again."
      );
    } finally {
      setMobileVerificationBusy(false);
    }
  }

  async function handleVerifyMobileCode() {
    const verificationCode = mobileVerificationCode.trim();
    setServerError(null);

    if (!/^\d{6}$/.test(verificationCode)) {
      setFieldErrors((current) => ({
        ...current,
        phone: "Enter the 6-digit verification code."
      }));
      return;
    }

    setMobileVerificationBusy(true);
    try {
      await verifyCustomerRegistrationMobileVerification({
        phone: phone.trim(),
        verificationCode
      });
      setMobileVerificationState("verified");
      setMobileVerificationCode("");
      setMobileResendSeconds(0);
      setFieldErrors((current) => {
        if (!current.phone) return current;
        const next = { ...current };
        delete next.phone;
        return next;
      });
    } catch (error) {
      setServerError(
        error instanceof Error
          ? error.message
          : "The verification code could not be verified. Please try again."
      );
    } finally {
      setMobileVerificationBusy(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = { confirmPassword, email, name, password, phone, username };
    const errors = validateCustomerRegisterForm(input);

    if (phone.trim() && mobileVerificationState !== "verified") {
      errors.phone = "Verify your mobile number before creating the account.";
    }

    setFieldErrors(errors);
    setServerError(null);

    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      await register({
        email: email.trim(),
        name: name.trim(),
        password,
        phone: phone.trim() || undefined,
        username: username.trim()
      });
      navigate("/account");
    } catch (error) {
      setServerError(
        error instanceof Error ? error.message : "Unable to create your account. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleSocialStart(provider: CustomerSocialAuthProvider) {
    setServerError(null);
    setBusySocialProvider(provider);
    try {
      startCustomerSocialAuth(provider, "/account", "register");
    } catch (error) {
      setBusySocialProvider(null);
      setServerError(
        error instanceof Error ? error.message : "Unable to start social sign-up. Please try again."
      );
    }
  }

  return (
    <CustomerAuthFrame mode="register" navigate={navigate}>
      <div className="customer-auth-card customer-auth-card--register">
        <div className="customer-auth-card__intro">
          <span className="customer-auth-card__icon" aria-hidden="true">
            <UserPlus size={22} />
          </span>
          <p className="customer-eyebrow">Customer account</p>
          <h1>Create your account</h1>
          <p>
            Save your customer identity now while guest shopping remains available whenever you
            prefer.
          </p>
        </div>

        <form
          aria-busy={submitting || mobileVerificationBusy}
          className="customer-auth-form customer-auth-form--register"
          onSubmit={handleSubmit}
          noValidate
        >
          {serverError ? (
            <div className="customer-auth-alert" role="alert">
              {serverError}
            </div>
          ) : null}

          <label className="customer-auth-field" htmlFor="customer-register-name">
            <span>Full name</span>
            <input
              aria-describedby={fieldErrors.name ? "customer-register-name-error" : undefined}
              aria-invalid={Boolean(fieldErrors.name)}
              autoComplete="name"
              id="customer-register-name"
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Juan Dela Cruz"
              type="text"
              value={name}
            />
            {fieldErrors.name ? (
              <small id="customer-register-name-error">{fieldErrors.name}</small>
            ) : null}
          </label>

          <label className="customer-auth-field" htmlFor="customer-register-username">
            <span>Username</span>
            <input
              aria-describedby={
                fieldErrors.username ? "customer-register-username-error" : undefined
              }
              aria-invalid={Boolean(fieldErrors.username)}
              autoComplete="username"
              id="customer-register-username"
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Create your username"
              type="text"
              value={username}
            />
            {fieldErrors.username ? (
              <small id="customer-register-username-error">{fieldErrors.username}</small>
            ) : null}
          </label>

          <label className="customer-auth-field" htmlFor="customer-register-email">
            <span>Email address</span>
            <input
              aria-describedby={fieldErrors.email ? "customer-register-email-error" : undefined}
              aria-invalid={Boolean(fieldErrors.email)}
              autoComplete="email"
              id="customer-register-email"
              inputMode="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              type="email"
              value={email}
            />
            {fieldErrors.email ? (
              <small id="customer-register-email-error">{fieldErrors.email}</small>
            ) : null}
          </label>

          <label
            className="customer-auth-field customer-auth-field--mobile-verify"
            htmlFor="customer-register-phone"
          >
            <span>
              PH mobile number <small>(optional)</small>
            </span>
            <span className="customer-register-mobile__input-row">
              <input
                aria-describedby={fieldErrors.phone ? "customer-register-phone-error" : undefined}
                aria-invalid={Boolean(fieldErrors.phone)}
                autoComplete="tel"
                disabled={mobileVerificationState === "verified"}
                id="customer-register-phone"
                inputMode="tel"
                onChange={(event) => handlePhoneChange(event.target.value)}
                placeholder="09XXXXXXXXX"
                type="tel"
                value={phone}
              />
              {mobileVerificationState === "verified" ? (
                <span className="customer-register-mobile__verified" role="status">
                  <CheckCircle2 aria-hidden="true" size={16} />
                  Verified
                </span>
              ) : (
                <button
                  className="customer-register-mobile__action"
                  disabled={mobileVerificationBusy || !phone.trim()}
                  onClick={() => void handleRequestMobileCode()}
                  type="button"
                >
                  {mobileVerificationBusy && mobileVerificationState === "idle"
                    ? "Sending..."
                    : "Send code"}
                </button>
              )}
            </span>

            {mobileVerificationState === "sent" ? (
              <span className="customer-register-mobile__verification" aria-live="polite">
                <input
                  aria-label="Mobile verification code"
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  maxLength={6}
                  onChange={(event) =>
                    setMobileVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="6-digit code"
                  type="text"
                  value={mobileVerificationCode}
                />
                <span className="customer-register-mobile__verification-actions">
                  <button
                    className="customer-register-mobile__action"
                    disabled={mobileVerificationBusy || mobileVerificationCode.length !== 6}
                    onClick={() => void handleVerifyMobileCode()}
                    type="button"
                  >
                    {mobileVerificationBusy ? "Verifying..." : "Verify code"}
                  </button>
                  <button
                    className="customer-register-mobile__link"
                    disabled={mobileVerificationBusy || mobileResendSeconds > 0}
                    onClick={() => void handleRequestMobileCode()}
                    type="button"
                  >
                    {mobileResendSeconds > 0
                      ? `Resend in ${mobileResendSeconds}s`
                      : "Resend code"}
                  </button>
                </span>
              </span>
            ) : null}

            {fieldErrors.phone ? (
              <small id="customer-register-phone-error">{fieldErrors.phone}</small>
            ) : mobileVerificationState === "verified" ? (
              <small className="customer-register-mobile__success">
                This number will be linked to your account.
              </small>
            ) : null}
          </label>

          <label className="customer-auth-field" htmlFor="customer-register-password">
            <span>Password</span>
            <span className="customer-auth-password">
              <input
                aria-describedby={
                  fieldErrors.password ? "customer-register-password-error" : undefined
                }
                aria-invalid={Boolean(fieldErrors.password)}
                autoComplete="new-password"
                id="customer-register-password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Create a strong password"
                type={showPassword ? "text" : "password"}
                value={password}
              />
              <button
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((current) => !current)}
                type="button"
              >
                {showPassword ? (
                  <EyeOff aria-hidden="true" size={18} />
                ) : (
                  <Eye aria-hidden="true" size={18} />
                )}
              </button>
            </span>
            {fieldErrors.password ? (
              <small id="customer-register-password-error">{fieldErrors.password}</small>
            ) : null}
          </label>

          <label className="customer-auth-field" htmlFor="customer-register-confirm-password">
            <span>Confirm password</span>
            <span className="customer-auth-password">
              <input
                aria-describedby={
                  fieldErrors.confirmPassword
                    ? "customer-register-confirm-password-error"
                    : undefined
                }
                aria-invalid={Boolean(fieldErrors.confirmPassword)}
                autoComplete="new-password"
                id="customer-register-confirm-password"
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Re-enter your password"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
              />
              <button
                aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                aria-pressed={showConfirmPassword}
                onClick={() => setShowConfirmPassword((current) => !current)}
                type="button"
              >
                {showConfirmPassword ? (
                  <EyeOff aria-hidden="true" size={18} />
                ) : (
                  <Eye aria-hidden="true" size={18} />
                )}
              </button>
            </span>
            {fieldErrors.confirmPassword ? (
              <small id="customer-register-confirm-password-error">
                {fieldErrors.confirmPassword}
              </small>
            ) : null}
          </label>

          <button
            className="customer-auth-submit"
            disabled={submitting || mobileVerificationBusy || busySocialProvider !== null}
            type="submit"
          >
            {submitting ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <div className="customer-auth-quick-divider" aria-hidden="true">
          <span>or</span>
        </div>
        <CustomerSocialAuthButtons busyProvider={busySocialProvider} onStart={handleSocialStart} />

        <p className="customer-auth-switch">
          Already have an account?{" "}
          <CustomerLink href="/login" navigate={navigate}>
            Sign In
          </CustomerLink>
        </p>
      </div>
    </CustomerAuthFrame>
  );
}
