import {
  ArrowRight,
  Clock3,
  Eye,
  EyeOff,
  LogIn,
  ShieldCheck,
  Trash2,
  UserPlus,
  UsersRound
} from "lucide-react";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import type { AppRoutePath } from "@/app/routes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/shared/LoadingState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { RegisterInput, RememberedAccount } from "@/context/AuthContext";
import type { AuthUser } from "@/types/auth";

type WelcomePageProps = {
  error: string | null;
  rememberedAccounts: RememberedAccount[];
  onLogin: (email: string, password: string) => Promise<boolean>;
  onNavigate: (path: AppRoutePath) => void;
  onRegister: (input: RegisterInput) => Promise<boolean>;
  onRememberedAccountSelect: (account: RememberedAccount) => Promise<boolean>;
  onRemoveRememberedAccount: (id: string) => void;
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
  onRegister,
  onRememberedAccountSelect,
  onRemoveRememberedAccount,
  onSwitchUser,
  status,
  user
}: WelcomePageProps) {
  const [panelMode, setPanelMode] = useState<"remembered" | "login" | "register">(
    rememberedAccounts.length > 0 ? "remembered" : "login"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<RegisterInput["role"]>("STAFF");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<"idle" | "verifying" | "verified">("idle");
  const [submitMode, setSubmitMode] = useState<"login" | "register" | null>(null);
  const [quickAccessState, setQuickAccessState] = useState<"idle" | "verifying" | "verified">(
    "idle"
  );
  const [selectedRememberedAccount, setSelectedRememberedAccount] =
    useState<RememberedAccount | null>(null);

  const loading = status === "loading";
  const authenticated = status === "authenticated" && user;
  const hasRememberedAccounts = rememberedAccounts.length > 0;
  const isSubmitting = submitState === "verifying";
  const isVerifyingQuickAccess = quickAccessState === "verifying";
  const showRememberedAccounts =
    hasRememberedAccounts && !authenticated && panelMode === "remembered";
  const selectedAccountEmail = selectedRememberedAccount?.email ?? "";

  useEffect(() => {
    if (!hasRememberedAccounts && panelMode === "remembered") {
      setPanelMode("login");
      setSelectedRememberedAccount(null);
    }
  }, [hasRememberedAccounts, panelMode]);

  function sleep(ms: number) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }

  async function ensureMinimumSubmitDuration(startedAt: number) {
    const elapsed = performance.now() - startedAt;
    const minimumDurationMs = 800;

    if (elapsed < minimumDurationMs) {
      await sleep(minimumDurationMs - elapsed);
    }
  }

  function resetAuthForm(nextMode: "login" | "register") {
    setPanelMode(nextMode);
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
    setSelectedRememberedAccount(null);
    setFormError(null);
    setSubmitState("idle");
    setSubmitMode(null);
    setQuickAccessState("idle");
  }

  function showRememberedAccountsPanel() {
    setPanelMode("remembered");
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
    setFormError(null);
    setSubmitState("idle");
    setSubmitMode(null);
    setQuickAccessState("idle");
    setSelectedRememberedAccount(null);
  }

  async function handleRememberedAccountSelect(account: RememberedAccount) {
    if (isVerifyingQuickAccess) {
      return;
    }

    setFormError(null);
    setSelectedRememberedAccount(account);
    setQuickAccessState("verifying");
    setSubmitState("idle");
    setSubmitMode(null);

    const startedAt = performance.now();
    const verified = await onRememberedAccountSelect(account);
    await ensureMinimumSubmitDuration(startedAt);

    if (verified) {
      setQuickAccessState("verified");
      await sleep(300);
      onNavigate("/dashboard");
      return;
    }

    setQuickAccessState("idle");
    setPanelMode("login");
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
    setEmail(account.email);
  }

  async function handleUseAnotherAccount() {
    setPanelMode("login");
    setPassword("");
    setConfirmPassword("");
    setEmail("");
    setSelectedRememberedAccount(null);
    setFormError(null);
    setQuickAccessState("idle");
    setSubmitState("idle");
    setSubmitMode(null);
    await onSwitchUser();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    setFormError(null);
    setSubmitMode("login");
    setSubmitState("verifying");

    const startedAt = performance.now();

    const loginSucceeded = await onLogin(email, password);
    await ensureMinimumSubmitDuration(startedAt);

    if (loginSucceeded) {
      setSubmitState("verified");
      await sleep(300);
      onNavigate("/dashboard");
      return;
    }

    setSubmitState("idle");
    setSubmitMode(null);
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    setFormError(null);

    if (name.trim().length < 2) {
      setFormError("Name must be at least 2 characters.");
      return;
    }

    if (password.length < 8) {
      setFormError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setFormError("Password and confirm password must match.");
      return;
    }

    setSubmitMode("register");
    setSubmitState("verifying");

    const startedAt = performance.now();

    const registerSucceeded = await onRegister({
      name,
      email,
      password,
      role
    });
    await ensureMinimumSubmitDuration(startedAt);

    if (registerSucceeded) {
      setSubmitState("verified");
      await sleep(300);
      onNavigate("/dashboard");
      return;
    }

    setSubmitState("idle");
    setSubmitMode(null);
  }

  function renderStatusText() {
    if (authenticated) {
      return "Session ready";
    }

    if (isVerifyingQuickAccess) {
      return "Verifying local access";
    }

    if (showRememberedAccounts) {
      return "Recognized device";
    }

    if (panelMode === "register") {
      return "Account setup";
    }

    if (selectedRememberedAccount && panelMode === "login") {
      return "Login required";
    }

    if (loading) {
      return "Checking session";
    }

    return "Login required";
  }

  function renderHeroCopy() {
    if (authenticated && user) {
      return `Authenticated as ${user.name} with ${user.role.toLowerCase()} access.`;
    }

    if (isVerifyingQuickAccess && selectedRememberedAccount) {
      return `Checking local access for ${selectedRememberedAccount.name} (${selectedRememberedAccount.email}).`;
    }

    if (showRememberedAccounts) {
      return "Choose a recognized account on this device to continue. Each selection still verifies the active session before opening the dashboard.";
    }

    if (panelMode === "register") {
      return "Create a local store account for development access. This stays separate from quick access.";
    }

    if (selectedRememberedAccount && panelMode === "login") {
      return `Please sign in again to continue as ${selectedAccountEmail}.`;
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

    if (panelMode === "register") {
      return "Account setup";
    }

    return "Sign in";
  }

  function renderCardBadge() {
    if (authenticated && user) {
      return <StatusBadge variant="success">{user.role}</StatusBadge>;
    }

    if (showRememberedAccounts || isVerifyingQuickAccess) {
      return <StatusBadge variant="info">Recognized device</StatusBadge>;
    }

    if (panelMode === "register") {
      return <StatusBadge variant="info">Local account</StatusBadge>;
    }

    return <StatusBadge variant="warning">Store login</StatusBadge>;
  }

  return (
    <main className="welcome-ambient relative flex min-h-screen flex-col overflow-hidden text-slate-950">
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
          <section className="max-w-[min(58vw,55rem)]">
            <StatusBadge
              variant={
                authenticated
                  ? "success"
                  : isVerifyingQuickAccess
                    ? "info"
                    : showRememberedAccounts
                      ? "info"
                      : loading
                        ? "info"
                        : "warning"
              }
            >
              {renderStatusText()}
            </StatusBadge>
            <h1 className="mt-[clamp(1.5rem,2.4vw,2.5rem)] text-[clamp(2.75rem,5vw,5rem)] font-semibold leading-[1.02] tracking-normal">
              YsabelleStore
            </h1>
            <p className="mt-[clamp(1rem,1.8vw,1.75rem)] max-w-[clamp(42rem,52vw,58rem)] text-[clamp(1rem,1.25vw,1.25rem)] leading-[1.75] text-slate-600">
              {renderHeroCopy()}
            </p>
            <div className="mt-[clamp(2rem,3.5vw,3.75rem)] max-w-[clamp(34rem,44vw,48rem)]">
              {isVerifyingQuickAccess ? (
                <LoadingState
                  badge="Checking local access"
                  helper={
                    selectedRememberedAccount
                      ? `Please wait while YsabelleStore verifies ${selectedRememberedAccount.email}.`
                      : "Please wait while YsabelleStore verifies your saved session."
                  }
                  label="Verifying local access"
                />
              ) : loading ? (
                <LoadingState
                  badge="Checking session"
                  helper="Please wait while YsabelleStore verifies your local access."
                  label="Checking local desktop session"
                />
              ) : showRememberedAccounts ? (
                <div className="rounded-md border border-emerald-100 bg-white p-4 text-sm text-emerald-800 shadow-sm">
                  Recognized device. Choose a saved account to continue, or use another account to
                  sign in manually.
                </div>
              ) : submitState === "verifying" && submitMode === "login" ? (
                <LoadingState
                  helper="Please wait while YsabelleStore checks your login details."
                  label="Verifying credentials"
                />
              ) : submitState === "verifying" && submitMode === "register" ? (
                <LoadingState
                  badge="Creating account"
                  helper="Please wait while YsabelleStore sets up the account."
                  label="Checking account details"
                />
              ) : submitState === "verified" ? (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 shadow-sm">
                  Verified. Opening the dashboard now.
                </div>
              ) : authenticated ? (
                <div className="rounded-md border border-emerald-100 bg-white p-4 text-sm text-emerald-800 shadow-sm">
                  Authenticated as {user.name} with {user.role.toLowerCase()} access.
                </div>
              ) : selectedRememberedAccount && panelMode === "login" ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm">
                  Signed out from local access. The email for {selectedRememberedAccount.email} is
                  ready for a full sign-in.
                </div>
              ) : (
                <div className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
                  Enter your assigned development credentials to continue.
                </div>
              )}
            </div>
          </section>

          <Card className="welcome-card border-white/70 bg-white/90 shadow-xl shadow-slate-200/70 backdrop-blur-sm">
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
              ) : isVerifyingQuickAccess ? (
                <LoadingState
                  badge="Verifying local access"
                  helper={
                    selectedRememberedAccount
                      ? `Please wait while YsabelleStore checks the session for ${selectedRememberedAccount.name}.`
                      : "Please wait while YsabelleStore checks the saved session."
                  }
                  label="Verifying local access"
                />
              ) : showRememberedAccounts ? (
                <div className="space-y-4">
                  <div className="grid gap-3">
                    {rememberedAccounts.map((account) => (
                      <RememberedAccountCard
                        account={account}
                        key={account.id}
                        onContinue={() => void handleRememberedAccountSelect(account)}
                        onRemove={() => onRemoveRememberedAccount(account.id)}
                      />
                    ))}
                  </div>

                  <Button
                    className="h-[clamp(2.75rem,3.1vw,3.35rem)] w-full text-[clamp(0.875rem,1vw,1rem)]"
                    onClick={() => void handleUseAnotherAccount()}
                    type="button"
                    variant="secondary"
                  >
                    <LogIn className="h-4 w-4" aria-hidden="true" />
                    Use another account
                  </Button>
                </div>
              ) : panelMode === "login" ? (
                <form className="space-y-[clamp(1rem,1.6vw,1.5rem)]" onSubmit={handleSubmit}>
                  {selectedRememberedAccount ? (
                    <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm">
                      Signing in as{" "}
                      <span className="font-medium">{selectedRememberedAccount.email}</span> on this
                      device.
                    </div>
                  ) : null}

                  <label className="block space-y-2 text-sm font-medium text-slate-700">
                    <span>Email</span>
                    <input
                      autoComplete="username"
                      className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      disabled={loading}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="owner@ysabellestore.local"
                      type="email"
                      value={email}
                    />
                  </label>

                  <label className="block space-y-2 text-sm font-medium text-slate-700">
                    <span>Password</span>
                    <div className="relative">
                      <input
                        autoComplete="current-password"
                        className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 pr-11 text-sm text-slate-950 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                        disabled={loading || isSubmitting}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="Enter password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                      />
                      <button
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-500 transition-colors hover:text-slate-950"
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

                  {formError || error ? (
                    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {formError ?? error}
                    </div>
                  ) : null}

                  <Button
                    className="h-[clamp(2.75rem,3.1vw,3.35rem)] w-full text-[clamp(0.875rem,1vw,1rem)]"
                    disabled={loading || isSubmitting || !email || !password}
                    type="submit"
                  >
                    <LogIn className="h-4 w-4" aria-hidden="true" />
                    {submitState === "verifying" && submitMode === "login"
                      ? "Verifying..."
                      : submitState === "verified" && submitMode === "login"
                        ? "Verified"
                        : "Login"}
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

                  <Button
                    className="h-[clamp(2.75rem,3.1vw,3.35rem)] w-full text-[clamp(0.875rem,1vw,1rem)]"
                    onClick={() => resetAuthForm("register")}
                    type="button"
                    variant="secondary"
                  >
                    <UserPlus className="h-4 w-4" aria-hidden="true" />
                    Set up store account
                  </Button>
                </form>
              ) : (
                <form className="space-y-[clamp(1rem,1.6vw,1.5rem)]" onSubmit={handleRegister}>
                  <label className="block space-y-2 text-sm font-medium text-slate-700">
                    <span>Name</span>
                    <input
                      autoComplete="name"
                      className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      disabled={loading}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Store user name"
                      type="text"
                      value={name}
                    />
                  </label>

                  <label className="block space-y-2 text-sm font-medium text-slate-700">
                    <span>Email</span>
                    <input
                      autoComplete="username"
                      className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      disabled={loading}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="user@ysabellestore.local"
                      type="email"
                      value={email}
                    />
                  </label>

                  <div className="grid gap-3 2xl:grid-cols-2">
                    <label className="block space-y-2 text-sm font-medium text-slate-700">
                      <span>Password</span>
                      <div className="relative">
                        <input
                          autoComplete="new-password"
                          className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 pr-14 text-sm text-slate-950 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                          disabled={loading || isSubmitting}
                          onChange={(event) => setPassword(event.target.value)}
                          placeholder="At least 8 characters"
                          type={showPassword ? "text" : "password"}
                          value={password}
                        />
                        <button
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-500 transition-colors hover:text-slate-950"
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

                    <label className="block space-y-2 text-sm font-medium text-slate-700">
                      <span>Confirm password</span>
                      <div className="relative">
                        <input
                          autoComplete="new-password"
                          className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 pr-14 text-sm text-slate-950 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                          disabled={loading || isSubmitting}
                          onChange={(event) => setConfirmPassword(event.target.value)}
                          placeholder="Confirm password"
                          type={showConfirmPassword ? "text" : "password"}
                          value={confirmPassword}
                        />
                        <button
                          aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-500 transition-colors hover:text-slate-950"
                          disabled={loading || isSubmitting}
                          onClick={() => setShowConfirmPassword((current) => !current)}
                          type="button"
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="h-4 w-4" aria-hidden="true" />
                          ) : (
                            <Eye className="h-4 w-4" aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </label>
                  </div>

                  <label className="block space-y-2 text-sm font-medium text-slate-700">
                    <span>Role</span>
                    <select
                      className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      disabled={loading || isSubmitting}
                      onChange={(event) => setRole(event.target.value as RegisterInput["role"])}
                      value={role}
                    >
                      <option value="OWNER">Owner</option>
                      <option value="STAFF">Staff</option>
                    </select>
                  </label>

                  {formError || error ? (
                    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {formError ?? error}
                    </div>
                  ) : null}

                  <Button
                    className="h-[clamp(2.75rem,3.1vw,3.35rem)] w-full text-[clamp(0.875rem,1vw,1rem)]"
                    disabled={
                      loading || isSubmitting || !name || !email || !password || !confirmPassword
                    }
                    type="submit"
                  >
                    <UserPlus className="h-4 w-4" aria-hidden="true" />
                    {submitState === "verifying" && submitMode === "register"
                      ? "Creating..."
                      : "Create account"}
                  </Button>
                  <Button
                    className="h-[clamp(2.75rem,3.1vw,3.35rem)] w-full text-[clamp(0.875rem,1vw,1rem)]"
                    onClick={() => resetAuthForm("login")}
                    type="button"
                    variant="secondary"
                  >
                    Back to login
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>

        <footer className="welcome-footer text-[13px] font-medium text-slate-700/80">
          <p className="min-w-0 justify-self-start whitespace-nowrap">
            YsabelleStore <span className="text-slate-500">v0.1.0</span>
          </p>
          <p className="hidden min-w-0 items-center justify-self-center gap-2 whitespace-nowrap lg:flex">
            <ShieldCheck className="h-4 w-4 text-emerald-700" aria-hidden="true" />
            System Secure
          </p>
          <p className="hidden min-w-0 items-center justify-self-end gap-2 whitespace-nowrap lg:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
            All Systems Normal
          </p>
        </footer>
      </div>
    </main>
  );
}

function RememberedAccountCard({
  account,
  onContinue,
  onRemove
}: {
  account: RememberedAccount;
  onContinue: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white/80 p-4 text-slate-700 shadow-sm transition-[background-color,border-color,box-shadow] duration-300 ease-out">
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
        <Button className="flex-1" onClick={onContinue} type="button">
          Continue
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button onClick={onRemove} type="button" variant="secondary">
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Remove
        </Button>
      </div>
    </div>
  );
}
