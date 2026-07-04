import { ArrowRight, Eye, EyeOff, LogIn, ShieldCheck, UserPlus, UsersRound } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";

import type { AppRoutePath } from "@/app/routes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/shared/LoadingState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { RegisterInput } from "@/context/AuthContext";
import type { AuthUser } from "@/types/auth";

type WelcomePageProps = {
  error: string | null;
  onLogin: (email: string, password: string) => Promise<boolean>;
  onNavigate: (path: AppRoutePath) => void;
  onRegister: (input: RegisterInput) => Promise<boolean>;
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

export function WelcomePage({
  error,
  onLogin,
  onNavigate,
  onRegister,
  onSwitchUser,
  status,
  user
}: WelcomePageProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<RegisterInput["role"]>("STAFF");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const loading = status === "loading";
  const authenticated = status === "authenticated" && user;
  const formModeLabel = mode === "login" ? "Sign in" : "Account setup";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const loginSucceeded = await onLogin(email, password);

    if (loginSucceeded) {
      onNavigate("/dashboard");
    }
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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

    const registerSucceeded = await onRegister({
      name,
      email,
      password,
      role
    });

    if (registerSucceeded) {
      onNavigate("/dashboard");
    }
  }

  function resetAuthForm(nextMode: "login" | "register") {
    setMode(nextMode);
    setPassword("");
    setConfirmPassword("");
    setFormError(null);
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
            <StatusBadge variant={authenticated ? "success" : loading ? "info" : "warning"}>
              {authenticated ? "Session ready" : loading ? "Checking session" : "Login required"}
            </StatusBadge>
            <h1 className="mt-[clamp(1.5rem,2.4vw,2.5rem)] text-[clamp(2.75rem,5vw,5rem)] font-semibold leading-[1.02] tracking-normal">
              YsabelleStore
            </h1>
            <p className="mt-[clamp(1rem,1.8vw,1.75rem)] max-w-[clamp(42rem,52vw,58rem)] text-[clamp(1rem,1.25vw,1.25rem)] leading-[1.75] text-slate-600">
              Sign in with a development owner or staff account to open the local desktop inventory
              workspace.
            </p>
            <div className="mt-[clamp(2rem,3.5vw,3.75rem)] max-w-[clamp(34rem,44vw,48rem)]">
              {loading ? (
                <LoadingState label="Checking local desktop session" />
              ) : authenticated ? (
                <div className="rounded-md border border-emerald-100 bg-white p-4 text-sm text-emerald-800 shadow-sm">
                  Authenticated as {user.name} with {user.role.toLowerCase()} access.
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
                  {authenticated ? "Welcome back" : formModeLabel}
                </CardTitle>
                <StatusBadge variant={authenticated ? "success" : "info"}>
                  {authenticated ? user.role : "Local account"}
                </StatusBadge>
              </div>
            </CardHeader>
            <CardContent>
              {authenticated ? (
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
              ) : mode === "login" ? (
                <form className="space-y-[clamp(1rem,1.6vw,1.5rem)]" onSubmit={handleSubmit}>
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
                        disabled={loading}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="Enter password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                      />
                      <button
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-500 transition-colors hover:text-slate-950"
                        disabled={loading}
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
                    disabled={loading || !email || !password}
                    type="submit"
                  >
                    <LogIn className="h-4 w-4" aria-hidden="true" />
                    Login
                  </Button>
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

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block space-y-2 text-sm font-medium text-slate-700">
                      <span>Password</span>
                      <div className="relative">
                        <input
                          autoComplete="new-password"
                          className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 pr-11 text-sm text-slate-950 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                          disabled={loading}
                          onChange={(event) => setPassword(event.target.value)}
                          placeholder="Minimum 8 characters"
                          type={showPassword ? "text" : "password"}
                          value={password}
                        />
                        <button
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-500 transition-colors hover:text-slate-950"
                          disabled={loading}
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
                          className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 pr-11 text-sm text-slate-950 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                          disabled={loading}
                          onChange={(event) => setConfirmPassword(event.target.value)}
                          placeholder="Repeat password"
                          type={showConfirmPassword ? "text" : "password"}
                          value={confirmPassword}
                        />
                        <button
                          aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-500 transition-colors hover:text-slate-950"
                          disabled={loading}
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
                      disabled={loading}
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
                    disabled={loading || !name || !email || !password || !confirmPassword}
                    type="submit"
                  >
                    <UserPlus className="h-4 w-4" aria-hidden="true" />
                    Create account
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
