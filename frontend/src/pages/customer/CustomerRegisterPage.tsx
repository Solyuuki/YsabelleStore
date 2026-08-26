import { Eye, EyeOff, UserPlus } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { CustomerLink } from "@/components/customer/CustomerLink";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { prepareCustomerRegistrationIntent } from "@/services/customerAuthService";
import { validateCustomerRegisterForm } from "@/utils/customerAuthForms";

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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    void prepareCustomerRegistrationIntent().catch(() => {
      // Submission retries preparation and surfaces an actionable error if the service is unavailable.
    });
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = { confirmPassword, email, name, password, phone, username };
    const errors = validateCustomerRegisterForm(input);
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

  return (
    <section className="customer-auth-page">
      <div className="customer-auth-card">
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

        <form className="customer-auth-form" onSubmit={handleSubmit} noValidate>
          {serverError ? (
            <div className="customer-auth-alert" role="alert">
              {serverError}
            </div>
          ) : null}

          <label className="customer-auth-field">
            <span>Full name</span>
            <input
              aria-invalid={Boolean(fieldErrors.name)}
              autoComplete="name"
              onChange={(event) => setName(event.target.value)}
              type="text"
              value={name}
            />
            {fieldErrors.name ? <small>{fieldErrors.name}</small> : null}
          </label>

          <label className="customer-auth-field">
            <span>Username</span>
            <input
              aria-invalid={Boolean(fieldErrors.username)}
              autoComplete="username"
              onChange={(event) => setUsername(event.target.value)}
              type="text"
              value={username}
            />
            {fieldErrors.username ? <small>{fieldErrors.username}</small> : null}
          </label>

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
            <span>
              PH mobile number <small>(optional)</small>
            </span>
            <input
              aria-invalid={Boolean(fieldErrors.phone)}
              autoComplete="tel"
              inputMode="tel"
              onChange={(event) => setPhone(event.target.value)}
              type="tel"
              value={phone}
            />
            {fieldErrors.phone ? <small>{fieldErrors.phone}</small> : null}
          </label>

          <label className="customer-auth-field">
            <span>Password</span>
            <span className="customer-auth-password">
              <input
                aria-invalid={Boolean(fieldErrors.password)}
                autoComplete="new-password"
                onChange={(event) => setPassword(event.target.value)}
                type={showPassword ? "text" : "password"}
                value={password}
              />
              <button
                aria-label={showPassword ? "Hide password" : "Show password"}
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
            {fieldErrors.password ? <small>{fieldErrors.password}</small> : null}
          </label>

          <label className="customer-auth-field">
            <span>Confirm password</span>
            <span className="customer-auth-password">
              <input
                aria-invalid={Boolean(fieldErrors.confirmPassword)}
                autoComplete="new-password"
                onChange={(event) => setConfirmPassword(event.target.value)}
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
              />
              <button
                aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
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
            {fieldErrors.confirmPassword ? <small>{fieldErrors.confirmPassword}</small> : null}
          </label>

          <button className="customer-auth-submit" disabled={submitting} type="submit">
            {submitting ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="customer-auth-switch">
          Already have an account?{" "}
          <CustomerLink href="/login" navigate={navigate}>
            Sign In
          </CustomerLink>
        </p>
      </div>
    </section>
  );
}
