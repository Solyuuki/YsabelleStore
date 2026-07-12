import { Eye, EyeOff, UserPlus, UsersRound } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RegisterInput } from "@/context/AuthContext";
import type { AuthUser } from "@/types/auth";

type UserManagementPageProps = {
  error: string | null;
  onRegister: (input: RegisterInput, options?: { preserveSession?: boolean }) => Promise<boolean>;
  user: AuthUser | null;
};

export function UserManagementPage({ error, onRegister, user }: UserManagementPageProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<RegisterInput["role"]>("STAFF");
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function resetForm() {
    setName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setRole("STAFF");
    setShowPassword(false);
    setShowConfirmPassword(false);
    setFormError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
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

    setIsSubmitting(true);

    try {
      const created = await onRegister(
        {
          name,
          email,
          password,
          role
        },
        {
          preserveSession: true
        }
      );

      if (created) {
        resetForm();
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader
        actions={<StatusBadge variant="protected">Owner only</StatusBadge>}
        description="Create and manage store user accounts for owner and staff access."
        eyebrow="Owner area"
        title="User Management"
      />

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create Staff Account</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-2 text-sm font-medium text-slate-700">
                  <span>Name</span>
                  <input
                    autoComplete="name"
                    className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    disabled={isSubmitting}
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
                    disabled={isSubmitting}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="user@ysabellestore.local"
                    type="email"
                    value={email}
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-2 text-sm font-medium text-slate-700">
                  <span>Password</span>
                  <div className="relative">
                    <input
                      autoComplete="new-password"
                      className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 pr-14 text-sm text-slate-950 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      disabled={isSubmitting}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="At least 8 characters"
                      type={showPassword ? "text" : "password"}
                      value={password}
                    />
                    <button
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-500 transition-colors hover:text-slate-950"
                      disabled={isSubmitting}
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
                      disabled={isSubmitting}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder="Confirm password"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                    />
                    <button
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                      className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-500 transition-colors hover:text-slate-950"
                      disabled={isSubmitting}
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
                  disabled={isSubmitting}
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
                className="h-11 w-full text-sm"
                disabled={isSubmitting || !name || !email || !password || !confirmPassword}
                type="submit"
              >
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                {role === "STAFF" ? "Create Staff Account" : "Create Account"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Access policy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-600">
            <div className="flex items-start gap-3 rounded-md border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-emerald-800">
              <UsersRound className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <div className="space-y-1">
                <p className="font-medium text-emerald-900">Owner-managed accounts</p>
                <p>Only store owners can open this page and create new accounts.</p>
              </div>
            </div>

            <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="font-medium text-slate-900">Current session</p>
              <p className="mt-1 leading-6">
                {user
                  ? `Signed in as ${user.name} with ${user.role.toLowerCase()} access.`
                  : "No active owner session detected."}
              </p>
            </div>

            <div className="rounded-md border border-slate-200 bg-white px-4 py-3">
              <p className="font-medium text-slate-900">Scope note</p>
              <p className="mt-1 leading-6">
                Public registration is removed from the login page. Staff self password change stays
                future work.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>
    </>
  );
}
