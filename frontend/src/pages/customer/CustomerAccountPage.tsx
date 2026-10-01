import {
  CheckCircle2,
  ChevronDown,
  Heart,
  History,
  KeyRound,
  LogOut,
  Mail,
  PackageCheck,
  MapPin,
  Phone,
  Truck,
  ShieldCheck,
  UserRound
} from "lucide-react";
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";

import { ProductCard, formatCurrency } from "@/components/customer/ProductCard";
import { AppPagination } from "@/components/shared/AppPagination";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { useCustomerFavorites } from "@/context/CustomerFavoritesContext";
import {
  CustomerAccountRequestError,
  changeCustomerPassword,
  fetchCustomerSessions,
  revokeOtherCustomerSessions,
  updateCustomerProfile
} from "@/services/customerAccountService";
import { fetchCustomerAddress, updateCustomerAddress } from "@/services/customerAddressService";
import { confirmCustomerDeliveryReceived, fetchCustomerOrders } from "@/services/storefrontService";
import type { CustomerSessionSummary } from "@/types/customerAccount";
import { EMPTY_CUSTOMER_ADDRESS, type CustomerAddress } from "@/types/customerAddress";
import type { StorefrontOrder } from "@/types/storefront";

const orderDateFormatter = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short"
});
const sessionDateFormatter = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short"
});

const DELIVERY_PROGRESS_STEPS: Array<{
  status: StorefrontOrder["deliveryStatus"];
  label: string;
}> = [
  { status: "ORDER_PLACED", label: "Order placed" },
  { status: "PREPARING", label: "Preparing" },
  { status: "READY_FOR_DELIVERY", label: "Ready" },
  { status: "OUT_FOR_DELIVERY", label: "On the way" },
  { status: "DELIVERED", label: "Delivered" }
];

type AccountTab = "orders" | "favorites" | "profile" | "security";

const ACCOUNT_HERO_CONTENT: Record<
  AccountTab,
  { eyebrow: string; title: string; description: string }
