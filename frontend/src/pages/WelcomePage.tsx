import {
  ArrowRight,
  Clock3,
  Eye,
  EyeOff,
  LoaderCircle,
  LogIn,
  ShieldCheck,
  Trash2,
  UsersRound
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import type { AppRoutePath } from "@/app/routes";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LoginResult, RememberedAccount } from "@/context/AuthContext";
import { checkSystemHealth } from "@/services/systemHealthService";
import type { SystemHealthState } from "@/services/systemHealthService";
import type { AuthUser } from "@/types/auth";

type WelcomePageProps = {
  error: string | null;
  rememberedAccounts: RememberedAccount[];
  onLogin: (email: string, password: string) => Promise<LoginResult>;
  onNavigate: (path: AppRoutePath) => void;
  onContinueWithTrustedDevice: (account: RememberedAccount) => Promise<boolean>;
  onRemoveRememberedAccount: (id: string) => Promise<void>;
  onSwitchUser: () => Promise<void>;
  status: "loading" | "authenticated" | "unauthenticated";
  user: AuthUser | null;
};

const ambientParticles = [
  "left-[12%] top-[18%] h-1 w-1 animation-delay-0",
  "left-[22%] top-[74%] h-1.5 w-1.5 animation-delay-700",
  "left-[36%] top-[30%] h-1 w-1 animation-delay-1400",
  "left-[51%] top-[82%] h-1 w-1 animation-delay-2100",
  "left-[64%] top-[22%] h-1.5 w-1.5 animation-delay-2800",
  "left-[76%] top-[68%] h-1 w-1 animation-delay-3500",
  "left-[88%] top-[28%] h-1 w-1 animation-delay-4200",
  "left-[91%] top-[78%] h-1.5 w-1.5 animation-delay-4900"
];

const trustedDeviceMessages = new Set([
  "Device verification failed. Please sign in again.",
  "This device was forgotten. Please sign in again.",
  "Account access is inactive. Please contact the owner."
]);

const SYSTEM_HEALTH_REFRESH_MS = 45_000;

const systemHealthFooterCopy: Record<SystemHealthState, string> = {
  checking: "Checking system...",
  healthy: "All Systems Normal",
  warning: "Service Warning",
  "database-unavailable": "Database Unavailable",
  offline: "System Offline"
};

const systemHealthFooterDotClass: Record<SystemHealthState, string> = {
  checking: "bg-sky-400",
  healthy: "bg-emerald-500",
  warning: "bg-amber-500",
  "database-unavailable": "bg-orange-500",
  offline: "bg-red-500"
};

function formatLastUsedAt(lastUsedAt: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(lastUsedAt));
}

