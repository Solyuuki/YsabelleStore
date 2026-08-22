import { Eye, EyeOff, LogIn } from "lucide-react";
import { useState, type FormEvent } from "react";

import { CustomerLink } from "@/components/customer/CustomerLink";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { validateCustomerLoginForm } from "@/utils/customerAuthForms";

export function CustomerLoginPage({ navigate }: { navigate: (path: string) => void }) {
  const { login } = useCustomerAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors = validateCustomerLoginForm({ email, password });
    setFieldErrors(errors);
    setServerError(null);

    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      await login({ email: email.trim(), password });
      navigate("/account");
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Unable to sign in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="customer-auth-page">
      <div className="customer-auth-card">
        <div className="customer-auth-card__intro">
          <span className="customer-auth-card__icon" aria-hidden="true">
            <LogIn size={22} />
          </span>
          <p className="customer-eyebrow">Customer account</p>
          <h1>Welcome back</h1>
          <p>Sign in to keep your Ysabelle Store account ready while you shop.</p>
        </div>

        <form className="customer-auth-form" onSubmit={handleSubmit} noValidate>
          {serverError ? (
            <div className="customer-auth-alert" role="alert">
              {serverError}
            </div>
          ) : null}

          <label className="customer-auth-field">
            <span>Email address</span>
            <input
              aria-invalid={Boolean(fieldErrors.email)}
              autoComplete="email"
              inputMode="email"
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              value={email}
            />
            {fieldErrors.email ? <small>{fieldErrors.email}</small> : null}
          </label>

          <label className="customer-auth-field">
            <span>Password</span>
            <span className="customer-auth-password">
              <input
                aria-invalid={Boolean(fieldErrors.password)}
                autoComplete="current-password"
                onChange={(event) => setPassword(event.target.value)}
                type={showPassword ? "text" : "password"}
                value={password}
              />
              <button
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((current) => !current)}
                type="button"
              >
                {showPassword ? <EyeOff aria-hidden="true" size={18} /> : <Eye aria-hidden="true" size={18} />}
              </button>
            </span>
            {fieldErrors.password ? <small>{fieldErrors.password}</small> : null}
          </label>

          <button className="customer-auth-submit" disabled={submitting} type="submit">
            {submitting ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="customer-auth-switch">
          New to Ysabelle Store?{" "}
          <CustomerLink href="/register" navigate={navigate}>
            Create Account
          </CustomerLink>
        </p>
      </div>
    </section>
  );
}
