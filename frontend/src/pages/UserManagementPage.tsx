import {
  Eye,
  EyeOff,
  History,
  MessageSquareText,
  Search,
  ShieldCheck,
  UserPlus,
  UsersRound
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { AppPagination } from "@/components/shared/AppPagination";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { RegisterInput } from "@/context/AuthContext";
import {
  fetchCustomerModerationAccounts,
  fetchCustomerModerationAudit,
  fetchCustomerModerationReviews,
  fetchCustomerModerationSummary,
  updateCustomerModerationAccount,
  updateCustomerModerationReview,
  type CustomerModerationAccount,
  type CustomerModerationAccountStatus,
  type CustomerModerationAuditEntry,
  type CustomerModerationReview,
  type CustomerModerationSummary
} from "@/services/customerModerationApi";
import type { AuthUser } from "@/types/auth";
import type { StorefrontPagination } from "@/types/storefront";

type UserManagementPageProps = {
  error: string | null;
  onRegister: (input: RegisterInput, options?: { preserveSession?: boolean }) => Promise<boolean>;
  user: AuthUser | null;
};

type ManagementTab = "store" | "customers";
type CustomerView = "accounts" | "reviews";
type AccountStatusFilter = "ALL" | CustomerModerationAccountStatus;
type ReviewStatusFilter = "ALL" | CustomerModerationReview["status"];

const DEFAULT_MODERATION_PAGE_SIZE = 25;

function emptyPagination(pageSize = DEFAULT_MODERATION_PAGE_SIZE): StorefrontPagination {
  return {
    page: 1,
    pageSize,
    totalItems: 0,
    totalPages: 0
  };
}

const EMPTY_CUSTOMER_SUMMARY: CustomerModerationSummary = {
  total: 0,
  active: 0,
  inactive: 0,
  suspended: 0,
  banned: 0,
  restricted: 0
};
type ModerationTarget =
  | {
      kind: "account";
      item: CustomerModerationAccount;
      nextStatus: "ACTIVE" | "SUSPENDED" | "BANNED";
    }
  | {
      kind: "review";
      item: CustomerModerationReview;
      nextStatus: "VISIBLE" | "HIDDEN" | "REMOVED";
    };

export function UserManagementPage({ error, onRegister, user }: UserManagementPageProps) {
  const [activeTab, setActiveTab] = useState<ManagementTab>("store");
  const [customerView, setCustomerView] = useState<CustomerView>("accounts");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<RegisterInput["role"]>("STAFF");
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [customerSearch, setCustomerSearch] = useState("");
  const [accounts, setAccounts] = useState<CustomerModerationAccount[]>([]);
  const [reviews, setReviews] = useState<CustomerModerationReview[]>([]);
  const [accountPage, setAccountPage] = useState(1);
  const [accountPageSize, setAccountPageSize] = useState(DEFAULT_MODERATION_PAGE_SIZE);
  const [accountStatus, setAccountStatus] = useState<AccountStatusFilter>("ALL");
  const [accountMeta, setAccountMeta] = useState<StorefrontPagination>(() => emptyPagination());
  const [accountSummary, setAccountSummary] =
    useState<CustomerModerationSummary>(EMPTY_CUSTOMER_SUMMARY);
  const [reviewPage, setReviewPage] = useState(1);
  const [reviewPageSize, setReviewPageSize] = useState(DEFAULT_MODERATION_PAGE_SIZE);
  const [reviewStatus, setReviewStatus] = useState<ReviewStatusFilter>("ALL");
  const [reviewMeta, setReviewMeta] = useState<StorefrontPagination>(() => emptyPagination());
  const [moderationLoading, setModerationLoading] = useState(false);
  const [moderationError, setModerationError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [moderationTarget, setModerationTarget] = useState<ModerationTarget | null>(null);
  const [moderationReason, setModerationReason] = useState("");
  const [moderationSaving, setModerationSaving] = useState(false);
  const [auditCustomer, setAuditCustomer] = useState<CustomerModerationAccount | null>(null);
  const [auditEntries, setAuditEntries] = useState<CustomerModerationAuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  useEffect(() => {
    if (activeTab !== "customers") return;

    let active = true;
    void fetchCustomerModerationSummary()
      .then((summary) => {
        if (active) setAccountSummary(summary);
      })
      .catch((reason: unknown) => {
        if (active) {
          setModerationError(
            reason instanceof Error ? reason.message : "Customer summary could not be loaded."
          );
        }
      });

    return () => {
      active = false;
    };
  }, [activeTab, reloadKey]);

  useEffect(() => {
    if (activeTab !== "customers" || customerView !== "accounts") return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setModerationLoading(true);
      setModerationError(null);
      const search = customerSearch.trim() || undefined;

      void fetchCustomerModerationAccounts({
        search,
        status: accountStatus === "ALL" ? undefined : accountStatus,
        page: accountPage,
        pageSize: accountPageSize
      })
        .then((result) => {
          if (controller.signal.aborted) return;
          setAccounts(result.items);
          setAccountMeta(result.meta);

          if (result.meta.totalPages > 0 && accountPage > result.meta.totalPages) {
            setAccountPage(result.meta.totalPages);
          }
        })
        .catch((reason: unknown) => {
          if (!controller.signal.aborted) {
            setModerationError(
              reason instanceof Error
                ? reason.message
                : "Customer moderation data could not be loaded."
            );
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setModerationLoading(false);
        });
    }, 220);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [
    accountPage,
    accountPageSize,
    accountStatus,
    activeTab,
    customerSearch,
    customerView,
    reloadKey
  ]);

  useEffect(() => {
    if (activeTab !== "customers" || customerView !== "reviews") return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setModerationLoading(true);
      setModerationError(null);
      const search = customerSearch.trim() || undefined;

      void fetchCustomerModerationReviews({
        search,
        status: reviewStatus === "ALL" ? undefined : reviewStatus,
        page: reviewPage,
        pageSize: reviewPageSize
      })
        .then((result) => {
          if (controller.signal.aborted) return;
          setReviews(result.items);
          setReviewMeta(result.meta);

          if (result.meta.totalPages > 0 && reviewPage > result.meta.totalPages) {
            setReviewPage(result.meta.totalPages);
          }
        })
        .catch((reason: unknown) => {
          if (!controller.signal.aborted) {
            setModerationError(
              reason instanceof Error
                ? reason.message
                : "Review moderation data could not be loaded."
            );
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setModerationLoading(false);
        });
    }, 220);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [
    activeTab,
    customerSearch,
    customerView,
    reloadKey,
    reviewPage,
    reviewPageSize,
    reviewStatus
  ]);

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
    if (isSubmitting) return;
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
      const created = await onRegister({ name, email, password, role }, { preserveSession: true });
      if (created) resetForm();
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitModeration() {
    if (!moderationTarget || moderationReason.trim().length < 3) return;
    setModerationSaving(true);
    setModerationError(null);
    try {
      if (moderationTarget.kind === "account") {
        await updateCustomerModerationAccount(moderationTarget.item.id, {
          status: moderationTarget.nextStatus,
          reason: moderationReason.trim()
        });
      } else {
        await updateCustomerModerationReview(moderationTarget.item.id, {
          status: moderationTarget.nextStatus,
          reason: moderationReason.trim()
        });
      }
      setModerationTarget(null);
      setModerationReason("");
      setReloadKey((value) => value + 1);
    } catch (reason) {
      setModerationError(
        reason instanceof Error ? reason.message : "The moderation change could not be saved."
      );
    } finally {
      setModerationSaving(false);
    }
  }

  async function openAudit(account: CustomerModerationAccount) {
    setAuditCustomer(account);
    setAuditEntries([]);
    setAuditLoading(true);
    try {
      setAuditEntries(await fetchCustomerModerationAudit(account.id));
    } catch (reason) {
      setModerationError(
        reason instanceof Error ? reason.message : "Moderation history could not be loaded."
      );
    } finally {
      setAuditLoading(false);
    }
  }

  return (
    <>
      <PageHeader
        actions={<StatusBadge variant="protected">Owner only</StatusBadge>}
        description="Manage store access and customer moderation without mixing internal staff with storefront accounts."
        eyebrow="Owner area"
        title="User Management"
      />

      <div className="mb-4 inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
        <button
          className={managementTabClass(activeTab === "store")}
          onClick={() => setActiveTab("store")}
          type="button"
        >
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          Store accounts
        </button>
        <button
          className={managementTabClass(activeTab === "customers")}
          onClick={() => setActiveTab("customers")}
          type="button"
        >
          <UsersRound className="h-4 w-4" aria-hidden="true" />
          Customer accounts
        </button>
      </div>

      {activeTab === "store" ? (
        <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Create store account</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block space-y-2 text-sm font-medium text-slate-700">
                    <span>Name</span>
                    <Input
                      autoComplete="name"
                      disabled={isSubmitting}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Store user name"
                      value={name}
                    />
                  </label>
                  <label className="block space-y-2 text-sm font-medium text-slate-700">
                    <span>Email</span>
                    <Input
                      autoComplete="username"
                      disabled={isSubmitting}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="user@ysabellestore.local"
                      type="email"
                      value={email}
                    />
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <PasswordField
                    disabled={isSubmitting}
                    label="Password"
                    onChange={setPassword}
                    onToggle={() => setShowPassword((current) => !current)}
                    placeholder="At least 8 characters"
                    show={showPassword}
                    value={password}
                  />
                  <PasswordField
                    disabled={isSubmitting}
                    label="Confirm password"
                    onChange={setConfirmPassword}
                    onToggle={() => setShowConfirmPassword((current) => !current)}
                    placeholder="Confirm password"
                    show={showConfirmPassword}
                    value={confirmPassword}
                  />
                </div>

                <label className="block space-y-2 text-sm font-medium text-slate-700">
                  <span>Role</span>
                  <select
                    className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none focus:ring-2 focus:ring-indigo-500"
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
                  {isSubmitting
                    ? "Creating..."
                    : role === "STAFF"
                      ? "Create Staff Account"
                      : "Create Account"}
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
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <div className="space-y-1">
                  <p className="font-medium text-emerald-900">Separated account domains</p>
                  <p>Owner/staff access remains independent from storefront customer accounts.</p>
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
            </CardContent>
          </Card>
        </section>
      ) : (
        <section className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Loaded customers
                </p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{accounts.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Active
                </p>
                <p className="mt-1 text-2xl font-semibold text-emerald-700">
                  {accountSummary.active}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Restricted
                </p>
                <p className="mt-1 text-2xl font-semibold text-amber-700">
                  {accountSummary.restricted}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Customer moderation</CardTitle>
                  <p className="mt-1 text-sm text-slate-500">
                    Customer restrictions and review visibility are audited owner actions.
                  </p>
                </div>
                <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
                  <button
                    className={managementTabClass(customerView === "accounts")}
                    onClick={() => setCustomerView("accounts")}
                    type="button"
                  >
                    <UsersRound className="h-4 w-4" /> Accounts
                  </button>
                  <button
                    className={managementTabClass(customerView === "reviews")}
                    onClick={() => setCustomerView("reviews")}
                    type="button"
                  >
                    <MessageSquareText className="h-4 w-4" /> Reviews
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <label className="relative mb-4 block">
                <Search
                  aria-hidden="true"
                  className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                />
                <Input
                  className="pl-9"
                  onChange={(event) => setCustomerSearch(event.target.value)}
                  placeholder={
                    customerView === "accounts"
                      ? "Search name, email, username or phone"
                      : "Search reviewer, product, comment or email"
                  }
                  value={customerSearch}
                />
              </label>

              {moderationError ? (
                <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {moderationError}
                </div>
              ) : null}

              {moderationLoading ? (
                <div className="py-12 text-center text-sm text-slate-500">
                  Loading moderation data...
                </div>
              ) : customerView === "accounts" ? (
                <CustomerAccountModerationList
                  accounts={accounts}
                  onAudit={(account) => void openAudit(account)}
                  onModerate={setModerationTarget}
                />
              ) : (
                <CustomerReviewModerationList reviews={reviews} onModerate={setModerationTarget} />
              )}
            </CardContent>
          </Card>
        </section>
      )}

      <ModerationDialog
        onOpenChange={(open) => {
          if (!open && !moderationSaving) {
            setModerationTarget(null);
            setModerationReason("");
          }
        }}
        onReasonChange={setModerationReason}
        onSubmit={() => void submitModeration()}
        open={Boolean(moderationTarget)}
        reason={moderationReason}
        saving={moderationSaving}
        target={moderationTarget}
      />

      <Dialog
        onOpenChange={(open) => {
          if (!open) setAuditCustomer(null);
        }}
        open={Boolean(auditCustomer)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Moderation history</DialogTitle>
            <DialogDescription>
              {auditCustomer
                ? `Recent owner actions for ${auditCustomer.name}.`
                : "Customer audit history."}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[420px] space-y-3 overflow-y-auto px-6 pb-6">
            {auditLoading ? (
              <p className="text-sm text-slate-500">Loading history...</p>
            ) : auditEntries.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                No moderation actions recorded yet.
              </p>
            ) : (
              auditEntries.map((entry) => (
                <article className="rounded-lg border border-slate-200 p-3" key={entry.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-sm text-slate-900">
                      {entry.previousState ?? "—"} → {entry.nextState ?? "—"}
                    </strong>
                    <span className="text-xs text-slate-400">
                      {new Date(entry.createdAt).toLocaleString("en-PH")}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{entry.reason}</p>
                  <p className="mt-1 text-xs text-slate-400">By {entry.actor.name}</p>
                </article>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PasswordField({
  disabled,
  label,
  onChange,
  onToggle,
  placeholder,
  show,
  value
}: {
  disabled: boolean;
  label: string;
  onChange: (value: string) => void;
  onToggle: () => void;
  placeholder: string;
  show: boolean;
  value: string;
}) {
  return (
    <label className="block space-y-2 text-sm font-medium text-slate-700">
      <span>{label}</span>
      <div className="relative">
        <Input
          autoComplete="new-password"
          className="pr-12"
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          type={show ? "text" : "password"}
          value={value}
        />
        <button
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-500 hover:text-slate-950"
          disabled={disabled}
          onClick={onToggle}
          type="button"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </label>
  );
}

function CustomerAccountModerationList({
  accounts,
  onAudit,
  onModerate
}: {
  accounts: CustomerModerationAccount[];
  onAudit: (account: CustomerModerationAccount) => void;
  onModerate: (target: ModerationTarget) => void;
}) {
  if (accounts.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-slate-500">
        No customer accounts match this view.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {accounts.map((account) => (
        <article className="rounded-xl border border-slate-200 bg-white p-4" key={account.id}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <strong className="text-sm text-slate-950">{account.name}</strong>
                <StatusBadge variant={accountStatusVariant(account.status)}>
                  {account.status}
                </StatusBadge>
              </div>
              <p className="mt-1 text-sm text-slate-500">{account.email}</p>
              <p className="mt-2 text-xs text-slate-400">
                {account.counts.orders} orders · {account.counts.favorites} favorites ·{" "}
                {account.counts.reviews} reviews · {account.counts.activeSessions} active sessions
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => onAudit(account)} size="sm" type="button" variant="secondary">
                <History className="h-4 w-4" /> History
              </Button>
              {account.status !== "ACTIVE" ? (
                <Button
                  onClick={() =>
                    onModerate({ kind: "account", item: account, nextStatus: "ACTIVE" })
                  }
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  Restore
                </Button>
              ) : null}
              {account.status !== "SUSPENDED" ? (
                <Button
                  onClick={() =>
                    onModerate({ kind: "account", item: account, nextStatus: "SUSPENDED" })
                  }
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  Suspend
                </Button>
              ) : null}
              {account.status !== "BANNED" ? (
                <Button
                  onClick={() =>
                    onModerate({ kind: "account", item: account, nextStatus: "BANNED" })
                  }
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  Ban
                </Button>
              ) : null}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function CustomerReviewModerationList({
  reviews,
  onModerate
}: {
  reviews: CustomerModerationReview[];
  onModerate: (target: ModerationTarget) => void;
}) {
  if (reviews.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-slate-500">
        No product reviews match this view.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {reviews.map((review) => (
        <article className="rounded-xl border border-slate-200 bg-white p-4" key={review.id}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <strong className="text-sm text-slate-950">{review.product.name}</strong>
                <StatusBadge variant={reviewStatusVariant(review.status)}>
                  {review.status}
                </StatusBadge>
                {review.verifiedPurchase ? (
                  <StatusBadge variant="success">Verified purchase</StatusBadge>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {review.rating}/5 · {review.reviewerDisplayName}
                {review.customerAccount ? ` · ${review.customerAccount.email}` : ""}
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-700">{review.comment}</p>
              {review.moderationReason ? (
                <p className="mt-2 text-xs text-slate-400">
                  Last moderation: {review.moderationReason}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {review.status !== "VISIBLE" ? (
                <Button
                  onClick={() =>
                    onModerate({ kind: "review", item: review, nextStatus: "VISIBLE" })
                  }
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  Show
                </Button>
              ) : (
                <Button
                  onClick={() => onModerate({ kind: "review", item: review, nextStatus: "HIDDEN" })}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  Hide
                </Button>
              )}
              {review.status !== "REMOVED" ? (
                <Button
                  onClick={() =>
                    onModerate({ kind: "review", item: review, nextStatus: "REMOVED" })
                  }
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  Remove
                </Button>
              ) : null}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function ModerationDialog({
  onOpenChange,
  onReasonChange,
  onSubmit,
  open,
  reason,
  saving,
  target
}: {
  onOpenChange: (open: boolean) => void;
  onReasonChange: (reason: string) => void;
  onSubmit: () => void;
  open: boolean;
  reason: string;
  saving: boolean;
  target: ModerationTarget | null;
}) {
  const nextState = target?.nextStatus ?? "";
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm moderation action</DialogTitle>
          <DialogDescription>
            {target?.kind === "account"
              ? `Change ${target.item.name} to ${nextState.toLowerCase()}.`
              : target
                ? `Change this product review to ${nextState.toLowerCase()}.`
                : "Review this moderation action."}
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-2">
          <label className="block space-y-2 text-sm font-medium text-slate-700">
            <span>Reason</span>
            <Textarea
              disabled={saving}
              maxLength={500}
              onChange={(event) => onReasonChange(event.target.value)}
              placeholder="Record why this moderation action is necessary."
              value={reason}
            />
          </label>
        </div>
        <DialogFooter>
          <Button
            disabled={saving}
            onClick={() => onOpenChange(false)}
            type="button"
            variant="secondary"
          >
            Cancel
          </Button>
          <Button disabled={saving || reason.trim().length < 3} onClick={onSubmit} type="button">
            {saving ? "Saving..." : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function managementTabClass(active: boolean) {
  return [
    "inline-flex min-h-9 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors",
    active
      ? "bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200"
      : "text-slate-500 hover:bg-white/70 hover:text-slate-900"
  ].join(" ");
}

function accountStatusVariant(status: CustomerModerationAccount["status"]) {
  if (status === "ACTIVE") return "success" as const;
  if (status === "SUSPENDED") return "warning" as const;
  if (status === "BANNED") return "error" as const;
  return "info" as const;
}

function reviewStatusVariant(status: CustomerModerationReview["status"]) {
  if (status === "VISIBLE") return "success" as const;
  if (status === "HIDDEN") return "warning" as const;
  return "error" as const;
}