export function WelcomePage({
  error,
  rememberedAccounts,
  onLogin,
  onNavigate,
  onContinueWithTrustedDevice,
  onRemoveRememberedAccount,
  onSwitchUser,
  status,
  user
}: WelcomePageProps) {
  const [panelMode, setPanelMode] = useState<"remembered" | "login">(
    rememberedAccounts.length > 0 ? "remembered" : "login"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<"idle" | "verifying">("idle");
  const [verifyingAccountId, setVerifyingAccountId] = useState<string | null>(null);
  const [selectedRememberedAccount, setSelectedRememberedAccount] =
    useState<RememberedAccount | null>(null);
  const [emailHasError, setEmailHasError] = useState(false);
  const [passwordHasError, setPasswordHasError] = useState(false);
  const [validationBump, setValidationBump] = useState(0);
  const [systemHealth, setSystemHealth] = useState<SystemHealthState>("checking");

  const cardRef = useRef<HTMLDivElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const reducedMotionRef = useRef(false);

  const loading = status === "loading";
  const authenticated = status === "authenticated" && user;
  const hasRememberedAccounts = rememberedAccounts.length > 0;
  const hasTrustedDeviceAccounts = rememberedAccounts.some(
    (account) => account.trustedDeviceAvailable
  );
  const isVerifyingAnyAccount = verifyingAccountId !== null;
  const isSubmitting = submitState === "verifying";
  const showRememberedAccounts =
    hasRememberedAccounts && !authenticated && panelMode === "remembered";
  const trustedDeviceFailureMessage =
    error && trustedDeviceMessages.has(error)
      ? error
      : "Device verification failed. Please sign in again.";
  const loginButtonLabel = isSubmitting ? "Signing in..." : "Sign in";

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    const updateReducedMotion = () => {
      reducedMotionRef.current = mediaQuery.matches;
    };

    updateReducedMotion();
    mediaQuery.addEventListener("change", updateReducedMotion);

    return () => {
      mediaQuery.removeEventListener("change", updateReducedMotion);
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function refreshSystemHealth() {
      setSystemHealth("checking");
      const nextHealth = await checkSystemHealth();

      if (mounted) {
        setSystemHealth(nextHealth);
      }
    }

    void refreshSystemHealth();
    const intervalId = window.setInterval(() => {
      void refreshSystemHealth();
    }, SYSTEM_HEALTH_REFRESH_MS);

    return () => {
      mounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!hasRememberedAccounts && panelMode === "remembered") {
      setPanelMode("login");
      setSelectedRememberedAccount(null);
      setVerifyingAccountId(null);
    }
  }, [hasRememberedAccounts, panelMode]);

  useEffect(() => {
    if (!validationBump || reducedMotionRef.current) {
      return;
    }

    cardRef.current?.animate(
      [
        { transform: "translateX(0)" },
        { transform: "translateX(-6px)" },
        { transform: "translateX(6px)" },
        { transform: "translateX(-4px)" },
        { transform: "translateX(4px)" },
        { transform: "translateX(0)" }
      ],
      {
        duration: 320,
        easing: "cubic-bezier(0.36, 0.07, 0.19, 0.97)"
      }
    );
  }, [validationBump]);

  function clearLoginFeedback() {
    setFormError(null);
    setEmailHasError(false);
    setPasswordHasError(false);
  }

  function resetLoginForm() {
    setPassword("");
    setShowPassword(false);
    clearLoginFeedback();
    setSubmitState("idle");
  }

  function showRememberedAccountsPanel() {
    setPanelMode("remembered");
    resetLoginForm();
    setSelectedRememberedAccount(null);
  }

  function showLoginForm(prefillEmail = "", preserveSelectedAccount = false, message?: string) {
    setPanelMode("login");
    resetLoginForm();
    if (!preserveSelectedAccount) {
      setSelectedRememberedAccount(null);
    }
    setEmail(prefillEmail);
    if (message) {
      setFormError(message);
    }
  }

  function handleLoginFieldChange(setter: (value: string) => void, value: string) {
    setter(value);
    clearLoginFeedback();

    if (selectedRememberedAccount) {
      setSelectedRememberedAccount(null);
    }
  }

  function markLoginFieldsAsInvalid() {
    setEmailHasError(true);
    setPasswordHasError(true);
    setValidationBump((current) => current + 1);

    if (passwordInputRef.current) {
      passwordInputRef.current.focus({ preventScroll: true });
      return;
    }

    emailInputRef.current?.focus({ preventScroll: true });
  }

  async function handleRememberedAccountSelect(account: RememberedAccount) {
    if (isVerifyingAnyAccount) {
      return;
    }

    clearLoginFeedback();
    setSelectedRememberedAccount(account);

    if (!account.trustedDeviceAvailable) {
      showLoginForm(account.email, true, "Saved account found. Please sign in to continue.");
      return;
    }

    setVerifyingAccountId(account.id);
    setSubmitState("idle");

    const verified = await onContinueWithTrustedDevice(account);

    if (verified) {
      return;
    }

    setVerifyingAccountId(null);
    showLoginForm(account.email, true);
  }

  async function handleUseAnotherAccount() {
    if (isVerifyingAnyAccount) {
      return;
    }

    showLoginForm();
    await onSwitchUser();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const nextEmail = email.trim();

    clearLoginFeedback();

    if (!nextEmail || !password) {
      setFormError("Please enter your email and password.");
      setEmailHasError(!nextEmail);
      setPasswordHasError(!password);
      setSubmitState("idle");
      setValidationBump((current) => current + 1);

      if (!nextEmail) {
        emailInputRef.current?.focus({ preventScroll: true });
      } else {
        passwordInputRef.current?.focus({ preventScroll: true });
      }

      return;
    }

    setSubmitState("verifying");

    const loginResult = await onLogin(nextEmail, password);

    if (loginResult.success) {
      return;
    }

    setSubmitState("idle");
    setFormError(loginResult.message ?? "Login failed. Please try again.");

    if (loginResult.fieldError) {
      markLoginFieldsAsInvalid();
      return;
    }

    if (!reducedMotionRef.current) {
      cardRef.current?.animate(
        [
          { transform: "translateX(0)" },
          { transform: "translateX(-3px)" },
          { transform: "translateX(3px)" },
          { transform: "translateX(0)" }
        ],
        {
          duration: 220,
          easing: "ease-out"
        }
      );
    }
  }

  function renderHeroCopy() {
    if (authenticated && user) {
      return `Authenticated as ${user.name} with ${user.role.toLowerCase()} access.`;
    }

    if (showRememberedAccounts) {
      if (error && trustedDeviceMessages.has(error)) {
        return trustedDeviceFailureMessage;
      }

      return hasTrustedDeviceAccounts
        ? "Choose a saved account to verify this trusted device and continue."
        : "Saved account found. Please sign in to continue.";
    }

    if (selectedRememberedAccount && panelMode === "login") {
      return selectedRememberedAccount.trustedDeviceAvailable &&
        error &&
        trustedDeviceMessages.has(error)
        ? trustedDeviceFailureMessage
        : "Saved account found. Please sign in to continue.";
    }

    return "Sign in with a development owner or staff account to open the local desktop inventory workspace.";
  }

  function renderCardHeaderLabel() {
    if (authenticated) {
      return "Welcome back";
    }

    if (showRememberedAccounts) {
      return "Known accounts";
    }

    return "Sign in";
  }

  function renderCardBadge() {
    if (authenticated && user) {
      return <StatusBadge variant="success">{user.role}</StatusBadge>;
    }

    if (showRememberedAccounts) {
      return (
        <StatusBadge variant="info">
          {hasTrustedDeviceAccounts ? "Trusted device" : "Saved account"}
        </StatusBadge>
      );
    }

    return null;
  }

  return (
    <main className="welcome-ambient auth-page-enter relative flex min-h-screen flex-col overflow-hidden text-slate-950">
      <div className="welcome-ambient-blob left-[8%] top-[12%] h-[clamp(15rem,24vw,28rem)] w-[clamp(15rem,24vw,28rem)] bg-emerald-200" />
      <div className="welcome-ambient-blob right-[7%] top-[8%] h-[clamp(16rem,26vw,32rem)] w-[clamp(16rem,26vw,32rem)] bg-blue-200 animation-delay-7000" />
      <div className="welcome-ambient-blob bottom-[2%] left-[38%] h-[clamp(14rem,22vw,26rem)] w-[clamp(14rem,22vw,26rem)] bg-violet-200 animation-delay-14000" />
      <div className="pointer-events-none absolute inset-0 z-0">
        {ambientParticles.map((particle) => (
          <span className={`welcome-particle ${particle}`} key={particle} />
        ))}
      </div>

      <div className="welcome-shell">
        <div className="welcome-content">
          <section className="auth-hero-enter max-w-[min(58vw,55rem)]">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[13px] font-semibold text-emerald-800 shadow-sm">
              <ShieldCheck className="h-4 w-4 text-emerald-700" aria-hidden="true" />
              System Secure
            </div>
            <h1 className="mt-[clamp(1.5rem,2.4vw,2.5rem)] text-[clamp(2.75rem,5vw,5rem)] font-semibold leading-[1.02] tracking-normal">
              YsabelleStore
            </h1>
            <p className="mt-[clamp(1rem,1.8vw,1.75rem)] max-w-[clamp(42rem,52vw,58rem)] text-[clamp(1rem,1.25vw,1.25rem)] leading-[1.75] text-slate-600">
              {renderHeroCopy()}
            </p>
            <div className="mt-[clamp(2rem,3.5vw,3.75rem)] max-w-[clamp(34rem,44vw,48rem)]">
              {showRememberedAccounts && (error || !hasTrustedDeviceAccounts) ? (
                <div
                  className="auth-panel-enter rounded-md border border-emerald-100 bg-white p-4 text-sm text-emerald-800 shadow-sm"
                  key="remembered-panel"
                >
                  {error && trustedDeviceMessages.has(error)
                    ? trustedDeviceFailureMessage
                    : "Saved account found. Please sign in to continue."}
                </div>
              ) : authenticated ? (
                <div className="rounded-md border border-emerald-100 bg-white p-4 text-sm text-emerald-800 shadow-sm">
                  Authenticated as {user.name} with {user.role.toLowerCase()} access.
                </div>
              ) : selectedRememberedAccount && panelMode === "login" ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm">
                  {selectedRememberedAccount.trustedDeviceAvailable &&
                  error &&
                  trustedDeviceMessages.has(error)
                    ? trustedDeviceFailureMessage
                    : "Saved account found. Please sign in to continue."}
                </div>
              ) : null}
            </div>
          </section>

          <Card
            className="auth-card-enter welcome-card border-white/70 bg-white/90 shadow-xl shadow-slate-200/70 backdrop-blur-sm"
            ref={cardRef}
          >
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <CardTitle className="text-[clamp(1.125rem,1.5vw,1.45rem)]">
                  {renderCardHeaderLabel()}
                </CardTitle>
                {renderCardBadge()}
              </div>
            </CardHeader>
            <CardContent>
              {authenticated && user ? (
                <div className="space-y-[clamp(1rem,1.6vw,1.5rem)]">
                  <div className="flex items-center gap-3 rounded-md border border-emerald-100 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-800">
                    <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>
                      Active user: {user.name}, {user.role.toLowerCase()} access
                    </span>
                  </div>
                  <Button
                    className="h-[clamp(2.75rem,3.1vw,3.35rem)] w-full text-[clamp(0.875rem,1vw,1rem)]"
                    onClick={() => onNavigate("/dashboard")}
                    type="button"
                  >
                    Continue to dashboard
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button
                    className="h-[clamp(2.75rem,3.1vw,3.35rem)] w-full text-[clamp(0.875rem,1vw,1rem)]"
                    onClick={() => void onSwitchUser()}
                    type="button"
                    variant="secondary"
                  >
                    <UsersRound className="h-4 w-4" aria-hidden="true" />
                    Switch user
                  </Button>
                </div>
              ) : showRememberedAccounts ? (
                <div className="space-y-4">
                  <div className="grid gap-3">
                    {rememberedAccounts.map((account, index) => (
                      <RememberedAccountCard
                        account={account}
                        enterDelayMs={index * 70 + 80}
                        isBusy={isVerifyingAnyAccount}
                        isVerifying={verifyingAccountId === account.id}
                        key={account.id}
                        onContinue={() => void handleRememberedAccountSelect(account)}
                        onRemove={() => void onRemoveRememberedAccount(account.id)}
                      />
                    ))}
                  </div>

                  <Button
                    className="h-[clamp(2.75rem,3.1vw,3.35rem)] w-full text-[clamp(0.875rem,1vw,1rem)]"
                    disabled={isVerifyingAnyAccount}
                    onClick={() => void handleUseAnotherAccount()}
                    type="button"
                    variant="secondary"
                  >
                    <LogIn className="h-4 w-4" aria-hidden="true" />
                    Use another account
                  </Button>
                </div>
              ) : (
                <form className="space-y-[clamp(1rem,1.6vw,1.5rem)]" onSubmit={handleSubmit}>
                  {selectedRememberedAccount ? (
                    <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm">
                      {selectedRememberedAccount.trustedDeviceAvailable &&
                      error &&
                      trustedDeviceMessages.has(error)
                        ? trustedDeviceFailureMessage
                        : "Saved account found. Please sign in to continue."}
                    </div>
                  ) : null}

                  <label className="block space-y-2 text-sm font-medium text-slate-700">
                    <span>Email</span>
                    <input
                      aria-invalid={emailHasError}
                      autoComplete="username"
                      className={cn(
                        "h-11 w-full rounded-md border bg-white px-3 text-sm text-slate-950 outline-none transition-[border-color,box-shadow,transform,background-color] duration-200 ease-out placeholder:text-slate-400 focus-visible:shadow-sm",
                        emailHasError
                          ? "border-red-300 bg-red-50/35 ring-1 ring-red-100 focus-visible:border-red-500 focus-visible:ring-2 focus-visible:ring-red-100"
                          : "border-slate-200 focus-visible:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-100"
                      )}
                      disabled={loading}
                      onChange={(event) => handleLoginFieldChange(setEmail, event.target.value)}
                      placeholder="owner@ysabellestore.local"
                      ref={emailInputRef}
                      type="email"
                      value={email}
                    />
                  </label>

                  <label className="block space-y-2 text-sm font-medium text-slate-700">
                    <span>Password</span>
                    <div className="relative">
                      <input
                        aria-invalid={passwordHasError}
                        autoComplete="current-password"
                        className={cn(
                          "h-11 w-full rounded-md border bg-white px-3 pr-11 text-sm text-slate-950 outline-none transition-[border-color,box-shadow,transform,background-color] duration-200 ease-out placeholder:text-slate-400 focus-visible:shadow-sm",
                          passwordHasError
                            ? "border-red-300 bg-red-50/35 ring-1 ring-red-100 focus-visible:border-red-500 focus-visible:ring-2 focus-visible:ring-red-100"
                            : "border-slate-200 focus-visible:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-100"
                        )}
                        disabled={loading || isSubmitting}
                        onChange={(event) =>
                          handleLoginFieldChange(setPassword, event.target.value)
                        }
                        placeholder="Enter password"
                        ref={passwordInputRef}
                        type={showPassword ? "text" : "password"}
                        value={password}
                      />
                      <button
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-500 transition-colors duration-200 hover:text-slate-950"
                        disabled={loading || isSubmitting}
                        onClick={() => setShowPassword((current) => !current)}
                        type="button"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <Eye className="h-4 w-4" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  </label>

                  {formError ? (
                    <div
                      aria-live="assertive"
                      className={cn(
                        "rounded-md border px-3 py-2 text-sm shadow-sm",
                        emailHasError || passwordHasError
                          ? "border-red-200 bg-red-50 text-red-700"
                          : "border-slate-200 bg-slate-50 text-slate-700"
                      )}
                      role="alert"
                    >
                      {formError}
                    </div>
                  ) : null}

                  <Button
                    className="h-[clamp(2.75rem,3.1vw,3.35rem)] w-full text-[clamp(0.875rem,1vw,1rem)]"
                    disabled={loading || isSubmitting || !email.trim() || !password}
                    type="submit"
                  >
                    {isSubmitting ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <LogIn className="h-4 w-4" aria-hidden="true" />
                    )}
                    {loginButtonLabel}
                  </Button>

                  {hasRememberedAccounts ? (
                    <Button
                      className="h-[clamp(2.75rem,3.1vw,3.35rem)] w-full text-[clamp(0.875rem,1vw,1rem)]"
                      onClick={showRememberedAccountsPanel}
                      type="button"
                      variant="secondary"
                    >
                      <UsersRound className="h-4 w-4" aria-hidden="true" />
                      Back to saved accounts
                    </Button>
                  ) : null}
                </form>
              )}
            </CardContent>
          </Card>
        </div>

        <footer className="auth-footer-enter welcome-footer text-[13px] font-medium text-slate-700/80">
          <p className="min-w-0 justify-self-start whitespace-nowrap">
            YsabelleStore <span className="text-slate-500">v0.1.0</span>
          </p>
          <p className="hidden min-w-0 items-center justify-self-end gap-2 whitespace-nowrap lg:col-start-3 lg:flex">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                systemHealth === "checking" ? "animate-pulse" : "",
                systemHealthFooterDotClass[systemHealth]
              )}
              aria-hidden="true"
            />
            {systemHealthFooterCopy[systemHealth]}
          </p>
        </footer>
      </div>
    </main>
  );
}

