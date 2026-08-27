import {
  CheckCircle2,
  History,
  KeyRound,
  LogOut,
  Mail,
  PackageCheck,
  Phone,
  ShieldCheck,
  UserRound
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import { formatCurrency } from "@/components/customer/ProductCard";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import {
  CustomerAccountRequestError,
  changeCustomerPassword,
  claimCustomerUsername,
  fetchCustomerSessions,
  revokeOtherCustomerSessions,
  updateCustomerProfile
} from "@/services/customerAccountService";
import { fetchCustomerOrders } from "@/services/storefrontService";
import type { CustomerSessionSummary } from "@/types/customerAccount";
import type { StorefrontOrder } from "@/types/storefront";

const orderDateFormatter = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short"
});
const sessionDateFormatter = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short"
});

type AccountTab = "orders" | "profile" | "security";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (
    parts
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "YS"
  );
}

function errorMessage(reason: unknown, fallback: string) {
  return reason instanceof Error && reason.message ? reason.message : fallback;
}

function isCustomerSessionError(reason: unknown) {
  return (
    reason instanceof CustomerAccountRequestError &&
    (reason.code === "CUSTOMER_SESSION_REQUIRED" || reason.code === "CUSTOMER_SESSION_INVALID")
  );
}

export function CustomerAccountPage({ navigate }: { navigate: (path: string) => void }) {
  const { customer, error, logout, refreshSession } = useCustomerAuth();
  const [activeTab, setActiveTab] = useState<AccountTab>("orders");
  const [orders, setOrders] = useState<StorefrontOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<CustomerSessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [logoutMessage, setLogoutMessage] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [claimUsername, setClaimUsername] = useState("");
  const [claimPassword, setClaimPassword] = useState("");
  const [claimingUsername, setClaimingUsername] = useState(false);
  const [usernameMessage, setUsernameMessage] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [revokePassword, setRevokePassword] = useState("");
  const [revokingSessions, setRevokingSessions] = useState(false);
  const [sessionActionMessage, setSessionActionMessage] = useState<string | null>(null);

  useEffect(() => {
    if (customer) setName(customer.name);
  }, [customer]);

  useEffect(() => {
    if (!customer) return;

    const controller = new AbortController();
    let active = true;

    async function loadAccountData() {
      setOrdersLoading(true);
      setSessionsLoading(true);
      setOrdersError(null);
      setSessionsError(null);

      const [ordersResult, sessionsResult] = await Promise.allSettled([
        fetchCustomerOrders(controller.signal),
        fetchCustomerSessions(controller.signal)
      ]);

      if (!active) return;

      const sessionRejected =
        (ordersResult.status === "rejected" && isCustomerSessionError(ordersResult.reason)) ||
        (sessionsResult.status === "rejected" && isCustomerSessionError(sessionsResult.reason));

      if (sessionRejected) {
        const restoredCustomer = await refreshSession();
        if (!active) return;
        if (!restoredCustomer) {
          navigate("/login");
          return;
        }
      }

      if (ordersResult.status === "fulfilled") {
        setOrders(ordersResult.value);
      } else if (
        !(ordersResult.reason instanceof DOMException && ordersResult.reason.name === "AbortError")
      ) {
        setOrdersError(errorMessage(ordersResult.reason, "Your order history could not be loaded."));
      }

      if (sessionsResult.status === "fulfilled") {
        setSessions(sessionsResult.value);
      } else if (
        !(sessionsResult.reason instanceof DOMException && sessionsResult.reason.name === "AbortError")
      ) {
        setSessionsError(
          errorMessage(sessionsResult.reason, "Your active sessions could not be loaded.")
        );
      }

      setOrdersLoading(false);
      setSessionsLoading(false);
    }

    void loadAccountData();

    return () => {
      active = false;
      controller.abort();
    };
  }, [customer, navigate, refreshSession]);

  const otherSessionCount = useMemo(
    () => sessions.filter((session) => !session.current).length,
    [sessions]
  );

  if (!customer) {
    return (
      <section className="customer-auth-page">
        <div className="customer-auth-card customer-account-card">
          <p>Loading your customer account...</p>
        </div>
      </section>
    );
  }

  async function handleLogout() {
    setSigningOut(true);
    setLogoutMessage(null);

    try {
      await logout();
      navigate("/");
    } catch {
      setLogoutMessage(
        "You are signed out on this device. We could not confirm the server session was revoked."
      );
      navigate("/");
    } finally {
      setSigningOut(false);
    }
  }

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileMessage(null);
    setProfileError(null);

    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      setProfileError("Enter at least 2 characters for your name.");
      return;
    }

    setSavingName(true);
    try {
      await updateCustomerProfile({ name: trimmedName });
      await refreshSession();
      setProfileMessage("Profile name updated.");
    } catch (reason) {
      setProfileError(errorMessage(reason, "Your profile could not be updated."));
    } finally {
      setSavingName(false);
    }
  }

  async function handleUsernameClaim(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUsernameMessage(null);
    setUsernameError(null);

    if (!claimUsername.trim() || !claimPassword) {
      setUsernameError("Enter a username and your current password.");
      return;
    }

    setClaimingUsername(true);
    try {
      await claimCustomerUsername({ username: claimUsername, currentPassword: claimPassword });
      await refreshSession();
      setClaimPassword("");
      setUsernameMessage("Username claimed. You can now use it to sign in.");
    } catch (reason) {
      setUsernameError(errorMessage(reason, "Your username could not be claimed."));
    } finally {
      setClaimingUsername(false);
    }
  }

  async function handlePasswordChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordMessage(null);
    setPasswordError(null);

    if (newPassword.length < 8 || newPassword.length > 128) {
      setPasswordError("New password must be between 8 and 128 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation do not match.");
      return;
    }

    setChangingPassword(true);
    try {
      await changeCustomerPassword({ currentPassword, newPassword });
      await refreshSession();
      const refreshedSessions = await fetchCustomerSessions();
      setSessions(refreshedSessions);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage(
        "Password changed. Other signed-in sessions were ended for your security."
      );
    } catch (reason) {
      setPasswordError(errorMessage(reason, "Your password could not be changed."));
    } finally {
      setChangingPassword(false);
    }
  }

  async function handleRevokeSessions(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSessionsError(null);
    setSessionActionMessage(null);

    if (!revokePassword) {
      setSessionsError("Enter your current password to sign out other sessions.");
      return;
    }

    setRevokingSessions(true);
    try {
      const result = await revokeOtherCustomerSessions(revokePassword);
      const refreshedSessions = await fetchCustomerSessions();
      setSessions(refreshedSessions);
      setRevokePassword("");
      setSessionActionMessage(
        result.revokedCount > 0
          ? `${result.revokedCount} other session${result.revokedCount === 1 ? "" : "s"} signed out.`
          : "No other active sessions needed to be signed out."
      );
    } catch (reason) {
      setSessionsError(errorMessage(reason, "Other sessions could not be signed out."));
    } finally {
      setRevokingSessions(false);
    }
  }

  return (
    <section className="customer-account-page-v2">
      <div className="customer-account-layout-v2">
        <aside className="customer-account-rail" aria-label="Account sections">
          <div className="customer-account-identity-card">
            <div className="customer-account-avatar" aria-hidden="true">
              {initials(customer.name)}
            </div>
            <div>
              <p className="customer-eyebrow">My Account</p>
              <h1>{customer.name}</h1>
              <p>{customer.username ? `@${customer.username}` : "Username not set"}</p>
            </div>
            <span className="customer-account-status">
              <CheckCircle2 size={15} /> Active
            </span>
          </div>

          <nav className="customer-account-nav" aria-label="Account views" role="tablist">
            <button
              aria-controls="orders-panel"
              aria-selected={activeTab === "orders"}
              onClick={() => setActiveTab("orders")}
              role="tab"
              type="button"
            >
              <History size={17} /> Orders
            </button>
            <button
              aria-controls="profile-panel"
              aria-selected={activeTab === "profile"}
              onClick={() => setActiveTab("profile")}
              role="tab"
              type="button"
            >
              <UserRound size={17} /> Profile
            </button>
            <button
              aria-controls="security-panel"
              aria-selected={activeTab === "security"}
              onClick={() => setActiveTab("security")}
              role="tab"
              type="button"
            >
              <ShieldCheck size={17} /> Security
            </button>
          </nav>

          <button
            className="customer-account-signout"
            disabled={signingOut}
            onClick={() => void handleLogout()}
            type="button"
          >
            <LogOut size={17} aria-hidden="true" />
            {signingOut ? "Signing out..." : "Sign out"}
          </button>
        </aside>

        <main className="customer-account-content-v2">
          <header className="customer-account-hero">
            <div>
              <p className="customer-eyebrow">Account center</p>
              <h2>Profile, privacy, and security in one place.</h2>
              <p>Manage only the information and sessions that belong to your customer account.</p>
            </div>
          </header>

          {error || logoutMessage ? (
            <div className="customer-account-alert" role="status">
              {logoutMessage ?? error}
            </div>
          ) : null}

          <section
            aria-labelledby="customer-order-history-title"
            className="customer-account-section"
            hidden={activeTab !== "orders"}
            id="orders-panel"
            role="tabpanel"
          >
            <div className="customer-account-section-heading">
              <div>
                <p className="customer-eyebrow">Pickup activity</p>
                <h2 id="customer-order-history-title">Order history</h2>
                <p>Only orders placed while signed in to this account appear here.</p>
              </div>
              <History aria-hidden="true" size={22} />
            </div>

            {ordersLoading ? (
              <div className="customer-account-state" role="status">
                Loading your orders...
              </div>
            ) : ordersError ? (
              <div className="customer-account-form-error" role="alert">
                {ordersError}
              </div>
            ) : orders.length === 0 ? (
              <div className="customer-account-empty">
                <PackageCheck aria-hidden="true" size={30} />
                <strong>No signed-in orders yet</strong>
                <p>Your next pickup order will appear here when you place it while signed in.</p>
                <button onClick={() => navigate("/shop")} type="button">
                  Browse the shop
                </button>
              </div>
            ) : (
              <div className="customer-account-order-list-v2">
                {orders.map((order) => (
                  <article className="customer-account-order-v2" key={order.id}>
                    <div className="customer-account-order-topline">
                      <div>
                        <span>Order</span>
                        <strong>{order.orderNumber}</strong>
                      </div>
                      <span>{order.status}</span>
                    </div>
                    <div className="customer-account-order-meta">
                      <span>{orderDateFormatter.format(new Date(order.createdAt))}</span>
                      <strong>{formatCurrency(Number(order.totalAmount))}</strong>
                    </div>
                    <ul>
                      {order.items.map((item) => (
                        <li key={`${order.id}-${item.productId}`}>
                          <span>
                            {item.quantity} × {item.productName}
                          </span>
                          <strong>{formatCurrency(Number(item.totalAmount))}</strong>
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section
            aria-labelledby="profile-title"
            className="customer-account-section"
            hidden={activeTab !== "profile"}
            id="profile-panel"
            role="tabpanel"
          >
            <div className="customer-account-section-heading">
              <div>
                <p className="customer-eyebrow">Profile information</p>
                <h2 id="profile-title">Your customer identity</h2>
                <p>
                  Update your display name. Sign-in identifiers stay protected and read-only here.
                </p>
              </div>
              <UserRound aria-hidden="true" size={22} />
            </div>

            <form
              className="customer-account-form"
              onSubmit={(event) => void handleProfileSubmit(event)}
            >
              <label>
                <span>Full name</span>
                <input
                  autoComplete="name"
                  maxLength={120}
                  onChange={(event) => setName(event.target.value)}
                  value={name}
                />
              </label>
              {profileError ? (
                <p className="customer-account-form-error" role="alert">
                  {profileError}
                </p>
              ) : null}
              {profileMessage ? (
                <p className="customer-account-form-success" role="status">
                  {profileMessage}
                </p>
              ) : null}
              <button disabled={savingName || name.trim() === customer.name} type="submit">
                {savingName ? "Saving..." : "Save name"}
              </button>
            </form>

            <div className="customer-account-readonly-grid">
              <div>
                <span>
                  <Mail size={16} /> Email
                </span>
                <strong>{customer.email}</strong>
                <small>Sign-in identifier · changes are not available in this phase.</small>
              </div>
              <div>
                <span>
                  <Phone size={16} /> Mobile
                </span>
                <strong>{customer.phone || "Not provided"}</strong>
                <small>
                  Phone changes require ownership verification and are handled separately.
                </small>
              </div>
            </div>

            <div className="customer-account-username-card">
              <div>
                <span>Username</span>
                <strong>{customer.username ? `@${customer.username}` : "Not set"}</strong>
                <p>
                  {customer.username
                    ? "Your username is a permanent sign-in identifier."
                    : "Legacy accounts can claim one username once. Your current password is required."}
                </p>
              </div>
              {!customer.username ? (
                <form
                  className="customer-account-inline-form"
                  onSubmit={(event) => void handleUsernameClaim(event)}
                >
                  <label>
                    <span>Choose username</span>
                    <input
                      autoCapitalize="none"
                      autoComplete="username"
                      maxLength={30}
                      onChange={(event) => setClaimUsername(event.target.value)}
                      placeholder="your.username"
                      value={claimUsername}
                    />
                  </label>
                  <label>
                    <span>Current password</span>
                    <input
                      autoComplete="current-password"
                      maxLength={128}
                      onChange={(event) => setClaimPassword(event.target.value)}
                      type="password"
                      value={claimPassword}
                    />
                  </label>
                  {usernameError ? (
                    <p className="customer-account-form-error" role="alert">
                      {usernameError}
                    </p>
                  ) : null}
                  {usernameMessage ? (
                    <p className="customer-account-form-success" role="status">
                      {usernameMessage}
                    </p>
                  ) : null}
                  <button disabled={claimingUsername} type="submit">
                    {claimingUsername ? "Claiming..." : "Claim username"}
                  </button>
                </form>
              ) : usernameMessage ? (
                <p className="customer-account-form-success" role="status">
                  {usernameMessage}
                </p>
              ) : null}
            </div>
          </section>

          <section
            aria-labelledby="security-title"
            className="customer-account-section"
            hidden={activeTab !== "security"}
            id="security-panel"
            role="tabpanel"
          >
            <div className="customer-account-section-heading">
              <div>
                <p className="customer-eyebrow">Account security</p>
                <h2 id="security-title">Password and active sessions</h2>
                <p>
                  Sensitive actions require your current password and never expose session secrets.
                </p>
              </div>
              <ShieldCheck aria-hidden="true" size={22} />
            </div>

            <div className="customer-account-security-grid">
              <form
                className="customer-account-security-card"
                onSubmit={(event) => void handlePasswordChange(event)}
              >
                <div className="customer-account-card-title">
                  <KeyRound size={19} />
                  <div>
                    <strong>Change password</strong>
                    <p>
                      Changing it signs out every older session and keeps this browser signed in
                      with a fresh session.
                    </p>
                  </div>
                </div>
                <label>
                  <span>Current password</span>
                  <input
                    autoComplete="current-password"
                    maxLength={128}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    type="password"
                    value={currentPassword}
                  />
                </label>
                <label>
                  <span>New password</span>
                  <input
                    autoComplete="new-password"
                    maxLength={128}
                    minLength={8}
                    onChange={(event) => setNewPassword(event.target.value)}
                    type="password"
                    value={newPassword}
                  />
                </label>
                <label>
                  <span>Confirm new password</span>
                  <input
                    autoComplete="new-password"
                    maxLength={128}
                    minLength={8}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    type="password"
                    value={confirmPassword}
                  />
                </label>
                {passwordError ? (
                  <p className="customer-account-form-error" role="alert">
                    {passwordError}
                  </p>
                ) : null}
                {passwordMessage ? (
                  <p className="customer-account-form-success" role="status">
                    {passwordMessage}
                  </p>
                ) : null}
                <button disabled={changingPassword} type="submit">
                  {changingPassword ? "Changing..." : "Change password"}
                </button>
              </form>

              <div className="customer-account-security-card">
                <div className="customer-account-card-title">
                  <ShieldCheck size={19} />
                  <div>
                    <strong>Active sessions</strong>
                    <p>
                      Only real session timestamps are shown. Device, browser, IP, and location are
                      not collected for this view.
                    </p>
                  </div>
                </div>
                {sessionsLoading ? (
                  <p className="customer-account-muted" role="status">
                    Loading active sessions...
                  </p>
                ) : sessionsError ? (
                  <p className="customer-account-form-error" role="alert">
                    {sessionsError}
                  </p>
                ) : (
                  <div className="customer-account-session-list">
                    {sessions.map((session) => (
                      <article key={session.id} className={session.current ? "is-current" : ""}>
                        <div>
                          <strong>{session.current ? "This session" : "Other session"}</strong>
                          {session.current ? <span>Current</span> : null}
                        </div>
                        <dl>
                          <div>
                            <dt>Created</dt>
                            <dd>{sessionDateFormatter.format(new Date(session.createdAt))}</dd>
                          </div>
                          <div>
                            <dt>Last used</dt>
                            <dd>
                              {session.lastUsedAt
                                ? sessionDateFormatter.format(new Date(session.lastUsedAt))
                                : "Not recorded yet"}
                            </dd>
                          </div>
                          <div>
                            <dt>Expires</dt>
                            <dd>{sessionDateFormatter.format(new Date(session.expiresAt))}</dd>
                          </div>
                        </dl>
                      </article>
                    ))}
                  </div>
                )}
                <form
                  className="customer-account-inline-form"
                  onSubmit={(event) => void handleRevokeSessions(event)}
                >
                  <label>
                    <span>Current password</span>
                    <input
                      autoComplete="current-password"
                      maxLength={128}
                      onChange={(event) => setRevokePassword(event.target.value)}
                      type="password"
                      value={revokePassword}
                    />
                  </label>
                  {sessionActionMessage ? (
                    <p className="customer-account-form-success" role="status">
                      {sessionActionMessage}
                    </p>
                  ) : null}
                  <button disabled={revokingSessions || otherSessionCount === 0} type="submit">
                    {revokingSessions
                      ? "Signing out..."
                      : otherSessionCount > 0
                        ? `Sign out ${otherSessionCount} other session${otherSessionCount === 1 ? "" : "s"}`
                        : "No other active sessions"}
                  </button>
                </form>
              </div>
            </div>
          </section>
        </main>
      </div>
    </section>
  );
}
