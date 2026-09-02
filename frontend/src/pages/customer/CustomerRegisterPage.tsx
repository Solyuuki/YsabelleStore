import { CheckCircle2, Eye, EyeOff, UserPlus } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { CustomerAuthFrame } from "@/components/customer/CustomerAuthFrame";
import { CustomerEmailAuthPanel } from "@/components/customer/CustomerEmailAuthPanel";
import { CustomerEmailRegistrationPanel } from "@/components/customer/CustomerEmailRegistrationPanel";
import { CustomerLink } from "@/components/customer/CustomerLink";
import { CustomerSocialAuthButtons } from "@/components/customer/CustomerSocialAuthButtons";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { prepareCustomerRegistrationIntent } from "@/services/customerAuthService";
import {
  getCustomerSocialAuthNotice,
  startCustomerSocialAuth,
  type CustomerSocialAuthProvider
} from "@/services/customerSocialAuthService";
import "@/styles/customer-auth-quick-sign.css";
import { validateCustomerRegisterForm } from "@/utils/customerAuthForms";

type RegistrationVerificationPanel = "registration-email" | "quick-email" | null;

export function CustomerRegisterPage({ navigate }: { navigate: (path: string) => void }) {
  const { refreshSession, register } = useCustomerAuth();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [verificationPanel, setVerificationPanel] = useState<RegistrationVerificationPanel>(null);
  const [submitting, setSubmitting] = useState(false);
  const [busySocialProvider, setBusySocialProvider] = useState<CustomerSocialAuthProvider | null>(
    null
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(() =>
    getCustomerSocialAuthNotice(globalThis.location?.search ?? "")
  );

  useEffect(() => {
    function restoreInteractiveState() {
      setSubmitting(false);
      setBusySocialProvider(null);
    }

    globalThis.addEventListener("pageshow", restoreInteractiveState);
    return () => globalThis.removeEventListener("pageshow", restoreInteractiveState);
  }, []);

  useEffect(() => {
    void prepareCustomerRegistrationIntent().catch(() => {
      // Submission and verification retry preparation and surface an actionable error.
    });
  }, []);

  function handleEmailChange(value: string) {
    setEmail(value);
    if (verifiedEmail !== value.trim()) setVerifiedEmail(null);
    setFieldErrors((current) => {
      if (!current.email) return current;
      const next = { ...current };
      delete next.email;
      return next;
    });
  }

  function handlePhoneChange(value: string) {
    setPhone(value);
    setFieldErrors((current) => {
      if (!current.phone) return current;
      const next = { ...current };
      delete next.phone;
      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = { confirmPassword, email, name, password, phone, username };
    const errors = validateCustomerRegisterForm(input);

    setFieldErrors(errors);
    setServerError(null);
    if (Object.keys(errors).length > 0) return;

    if (verifiedEmail !== email.trim()) {
      setVerificationPanel("registration-email");
      return;
    }

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

  async function handleQuickSignVerified() {
    await refreshSession();
    navigate("/");
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
          <p>Verify your email to create your account. A mobile number remains optional.</p>
        </div>

        {verificationPanel === null ? (
          <>
            <form
              aria-busy={submitting}
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
                <span className="customer-auth-password">
                  <input
                    aria-describedby={
                      fieldErrors.email ? "customer-register-email-error" : undefined
                    }
                    aria-invalid={Boolean(fieldErrors.email)}
                    autoComplete="email"
                    id="customer-register-email"
                    inputMode="email"
                    onChange={(event) => handleEmailChange(event.target.value)}
                    placeholder="name@example.com"
                    type="email"
                    value={email}
                  />
                  {verifiedEmail === email.trim() && email.trim() ? (
                    <span className="customer-register-mobile__verified" role="status">
                      <CheckCircle2 aria-hidden="true" size={16} /> Verified
                    </span>
                  ) : null}
                </span>
                {fieldErrors.email ? (
                  <small id="customer-register-email-error">{fieldErrors.email}</small>
                ) : verifiedEmail === email.trim() && email.trim() ? (
                  <small>Email verified for manual account creation.</small>
                ) : null}
              </label>

              <label className="customer-auth-field" htmlFor="customer-register-phone">
                <span>
                  PH mobile number <small>(optional)</small>
                </span>
                <input
                  aria-describedby={fieldErrors.phone ? "customer-register-phone-error" : undefined}
                  aria-invalid={Boolean(fieldErrors.phone)}
                  autoComplete="tel"
                  id="customer-register-phone"
                  inputMode="tel"
                  onChange={(event) => handlePhoneChange(event.target.value)}
                  placeholder="09XXXXXXXXX"
                  type="tel"
                  value={phone}
                />
                {fieldErrors.phone ? (
                  <small id="customer-register-phone-error">{fieldErrors.phone}</small>
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
                    aria-label={
                      showConfirmPassword ? "Hide confirm password" : "Show confirm password"
                    }
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
                disabled={submitting || busySocialProvider !== null}
                type="submit"
              >
                {submitting ? "Creating account..." : "Create Account"}
              </button>
            </form>

            <div className="customer-auth-quick-divider" aria-hidden="true">
              <span>or</span>
            </div>
            <CustomerSocialAuthButtons
              busyProvider={busySocialProvider}
              googleHelperText="Verify your Google account for faster sign-up and sign-in."
              emailLabel="Continue with Email OTP"
              emailHelperText="Use only your email to sign in or create an account."
              onEmailStart={() => {
                setServerError(null);
                setVerificationPanel("quick-email");
              }}
              onStart={handleSocialStart}
            />
          </>
        ) : verificationPanel === "quick-email" ? (
          <CustomerEmailAuthPanel
            onCancel={() => setVerificationPanel(null)}
            onVerified={handleQuickSignVerified}
          />
        ) : (
          <CustomerEmailRegistrationPanel
            initialEmail={email}
            onCancel={() => setVerificationPanel(null)}
            onVerified={(verified) => {
              setEmail(verified);
              setVerifiedEmail(verified);
              setFieldErrors((current) => {
                const next = { ...current };
                delete next.email;
                return next;
              });
              setVerificationPanel(null);
            }}
          />
        )}

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