function RememberedAccountCard({
  account,
  enterDelayMs,
  isBusy,
  isVerifying,
  onContinue,
  onRemove
}: {
  account: RememberedAccount;
  enterDelayMs: number;
  isBusy: boolean;
  isVerifying: boolean;
  onContinue: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      className="auth-panel-enter rounded-xl border border-slate-200/80 bg-white/80 p-4 text-slate-700 shadow-sm transition-[background-color,border-color,box-shadow,transform] duration-300 ease-out"
      style={{ animationDelay: `${enterDelayMs}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-950">{account.name}</p>
          <p className="truncate text-xs text-slate-500">{account.email}</p>
        </div>
        <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-800">
          {account.role}
        </span>
      </div>

      <p className="mt-3 flex items-center gap-2 text-xs text-slate-500">
        <Clock3 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Last used {formatLastUsedAt(account.lastUsedAt)}
      </p>

      <div className="mt-4 flex gap-2">
        <Button className="flex-1" disabled={isBusy} onClick={onContinue} type="button">
          {isVerifying ? (
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          )}
          {isVerifying ? "Verifying..." : "Continue"}
        </Button>
        <Button disabled={isBusy} onClick={onRemove} type="button" variant="secondary">
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Forget
        </Button>
      </div>
    </div>
  );
}
