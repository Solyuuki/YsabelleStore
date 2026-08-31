import { Eye, EyeOff, KeyRound } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { CustomerAuthFrame } from "@/components/customer/CustomerAuthFrame";
import { CustomerEmailAuthPanel } from "@/components/customer/CustomerEmailAuthPanel";
import { CustomerLink } from "@/components/customer/CustomerLink";
import { CustomerMobileAuthPanel } from "@/components/customer/CustomerMobileAuthPanel";
import { CustomerSocialAuthButtons } from "@/components/customer/CustomerSocialAuthButtons";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import {
  completeCustomerSocialLink,
  getCustomerSocialAuthNotice,
  isCustomerSocialLinkRequired,
  startCustomerSocialAuth,
  type CustomerSocialAuthProvider
} from "@/services/customerSocialAuthService";
import "@/styles/customer-auth-quick-sign.css";
import { validateCustomerLoginForm } from "@/utils/customerAuthForms";

type QuickSignPanel = "email" | "mobile" | null;

export function CustomerLoginPage({ navigate }: { navigate: (path: string) => void }) {
  const { login, refreshSession } = useCustomerAuth();
  const socialLinkRequired = isCustomerSocialLinkRequired(globalThis.location?.search ?? "");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [quickSignPanel, setQuickSignPanel] = useState<QuickSignPanel>(null);
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors = validateCustomerLoginForm({ identifier, password });
    setFieldErrors(errors);
    setServerError(null);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      await login({ identifier: identifier.trim(), password });
      if (socialLinkRequired) {
        await completeCustomerSocialLink();
        navigate("/account");
        return;
      }
      navigate("/");
    } catch (error) {
      setServerError(
        error instanceof Error ? error.message : "Unable to sign in. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleSocialStart(provider: CustomerSocialAuthProvider) {
    setServerError(null);
    setBusySocialProvider(provider);
    try {
      startCustomerSocialAuth(provider, "/account", "login");
    } catch (error) {
      setBusySocialProvider(null);
      setServerError(
        error instanceof Error ? error.message : "Unable to start social sign-in. Please try again."
      );
    }
  }

  async function handleOtpVerified() {
    await refreshSession();
    navigate("/account");
  }

  return (
    <CustomerAuthFrame mode="login" navigate={navigate}>
      <div className="customer-auth-card">
        <div className="customer-auth-card__intro">
          <span className="customer-auth-card__icon" aria-hidden="true">
            <KeyRound size={22} />
          </span>
          <p className="customer-eyebrow">Customer account</p>
          <h1>Welcome back</h1>
          <p>Sign in with your password or use a verified email/mobile identity for Quick Sign.</p>
        </div>

        {quickSignPanel === null ? (
          <>
            <form
              aria-busy={submitting}
              className="customer-auth-form"
              onSubmit={handleSubmit}
              noValidate
            >
              {serverError ? (
                <div className="customer-auth-alert" role="alert">
                  {serverError}
                </div>
              ) : null}

              <label className="customer-auth-field" htmlFor="customer-login-identifier">
                <span>Username, email or mobile number</span>
                <input
                  aria-describedby={
                    fieldErrors.identifier ? "customer-login-identifier-error" : undefined
                  }
                  aria-invalid={Boolean(fieldErrors.identifier)}
                  autoComplete="username"
                  id="customer-login-identifier"
                  onChange={(event) => setIdentifier(event.target.value)}
                  placeholder="Username, email, or 09XXXXXXXXX"
                  type="text"
                  value={identifier}
                />
                {fieldErrors.identifier ? (
                  <small id="customer-login-identifier-error">{fieldErrors.identifier}</small>
                ) : null}
              </label>

              <label className="customer-auth-field" htmlFor="customer-login-password">
                <span>Password</span>
                <span className="customer-auth-password">
                  <input
                    aria-describedby={
                      fieldErrors.password ? "customer-login-password-error" : undefined
                    }
                    aria-invalid={Boolean(fieldErrors.password)}
                    autoComplete="current-password"
                    id="customer-login-password"
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
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
                  <small id="customer-login-password-error">{fieldErrors.password}</small>
                ) : null}
              </label>

              <div className="customer-auth-forgot-row">
                <CustomerLink href="/account-recovery" navigate={navigate}>
                  Forgot password?
                </CustomerLink>
              </div>

              <button
                className="customer-auth-submit"
                disabled={submitting || busySocialProvider !== null}
                type="submit"
              >
                {submitting
                  ? socialLinkRequired
                    ? "Linking account..."
                    : "Signing in..."
                  : "Sign In"}
              </button>
            </form>

            <div className="customer-auth-quick-divider" aria-hidden="true">
              <span>or</span>
            </div>
            <CustomerSocialAuthButtons
              busyProvider={busySocialProvider}
              onEmailStart={() => {
                setServerError(null);
                setQuickSignPanel("email");
              }}
              onMobileStart={() => {
                setServerError(null);
                setQuickSignPanel("mobile");
              }}
              onStart={handleSocialStart}
            />
          </>
        ) : quickSignPanel === "email" ? (
          <CustomerEmailAuthPanel
            onCancel={() => setQuickSignPanel(null)}
            onVerified={handleOtpVerified}
          />
        ) : (
          <CustomerMobileAuthPanel
            onCancel={() => setQuickSignPanel(null)}
            onVerified={handleOtpVerified}
          />
        )}

        <p className="customer-auth-switch">
          New to Ysabelle Store?{" "}
          <CustomerLink href="/register" navigate={navigate}>
            Create Account
          </CustomerLink>
        </p>
      </div>
    </CustomerAuthFrame>
  );
}