> = {
  orders: {
    eyebrow: "Order center",
    title: "Your orders, organized.",
    description:
      "Track active deliveries, courier progress, payment state, and your recent order history in one focused view."
  },
  favorites: {
    eyebrow: "Saved items",
    title: "Favorites, ready when you are.",
    description:
      "Keep products you want to revisit in one clean list, with live price, rating, and stock status."
  },
  profile: {
    eyebrow: "Profile",
    title: "Your details, ready for checkout.",
    description:
      "Keep your customer name, delivery contact, and default address current for faster repeat purchases."
  },
  security: {
    eyebrow: "Account security",
    title: "Protect your account.",
    description:
      "Manage your password and active sessions with security controls built around your customer account."
  }
};

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
  const { favoriteProducts, loading: favoritesLoading } = useCustomerFavorites();
  const [activeTab, setActiveTab] = useState<AccountTab>("orders");
  const [orders, setOrders] = useState<StorefrontOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [confirmingOrder, setConfirmingOrder] = useState<string | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const historyPageSize = 5;
  const [sessions, setSessions] = useState<CustomerSessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [logoutMessage, setLogoutMessage] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [contactPhone, setContactPhone] = useState("");
  const [savingContactPhone, setSavingContactPhone] = useState(false);
  const [contactMessage, setContactMessage] = useState<string | null>(null);
  const [contactError, setContactError] = useState<string | null>(null);

  const [savedAddress, setSavedAddress] = useState<CustomerAddress | null>(null);
  const [addressDraft, setAddressDraft] = useState<CustomerAddress>(EMPTY_CUSTOMER_ADDRESS);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressEditing, setAddressEditing] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [addressMessage, setAddressMessage] = useState<string | null>(null);
  const [addressError, setAddressError] = useState<string | null>(null);

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
    if (!customer) return;
    setName(customer.name);
    setContactPhone(customer.defaultContactPhone ?? customer.phone ?? "");
  }, [customer]);

  useEffect(() => {
    if (!customer) return;

    const controller = new AbortController();
    let active = true;
    setAddressLoading(true);
    setAddressError(null);

    void fetchCustomerAddress(controller.signal)
      .then((address) => {
        if (!active) return;
        setSavedAddress(address);
        setAddressDraft(address ?? EMPTY_CUSTOMER_ADDRESS);
        setAddressEditing(!address);
      })
      .catch((reason) => {
        if (!active) return;
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setSavedAddress(null);
        setAddressDraft(EMPTY_CUSTOMER_ADDRESS);
        setAddressEditing(true);
        setAddressError(errorMessage(reason, "Your saved delivery address could not be loaded."));
      })
      .finally(() => {
        if (active) setAddressLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
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
        setOrdersError(
          errorMessage(ordersResult.reason, "Your order history could not be loaded.")
        );
      }

      if (sessionsResult.status === "fulfilled") {
        setSessions(sessionsResult.value);
      } else if (
        !(
          sessionsResult.reason instanceof DOMException &&
          sessionsResult.reason.name === "AbortError"
        )
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
  const heroContent = ACCOUNT_HERO_CONTENT[activeTab];
  const activeOrders = useMemo(
    () => orders.filter((order) => !["DELIVERED", "CANCELLED"].includes(order.deliveryStatus)),
    [orders]
  );
  const historicalOrders = useMemo(
    () => orders.filter((order) => ["DELIVERED", "CANCELLED"].includes(order.deliveryStatus)),
    [orders]
  );
  const historyTotalPages = Math.max(1, Math.ceil(historicalOrders.length / historyPageSize));
  const paginatedHistoricalOrders = useMemo(
    () =>
      historicalOrders.slice(
        (historyPage - 1) * historyPageSize,
        historyPage * historyPageSize
      ),
    [historicalOrders, historyPage]
  );

  useEffect(() => {
    if (historyPage > historyTotalPages) setHistoryPage(historyTotalPages);
  }, [historyPage, historyTotalPages]);

  async function handleConfirmReceived(orderNumber: string) {
    if (confirmingOrder) return;
    setConfirmingOrder(orderNumber);
    setOrdersError(null);
    try {
      const updated = await confirmCustomerDeliveryReceived(orderNumber);
      setOrders((current) =>
        current.map((order) => (order.orderNumber === updated.orderNumber ? updated : order))
      );
    } catch (reason) {
      setOrdersError(errorMessage(reason, "Delivery receipt could not be confirmed."));
    } finally {
      setConfirmingOrder(null);
    }
  }

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

  async function handleContactSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setContactMessage(null);
    setContactError(null);

    const trimmedPhone = contactPhone.trim();
    if (trimmedPhone.length < 7) {
      setContactError("Enter a valid delivery contact number.");
      return;
    }

    setSavingContactPhone(true);
    try {
      await updateCustomerProfile({ defaultContactPhone: trimmedPhone });
      await refreshSession();
      setContactMessage("Default delivery contact updated.");
    } catch (reason) {
      setContactError(errorMessage(reason, "Your delivery contact could not be updated."));
    } finally {
      setSavingContactPhone(false);
    }
  }

  function updateAddressDraft(event: ChangeEvent<HTMLInputElement>) {
    const field = event.currentTarget.name as keyof CustomerAddress;
    const value = event.currentTarget.value;
    setAddressDraft((current) => ({ ...current, [field]: value }));
  }

  async function handleAddressSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAddressMessage(null);
    setAddressError(null);
    setSavingAddress(true);

    try {
      const updated = await updateCustomerAddress(addressDraft);
      setSavedAddress(updated);
      setAddressDraft(updated);
      setAddressEditing(false);
      setAddressMessage("Default delivery address updated.");
    } catch (reason) {
      setAddressError(errorMessage(reason, "Your delivery address could not be updated."));
    } finally {
      setSavingAddress(false);
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
              <p>Customer account</p>
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
              aria-controls="favorites-panel"
              aria-selected={activeTab === "favorites"}
              onClick={() => setActiveTab("favorites")}
              role="tab"
              type="button"
            >
              <Heart size={17} /> Favorites
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
          <header className={`customer-account-hero customer-account-hero--${activeTab}`}>
            <div className="customer-account-hero__content" key={activeTab}>
              <div>
                <p className="customer-eyebrow">{heroContent.eyebrow}</p>
                <h2>{heroContent.title}</h2>
                <p>{heroContent.description}</p>
              </div>
              <span className="customer-account-hero__icon" aria-hidden="true">
                {activeTab === "orders" ? (
                  <History size={28} />
                ) : activeTab === "favorites" ? (
                  <Heart size={28} />
                ) : activeTab === "profile" ? (
                  <UserRound size={28} />
                ) : (
                  <ShieldCheck size={28} />
                )}
              </span>
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
                <p className="customer-eyebrow">Active orders</p>
                <h2 id="customer-order-history-title">Delivery tracking</h2>
                <p>
                  Follow each signed-in order from preparation through customer-confirmed delivery.
                </p>
              </div>
              <Truck aria-hidden="true" size={22} />
            </div>

            {ordersLoading ? (
              <div className="customer-account-state" role="status">
                Loading your orders...
              </div>
            ) : orders.length === 0 ? (
              <div className="customer-account-empty">
                <PackageCheck aria-hidden="true" size={30} />
                <strong>No signed-in orders yet</strong>
                <p>Your next delivery order will appear here when you place it while signed in.</p>
                <button onClick={() => navigate("/shop")} type="button">
                  Browse the shop
                </button>
              </div>
            ) : (
              <>
                {ordersError ? (
                  <div className="customer-account-form-error" role="alert">
                    {ordersError}
                  </div>
                ) : null}

                {activeOrders.length > 0 ? (
                  <div className="customer-account-delivery-stack">
                    {activeOrders.map((order) => (
                      <article
                        className="customer-account-order-v2 customer-account-order-v2--active"
                        key={order.id}
                      >
                        <div className="customer-account-order-topline">
                          <div>
                            <span>{order.deliveryTicketNumber}</span>
                            <strong>{order.orderNumber}</strong>
                          </div>
                          <span
                            className={`customer-delivery-status customer-delivery-status--${order.deliveryStatus.toLowerCase()}`}
                          >
                            {deliveryStatusLabel(order.deliveryStatus)}
                          </span>
                        </div>

                        <div className="customer-account-delivery-overview">
                          <div>
                            <span>Payment</span>
                            <strong>
                              {order.paymentMethod === "CASH_ON_DELIVERY"
                                ? "Cash on Delivery"
                                : `PayMongo · ${order.paymentStatus}`}
                            </strong>
                          </div>
                          <div>
                            <span>Total</span>
                            <strong>{formatCurrency(Number(order.totalAmount))}</strong>
                          </div>
                          <div>
                            <span>Ordered</span>
                            <strong>{orderDateFormatter.format(new Date(order.createdAt))}</strong>
                          </div>
                        </div>

                        {order.address ? (
                          <div className="customer-account-delivery-address">
                            <MapPin aria-hidden="true" size={17} />
                            <span>
                              {[
                                order.address.addressLine1,
                                order.address.addressLine2,
                                order.address.barangay,
                                order.address.cityMunicipality,
                                order.address.provinceRegion,
                                order.address.postalCode
                              ]
                                .filter(Boolean)
                                .join(", ")}
                            </span>
                          </div>
                        ) : null}

                        {order.courierProvider ? (
                          <div className="customer-account-delivery-courier">
                            <Truck aria-hidden="true" size={17} />
                            <span>
                              <strong>{order.courierProvider}</strong>
                              {order.courierReference ? ` · ${order.courierReference}` : ""}
                            </span>
                          </div>
                        ) : null}

                        <DeliveryProgress order={order} />

                        {order.canCustomerConfirmReceipt ? (
                          <div className="customer-account-confirm-delivery">
                            <div>
                              <strong>Have you received your order?</strong>
                              <p>Only confirm after the order is physically in your possession.</p>
                            </div>
                            <button
                              disabled={confirmingOrder === order.orderNumber}
                              onClick={() => void handleConfirmReceived(order.orderNumber)}
                              type="button"
                            >
                              <CheckCircle2 aria-hidden="true" size={17} />
                              {confirmingOrder === order.orderNumber
                                ? "Confirming..."
                                : "Confirm received"}
                            </button>
                          </div>
                        ) : null}
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="customer-account-state">No active deliveries right now.</div>
                )}

                <div className="customer-account-history-heading">
                  <div>
                    <p className="customer-eyebrow">Order history</p>
                    <h3>Delivered and closed orders</h3>
                  </div>
                  <History aria-hidden="true" size={20} />
                </div>

                {historicalOrders.length > 0 ? (
                  <div className="customer-account-order-list-v2">
                    {paginatedHistoricalOrders.map((order) => (
                      <details className="customer-account-history-card" key={order.id}>
                        <summary>
                          <div className="customer-account-history-card__identity">
                            <span>{order.deliveryTicketNumber}</span>
                            <strong>{order.orderNumber}</strong>
                            <small>{orderDateFormatter.format(new Date(order.createdAt))}</small>
                          </div>
                          <div className="customer-account-history-card__summary">
                            <span>
                              {order.itemCount} item{order.itemCount === 1 ? "" : "s"}
                            </span>
                            <strong>{formatCurrency(Number(order.totalAmount))}</strong>
                            <span
                              className={`customer-delivery-status customer-delivery-status--${order.deliveryStatus.toLowerCase()}`}
                            >
                              {deliveryStatusLabel(order.deliveryStatus)}
                            </span>
                            <ChevronDown aria-hidden="true" size={18} />
                          </div>
                        </summary>
                        <div className="customer-account-history-card__details">
                          <div className="customer-account-history-card__payment">
                            <span>Payment</span>
                            <strong>
                              {order.paymentMethod === "CASH_ON_DELIVERY"
                                ? order.paymentStatus === "PAID"
                                  ? "Cash on Delivery · Payment received"
                                  : "Cash on Delivery"
                                : `PayMongo · ${order.paymentStatus}`}
                            </strong>
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
                        </div>
                      </details>
                    ))}
                  </div>
                  {historicalOrders.length > historyPageSize ? (
                    <AppPagination
                      className="customer-account-history-pagination"
                      itemLabel="orders"
                      onPageChange={setHistoryPage}
                      page={historyPage}
                      pageSize={historyPageSize}
                      totalItems={historicalOrders.length}
                      totalPages={historyTotalPages}
                    />
                  ) : null}
                ) : (
                  <div className="customer-account-state">No completed delivery history yet.</div>
                )}
              </>
            )}
          </section>

          <section
            aria-labelledby="favorites-title"
            className="customer-account-section"
            hidden={activeTab !== "favorites"}
            id="favorites-panel"
            role="tabpanel"
          >
            <div className="customer-account-section-heading">
              <div>
                <p className="customer-eyebrow">Saved for later</p>
                <h2 id="favorites-title">Your favorites</h2>
                <p>Products saved with the heart button stay connected to this customer account.</p>
              </div>
              <Heart aria-hidden="true" size={22} />
            </div>

            {favoritesLoading ? (
              <div className="customer-account-state" role="status">
                Loading your favorites...
              </div>
            ) : favoriteProducts.length === 0 ? (
              <div className="customer-account-empty">
                <Heart aria-hidden="true" size={30} />
                <strong>No favorites yet</strong>
                <p>Save products with the heart icon while browsing the storefront.</p>
                <button onClick={() => navigate("/shop")} type="button">
                  Browse the shop
                </button>
              </div>
            ) : (
              <div className="customer-account-favorites-grid">
                {favoriteProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    navigate={navigate}
                    presentation="catalog"
                    product={product}
                  />
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
                <h2 id="profile-title">Your shopping profile</h2>
                <p>Manage the details Ysabelle Store can reuse for faster delivery checkout.</p>
              </div>
              <UserRound aria-hidden="true" size={22} />
            </div>

            <div className="customer-account-profile-stack">
              <form
                className="customer-account-inline-action-form"
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
                <button disabled={savingName || name.trim() === customer.name} type="submit">
                  {savingName ? "Saving..." : "Save"}
                </button>
                {profileError ? (
                  <p
                    className="customer-account-form-error customer-account-form-message"
                    role="alert"
                  >
                    {profileError}
                  </p>
                ) : null}
                {profileMessage ? (
                  <p
                    className="customer-account-form-success customer-account-form-message"
                    role="status"
                  >
                    {profileMessage}
                  </p>
                ) : null}
              </form>

              <div className="customer-account-profile-grid">
                <div className="customer-account-info-card">
                  <span>
                    <Mail size={16} /> Sign-in email
                  </span>
                  <strong>{customer.email}</strong>
                  <small>
                    Protected account identifier. Checkout can use it for order communication.
                  </small>
                </div>

                <form
                  className="customer-account-contact-card"
                  onSubmit={(event) => void handleContactSubmit(event)}
                >
                  <label>
                    <span>
                      <Phone size={16} /> Default contact mobile
                    </span>
                    <input
                      autoComplete="tel"
                      maxLength={40}
                      minLength={7}
                      onChange={(event) => setContactPhone(event.target.value)}
                      placeholder="0917 123 4567"
                      required
                      type="tel"
                      value={contactPhone}
                    />
                  </label>
                  <small>
                    Used for orders and delivery coordination. This does not replace a protected
                    sign-in phone number.
                  </small>
                  <button
                    disabled={
                      savingContactPhone ||
                      contactPhone.trim() === (customer.defaultContactPhone ?? customer.phone ?? "")
                    }
                    type="submit"
                  >
                    {savingContactPhone ? "Saving..." : "Save contact"}
                  </button>
                  {contactError ? (
                    <p className="customer-account-form-error" role="alert">
                      {contactError}
                    </p>
                  ) : null}
                  {contactMessage ? (
                    <p className="customer-account-form-success" role="status">
                      {contactMessage}
                    </p>
                  ) : null}
                </form>
              </div>

              <div className="customer-account-address-card">
                <div className="customer-account-address-heading">
                  <div>
                    <span>
                      <MapPin size={17} /> Default delivery address
                    </span>
                    <p>
                      Automatically offered on your next checkout. You can still use another address
                      per order.
                    </p>
                  </div>
                  {savedAddress && !addressEditing ? (
                    <button onClick={() => setAddressEditing(true)} type="button">
                      Edit address
                    </button>
                  ) : null}
                </div>

                {addressLoading ? (
                  <p className="customer-account-muted" role="status">
                    Loading saved delivery address...
                  </p>
                ) : savedAddress && !addressEditing ? (
                  <address className="customer-account-address-summary">
                    <strong>{savedAddress.addressLine1}</strong>
                    {savedAddress.addressLine2 ? <span>{savedAddress.addressLine2}</span> : null}
                    <span>{savedAddress.barangay}</span>
                    <span>
                      {savedAddress.cityMunicipality}, {savedAddress.provinceRegion}{" "}
                      {savedAddress.postalCode}
                    </span>
                    <span>{savedAddress.country}</span>
                  </address>
                ) : (
                  <form
                    className="customer-account-address-form"
                    onSubmit={(event) => void handleAddressSubmit(event)}
                  >
                    <label className="customer-account-address-form__full">
                      <span>Address line 1</span>
                      <input
                        autoComplete="address-line1"
                        maxLength={180}
                        minLength={3}
                        name="addressLine1"
                        onChange={updateAddressDraft}
                        placeholder="House / unit number and street"
                        required
                        value={addressDraft.addressLine1}
                      />
                    </label>
                    <label className="customer-account-address-form__full">
                      <span>
                        Address line 2 <small>(optional)</small>
                      </span>
                      <input
                        autoComplete="address-line2"
                        maxLength={180}
                        name="addressLine2"
                        onChange={updateAddressDraft}
                        placeholder="Building, subdivision, landmark"
                        value={addressDraft.addressLine2}
                      />
                    </label>
                    <label>
                      <span>Barangay</span>
                      <input
                        maxLength={120}
                        minLength={2}
                        name="barangay"
                        onChange={updateAddressDraft}
                        required
                        value={addressDraft.barangay}
                      />
                    </label>
                    <label>
                      <span>City / Municipality</span>
                      <input
                        autoComplete="address-level2"
                        maxLength={120}
                        minLength={2}
                        name="cityMunicipality"
                        onChange={updateAddressDraft}
                        required
                        value={addressDraft.cityMunicipality}
                      />
                    </label>
                    <label>
                      <span>Province / Region</span>
                      <input
                        autoComplete="address-level1"
                        maxLength={120}
                        minLength={2}
                        name="provinceRegion"
                        onChange={updateAddressDraft}
                        required
                        value={addressDraft.provinceRegion}
                      />
                    </label>
                    <label>
                      <span>Postal code</span>
                      <input
                        autoComplete="postal-code"
                        inputMode="numeric"
                        maxLength={20}
                        minLength={3}
                        name="postalCode"
                        onChange={updateAddressDraft}
                        required
                        value={addressDraft.postalCode}
                      />
                    </label>
                    <label className="customer-account-address-form__full">
                      <span>Country</span>
                      <input readOnly value="Philippines" />
                    </label>
                    <div className="customer-account-address-actions">
                      <button disabled={savingAddress} type="submit">
                        {savingAddress ? "Saving..." : "Save address"}
                      </button>
                      {savedAddress ? (
                        <button
                          className="customer-account-secondary-button"
                          onClick={() => {
                            setAddressDraft(savedAddress ?? EMPTY_CUSTOMER_ADDRESS);
                            setAddressEditing(false);
                            setAddressError(null);
                          }}
                          type="button"
                        >
                          Cancel
                        </button>
                      ) : null}
                    </div>
                  </form>
                )}

                {addressError ? (
                  <p className="customer-account-form-error" role="alert">
                    {addressError}
                  </p>
                ) : null}
                {addressMessage ? (
                  <p className="customer-account-form-success" role="status">
                    {addressMessage}
                  </p>
                ) : null}
              </div>
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

function DeliveryProgress({ order }: { order: StorefrontOrder }) {
  const eventByStatus = new Map(order.timeline.map((event) => [event.status, event] as const));

  return (
    <div className="customer-delivery-progress" aria-label="Delivery progress">
      <ol className="customer-delivery-stepper">
        {DELIVERY_PROGRESS_STEPS.map((step, index) => {
          const event = eventByStatus.get(step.status);
          const isCurrent = order.deliveryStatus === step.status;
          const isComplete = Boolean(event);

          return (
            <li
              className={[isComplete ? "is-complete" : "", isCurrent ? "is-current" : ""]
                .filter(Boolean)
                .join(" ")}
              key={step.status}
            >
              <div className="customer-delivery-stepper__track">
                <span className="customer-delivery-stepper__marker" aria-hidden="true">
                  {isComplete ? <CheckCircle2 size={15} /> : index + 1}
                </span>
                {index < DELIVERY_PROGRESS_STEPS.length - 1 ? (
                  <span className="customer-delivery-stepper__connector" aria-hidden="true" />
                ) : null}
              </div>
              <div className="customer-delivery-stepper__copy">
                <strong>{step.label}</strong>
                <small>
                  {event ? orderDateFormatter.format(new Date(event.createdAt)) : "Pending"}
                </small>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function deliveryStatusLabel(status: StorefrontOrder["deliveryStatus"]) {
  switch (status) {
    case "ORDER_PLACED":
      return "Order placed";
    case "PREPARING":
      return "Preparing";
    case "READY_FOR_DELIVERY":
      return "Ready for delivery";
    case "OUT_FOR_DELIVERY":
      return "On the way";
    case "DELIVERED":
      return "Delivered";
    case "DELIVERY_FAILED":
      return "Delivery failed";
    case "CANCELLED":
      return "Cancelled";
  }
}
