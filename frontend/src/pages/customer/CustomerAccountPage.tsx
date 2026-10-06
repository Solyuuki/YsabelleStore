import {
  CheckCircle2,
  ChevronDown,
  CreditCard,
  Heart,
  History,
  Eye,
  EyeOff,
  KeyRound,
  LogOut,
  Mail,
  PackageCheck,
  MapPin,
  Phone,
  RefreshCw,
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
  fetchCustomerSecuritySummary,
  fetchCustomerSessions,
  requestCustomerPasswordSetup,
  requestCustomerSessionRevokeVerification,
  revokeOtherCustomerSessions,
  setupCustomerPassword,
  updateCustomerProfile,
  verifyCustomerPasswordSetup,
  verifyCustomerSessionRevokeVerification
} from "@/services/customerAccountService";
import { fetchCustomerAddress, updateCustomerAddress } from "@/services/customerAddressService";
import {
  confirmCustomerDeliveryReceived,
  fetchCustomerOrders,
  startPaymongoCheckout
} from "@/services/storefrontService";
import type { CustomerSecuritySummary, CustomerSessionSummary } from "@/types/customerAccount";
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

const PASSWORD_SETUP_CODE_LIFETIME_MS = 10 * 60 * 1000;
const PASSWORD_SETUP_RESEND_COOLDOWN_MS = 45 * 1000;

function formatPasswordSetupCountdown(remainingMs: number) {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

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
  const [resumingPaymentOrder, setResumingPaymentOrder] = useState<string | null>(null);
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
  const [securitySummary, setSecuritySummary] = useState<CustomerSecuritySummary | null>(null);
  const [securitySummaryLoading, setSecuritySummaryLoading] = useState(true);
  const [passwordSetupStage, setPasswordSetupStage] = useState<
    "idle" | "verify" | "password"
  >("idle");
  const [passwordSetupCode, setPasswordSetupCode] = useState("");
  const [passwordSetupExpiresAt, setPasswordSetupExpiresAt] = useState<number | null>(null);
  const [passwordSetupResendAt, setPasswordSetupResendAt] = useState<number | null>(null);
  const [passwordSetupClock, setPasswordSetupClock] = useState(() => Date.now());
  const [setupPassword, setSetupPassword] = useState("");
  const [setupConfirmPassword, setSetupConfirmPassword] = useState("");
  const [passwordSetupBusy, setPasswordSetupBusy] = useState(false);

  const [revokePassword, setRevokePassword] = useState("");
  const [revokeConfirmationOpen, setRevokeConfirmationOpen] = useState(false);
  const [sessionRevokeVerificationStage, setSessionRevokeVerificationStage] = useState<
    "idle" | "verify"
  >("idle");
  const [sessionRevokeVerificationCode, setSessionRevokeVerificationCode] = useState("");
  const [sessionRevokeExpiresAt, setSessionRevokeExpiresAt] = useState<number | null>(null);
  const [sessionRevokeResendAt, setSessionRevokeResendAt] = useState<number | null>(null);
  const [sessionRevokeClock, setSessionRevokeClock] = useState(() => Date.now());
  const [sessionRevokeVerificationBusy, setSessionRevokeVerificationBusy] = useState(false);
  const [revokingSessions, setRevokingSessions] = useState(false);
  const [sessionActionMessage, setSessionActionMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!customer) return;
    setName(customer.name);
    setContactPhone(customer.defaultContactPhone ?? customer.phone ?? "");
  }, [customer]);

  useEffect(() => {
    if (passwordSetupStage !== "verify") return;

    const updateClock = () => setPasswordSetupClock(Date.now());
    updateClock();
    const interval = window.setInterval(updateClock, 1000);

    return () => window.clearInterval(interval);
  }, [passwordSetupStage]);

  useEffect(() => {
    if (sessionRevokeVerificationStage !== "verify") return;

    const updateClock = () => setSessionRevokeClock(Date.now());
    updateClock();
    const interval = window.setInterval(updateClock, 1000);

    return () => window.clearInterval(interval);
  }, [sessionRevokeVerificationStage]);

  useEffect(() => {
    if (!customer) return;

    const controller = new AbortController();
    let active = true;
    setSecuritySummaryLoading(true);

    void fetchCustomerSecuritySummary(controller.signal)
      .then((summary) => {
        if (!active) return;
        setSecuritySummary(summary);
      })
      .catch((reason) => {
        if (!active) return;
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setSecuritySummary(null);
        setPasswordError(errorMessage(reason, "Account security details could not be loaded."));
      })
      .finally(() => {
        if (active) setSecuritySummaryLoading(false);
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
      historicalOrders.slice((historyPage - 1) * historyPageSize, historyPage * historyPageSize),
    [historicalOrders, historyPage]
  );

  useEffect(() => {
    if (historyPage > historyTotalPages) setHistoryPage(historyTotalPages);
  }, [historyPage, historyTotalPages]);

  async function handleResumePaymongo(orderNumber: string) {
    if (resumingPaymentOrder) return;
    setResumingPaymentOrder(orderNumber);
    setOrdersError(null);
    try {
      const checkout = await startPaymongoCheckout(orderNumber);
      window.location.assign(checkout.checkoutUrl);
    } catch (reason) {
      setOrdersError(errorMessage(reason, "PayMongo checkout could not be reopened."));
      setResumingPaymentOrder(null);
    }
  }

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

  async function refreshSecuritySummary() {
    const summary = await fetchCustomerSecuritySummary();
    setSecuritySummary(summary);
    return summary;
  }

  async function handlePasswordSetupRequest() {
    if (!customer || passwordSetupBusy) return;
    if (
      passwordSetupStage === "verify" &&
      passwordSetupResendAt !== null &&
      Date.now() < passwordSetupResendAt
    ) {
      return;
    }

    setPasswordError(null);
    setPasswordMessage(null);
    setPasswordSetupBusy(true);
    try {
      await requestCustomerPasswordSetup();
      const sentAt = Date.now();
      setPasswordSetupCode("");
      setPasswordSetupClock(sentAt);
      setPasswordSetupExpiresAt(sentAt + PASSWORD_SETUP_CODE_LIFETIME_MS);
      setPasswordSetupResendAt(sentAt + PASSWORD_SETUP_RESEND_COOLDOWN_MS);
      setPasswordSetupStage("verify");
    } catch (reason) {
      setPasswordError(errorMessage(reason, "A password setup code could not be sent."));
    } finally {
      setPasswordSetupBusy(false);
    }
  }

  async function handlePasswordSetupVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError(null);
    setPasswordMessage(null);

    if (passwordSetupExpiresAt !== null && Date.now() >= passwordSetupExpiresAt) {
      setPasswordError("This verification code has expired. Resend a new code to continue.");
      return;
    }
    if (!/^\d{6}$/.test(passwordSetupCode.trim())) {
      setPasswordError("Enter the 6-digit verification code from your email.");
      return;
    }

    setPasswordSetupBusy(true);
    try {
      await verifyCustomerPasswordSetup(passwordSetupCode.trim());
      setPasswordSetupCode("");
      setPasswordSetupExpiresAt(null);
      setPasswordSetupResendAt(null);
      setPasswordSetupStage("password");
      setPasswordMessage("Identity verified. Create your Ysabelle Store password.");
    } catch (reason) {
      setPasswordError(errorMessage(reason, "The verification code could not be verified."));
    } finally {
      setPasswordSetupBusy(false);
    }
  }

  async function handleFirstPasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError(null);
    setPasswordMessage(null);

    if (setupPassword.length < 8 || setupPassword.length > 128) {
      setPasswordError("Password must be between 8 and 128 characters.");
      return;
    }
    if (setupPassword !== setupConfirmPassword) {
      setPasswordError("Password and confirmation do not match.");
      return;
    }

    setPasswordSetupBusy(true);
    try {
      await setupCustomerPassword(setupPassword);
      await refreshSession();
      await refreshSecuritySummary();
      const refreshedSessions = await fetchCustomerSessions();
      setSessions(refreshedSessions);
      setSetupPassword("");
      setSetupConfirmPassword("");
      setPasswordSetupExpiresAt(null);
      setPasswordSetupResendAt(null);
      setPasswordSetupStage("idle");
      setPasswordMessage(
        "Password added. You can now sign in with either Quick Sign or your email and password."
      );
    } catch (reason) {
      setPasswordError(errorMessage(reason, "Your password could not be added."));
    } finally {
      setPasswordSetupBusy(false);
    }
  }

  function resetSessionRevokeVerification() {
    setSessionRevokeVerificationStage("idle");
    setSessionRevokeVerificationCode("");
    setSessionRevokeExpiresAt(null);
    setSessionRevokeResendAt(null);
    setSessionRevokeVerificationBusy(false);
  }

  function closeRevokeConfirmation() {
    setRevokePassword("");
    setSessionsError(null);
    setRevokeConfirmationOpen(false);
    resetSessionRevokeVerification();
  }

  async function handleSessionRevokeVerificationRequest() {
    if (sessionRevokeVerificationBusy) return;
    if (
      sessionRevokeVerificationStage === "verify" &&
      sessionRevokeResendAt !== null &&
      Date.now() < sessionRevokeResendAt
    ) {
      return;
    }

    setSessionsError(null);
    setSessionActionMessage(null);
    setSessionRevokeVerificationBusy(true);
    try {
      await requestCustomerSessionRevokeVerification();
      const sentAt = Date.now();
      setSessionRevokeVerificationCode("");
      setSessionRevokeClock(sentAt);
      setSessionRevokeExpiresAt(sentAt + PASSWORD_SETUP_CODE_LIFETIME_MS);
      setSessionRevokeResendAt(sentAt + PASSWORD_SETUP_RESEND_COOLDOWN_MS);
      setSessionRevokeVerificationStage("verify");
    } catch (reason) {
      setSessionsError(
        errorMessage(reason, "A security verification code could not be sent.")
      );
    } finally {
      setSessionRevokeVerificationBusy(false);
    }
  }

  async function handleSessionRevokeOtpSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSessionsError(null);
    setSessionActionMessage(null);

    if (sessionRevokeExpiresAt !== null && Date.now() >= sessionRevokeExpiresAt) {
      setSessionsError("This verification code has expired. Resend a new code to continue.");
      return;
    }
    if (!/^\d{6}$/.test(sessionRevokeVerificationCode.trim())) {
      setSessionsError("Enter the 6-digit verification code from your email.");
      return;
    }

    setSessionRevokeVerificationBusy(true);
    try {
      await verifyCustomerSessionRevokeVerification(sessionRevokeVerificationCode.trim());
      const result = await revokeOtherCustomerSessions();
      const refreshedSessions = await fetchCustomerSessions();
      setSessions(refreshedSessions);
      setRevokeConfirmationOpen(false);
      resetSessionRevokeVerification();
      setSessionActionMessage(
        result.revokedCount > 0
          ? `${result.revokedCount} other session${result.revokedCount === 1 ? "" : "s"} signed out.`
          : "No other active sessions needed to be signed out."
      );
    } catch (reason) {
      setSessionsError(errorMessage(reason, "Other sessions could not be signed out."));
    } finally {
      setSessionRevokeVerificationBusy(false);
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
      setRevokeConfirmationOpen(false);
      resetSessionRevokeVerification();
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

  const sessionRevokeExpiresInMs =
    sessionRevokeExpiresAt === null ? 0 : Math.max(0, sessionRevokeExpiresAt - sessionRevokeClock);
  const sessionRevokeResendInMs =
    sessionRevokeResendAt === null ? 0 : Math.max(0, sessionRevokeResendAt - sessionRevokeClock);
  const sessionRevokeCodeExpired =
    sessionRevokeExpiresAt !== null && sessionRevokeExpiresInMs === 0;
  const sessionRevokeResendReady =
    sessionRevokeResendAt === null || sessionRevokeResendInMs === 0;

  const passwordSetupExpiresInMs =
    passwordSetupExpiresAt === null ? 0 : Math.max(0, passwordSetupExpiresAt - passwordSetupClock);
  const passwordSetupResendInMs =
    passwordSetupResendAt === null ? 0 : Math.max(0, passwordSetupResendAt - passwordSetupClock);
  const passwordSetupCodeExpired =
    passwordSetupExpiresAt !== null && passwordSetupExpiresInMs === 0;
  const passwordSetupResendReady =
    passwordSetupResendAt === null || passwordSetupResendInMs === 0;

  return (
    <section className="customer-account-page-v2 ys-glass-flow-background">
      <div className="customer-account-layout-v2">
        <aside className="customer-account-rail ys-material-surface" aria-label="Account sections">
          <div className="customer-account-identity-card">
            <div className="customer-account-avatar ys-material-accent" aria-hidden="true">
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
          <header className={`customer-account-hero ys-material-surface customer-account-hero--${activeTab}`}>
            <div className="customer-account-hero__content" key={activeTab}>
              <div>
                <p className="customer-eyebrow">{heroContent.eyebrow}</p>
                <h2>{heroContent.title}</h2>
                <p>{heroContent.description}</p>
              </div>
              <span className="customer-account-hero__icon ys-material-accent" aria-hidden="true">
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
            className="customer-account-section ys-material-surface"
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
                            className={`customer-delivery-status ${
                              isPaymongoAwaitingPayment(order)
                                ? "customer-delivery-status--awaiting-payment"
                                : `customer-delivery-status--${order.deliveryStatus.toLowerCase()}`
                            }`}
                          >
                            {isPaymongoAwaitingPayment(order)
                              ? "Awaiting payment"
                              : deliveryStatusLabel(order.deliveryStatus)}
                          </span>
                        </div>

                        <div className="customer-account-delivery-overview">
                          <div>
                            <span>Payment</span>
                            <strong>
                              {order.paymentMethod === "CASH_ON_DELIVERY"
                                ? "Cash on Delivery"
                                : order.paymentStatus === "PAID"
                                  ? "PayMongo · Paid"
                                  : "PayMongo · Awaiting payment"}
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

                        {isPaymongoAwaitingPayment(order) ? (
                          <div className="customer-account-payment-gate">
                            <CreditCard aria-hidden="true" size={20} />
                            <div>
                              <strong>Payment required before delivery starts</strong>
                              <p>
                                This order is saved, but Ysabelle Store will not prepare or dispatch
                                it until PayMongo confirms the payment.
                              </p>
                            </div>
                            <button
                              disabled={resumingPaymentOrder === order.orderNumber}
                              onClick={() => void handleResumePaymongo(order.orderNumber)}
                              type="button"
                            >
                              <RefreshCw aria-hidden="true" size={16} />
                              {resumingPaymentOrder === order.orderNumber
                                ? "Opening PayMongo..."
                                : "Resume payment"}
                            </button>
                          </div>
                        ) : (
                          <DeliveryProgress order={order} />
                        )}

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
                  <>
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
                  </>
                ) : (
                  <div className="customer-account-state">No completed delivery history yet.</div>
                )}
              </>
            )}
          </section>

          <section
            aria-labelledby="favorites-title"
            className="customer-account-section ys-material-surface"
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
            className="customer-account-section ys-material-surface"
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
            className="customer-account-section ys-material-surface"
            hidden={activeTab !== "security"}
            id="security-panel"
            role="tabpanel"
          >
            <div className="customer-account-section-heading">
              <div>
                <p className="customer-eyebrow">Account security</p>
                <h2 id="security-title">Password and active sessions</h2>
                <p>
                  Use Quick Sign or a password on the same customer account, and manage active
                  sessions without exposing session secrets.
                </p>
              </div>
              <ShieldCheck aria-hidden="true" size={22} />
            </div>

            <div className="customer-account-security-grid">
              <div className="customer-account-security-card">
                <div className="customer-account-card-title">
                  <KeyRound size={19} />
                  <div>
                    <strong>{securitySummary?.hasPassword ? "Change password" : "Password"}</strong>
                    <p>
                      {securitySummary?.hasPassword
                        ? "Change your local password without affecting Quick Sign access."
                        : "Quick Sign created this account without a local password. Add one after verifying your email."}
                    </p>
                  </div>
                </div>

                {securitySummary ? (
                  <div className="customer-account-auth-methods" aria-label="Sign-in methods">
                    <span>
                      <strong>Quick Sign</strong>
                      <small>
                        {securitySummary.linkedProviders.includes("GOOGLE")
                          ? "Google connected"
                          : "Email verification available"}
                      </small>
                    </span>
                    <span>
                      <strong>Password</strong>
                      <small>{securitySummary.hasPassword ? "Enabled" : "Not set"}</small>
                    </span>
                  </div>
                ) : null}

                {securitySummaryLoading ? (
                  <p className="customer-account-muted" role="status">
                    Loading sign-in methods...
                  </p>
                ) : securitySummary?.hasPassword ? (
                  <form
                    className="customer-account-security-form customer-account-password-change-form"
                    onSubmit={(event) => void handlePasswordChange(event)}
                  >
                    <input
                      autoComplete="section-customer username"
                      className="customer-account-password-identity"
                      aria-label="Customer account email"
                      name="username"
                      onChange={() => undefined}
                      tabIndex={-1}
                      type="email"
                      value={customer.email}
                    />

                    <div className="customer-account-password-change-current">
                      <PasswordField
                        autoComplete="section-customer current-password"
                        label="Current password"
                        name="currentPassword"
                        maxLength={128}
                        onChange={setCurrentPassword}
                        value={currentPassword}
                      />
                      <button
                        className="customer-account-password-recovery-link"
                        onClick={() => navigate("/account-recovery")}
                        type="button"
                      >
                        Forgot current password?
                      </button>
                    </div>

                    <div className="customer-account-password-change-divider" aria-hidden="true" />

                    <div className="customer-account-password-change-new">
                      <PasswordField
                        autoComplete="section-customer new-password"
                        label="New password"
                        name="newPassword"
                        maxLength={128}
                        minLength={8}
                        onChange={setNewPassword}
                        value={newPassword}
                      />
                      <PasswordField
                        autoComplete="section-customer new-password"
                        label="Confirm new password"
                        name="newPasswordConfirmation"
                        maxLength={128}
                        minLength={8}
                        onChange={setConfirmPassword}
                        value={confirmPassword}
                      />
                      <p className="customer-account-password-requirement">
                        Use 8–128 characters. Changing your password signs out your other sessions.
                      </p>
                    </div>

                    <div className="customer-account-password-change-actions">
                      <button
                        disabled={
                          changingPassword ||
                          !currentPassword ||
                          newPassword.length < 8 ||
                          newPassword !== confirmPassword
                        }
                        type="submit"
                      >
                        {changingPassword ? "Updating..." : "Update password"}
                      </button>
                    </div>
                  </form>
                ) : passwordSetupStage === "idle" ? (
                  <button
                    disabled={passwordSetupBusy}
                    onClick={() => void handlePasswordSetupRequest()}
                    type="button"
                  >
                    {passwordSetupBusy ? "Sending code..." : "Set a password"}
                  </button>
                ) : passwordSetupStage === "verify" ? (
                  <form
                    className="customer-account-security-form customer-account-otp-form"
                    onSubmit={(event) => void handlePasswordSetupVerification(event)}
                  >
                    <div className="customer-account-otp-heading">
                      <strong>Verification code</strong>
                      <p>Enter the 6-digit code sent to your email.</p>
                    </div>
                    <input
                      aria-label="Verification code"
                      autoComplete="section-customer one-time-code"
                      className="customer-account-otp-input"
                      inputMode="numeric"
                      maxLength={6}
                      onChange={(event) =>
                        setPasswordSetupCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                      }
                      pattern="[0-9]{6}"
                      value={passwordSetupCode}
                    />
                    <div className="customer-account-otp-timers" aria-live="polite">
                      <span>
                        Code expires in{" "}
                        <strong>{formatPasswordSetupCountdown(passwordSetupExpiresInMs)}</strong>
                      </span>
                      <span>
                        {passwordSetupResendReady ? (
                          "You can request a new code now"
                        ) : (
                          <>
                            You can request a new code in{" "}
                            <strong>
                              {formatPasswordSetupCountdown(passwordSetupResendInMs)}
                            </strong>
                          </>
                        )}
                      </span>
                    </div>
                    <div className="customer-account-otp-actions">
                      <button
                        disabled={
                          passwordSetupBusy ||
                          passwordSetupCode.length !== 6 ||
                          passwordSetupCodeExpired
                        }
                        type="submit"
                      >
                        {passwordSetupBusy ? "Verifying..." : "Verify code"}
                      </button>
                      <button
                        className="customer-account-secondary-button"
                        disabled={passwordSetupBusy || !passwordSetupResendReady}
                        onClick={() => void handlePasswordSetupRequest()}
                        type="button"
                      >
                        Resend code
                      </button>
                    </div>
                  </form>
                ) : (
                  <form
                    className="customer-account-security-form"
                    onSubmit={(event) => void handleFirstPasswordSubmit(event)}
                  >
                    <input
                      autoComplete="section-customer username"
                      className="customer-account-password-identity"
                      aria-label="Customer account email"
                      name="username"
                      onChange={() => undefined}
                      tabIndex={-1}
                      type="email"
                      value={customer.email}
                    />
                    <PasswordField
                      autoComplete="section-customer new-password"
                      label="New password"
                      name="newPassword"
                      maxLength={128}
                      minLength={8}
                      onChange={setSetupPassword}
                      value={setupPassword}
                    />
                    <PasswordField
                      autoComplete="section-customer new-password"
                      label="Confirm new password"
                      name="newPasswordConfirmation"
                      maxLength={128}
                      minLength={8}
                      onChange={setSetupConfirmPassword}
                      value={setupConfirmPassword}
                    />
                    <button disabled={passwordSetupBusy} type="submit">
                      {passwordSetupBusy ? "Adding password..." : "Add password"}
                    </button>
                  </form>
                )}

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
              </div>

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
                  <>
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

                    {otherSessionCount === 0 ? (
                      <div className="customer-account-session-empty">
                        <CheckCircle2 aria-hidden="true" size={17} />
                        <div>
                          <strong>No other active sessions</strong>
                          <span>You’re only signed in on this session.</span>
                        </div>
                      </div>
                    ) : (
                      <div className="customer-account-session-actions">
                        {!revokeConfirmationOpen ? (
                          <button
                            className="customer-account-secondary-button customer-account-session-signout"
                            onClick={() => {
                              setSessionsError(null);
                              setSessionActionMessage(null);
                              setRevokeConfirmationOpen(true);
                            }}
                            type="button"
                          >
                            Sign out {otherSessionCount} other session
                            {otherSessionCount === 1 ? "" : "s"}
                          </button>
                        ) : securitySummary?.hasPassword ? (
                          <form
                            className="customer-account-session-confirm"
                            onSubmit={(event) => void handleRevokeSessions(event)}
                          >
                            <div className="customer-account-session-confirm-copy">
                              <strong>Confirm it’s you</strong>
                              <p>
                                Enter your current password to sign out the other active sessions.
                                This session will stay signed in.
                              </p>
                            </div>
                            <input
                              autoComplete="section-customer username"
                              className="customer-account-password-identity"
                              name="username"
                              readOnly
                              tabIndex={-1}
                              type="email"
                              value={customer.email}
                            />
                            <PasswordField
                              autoComplete="section-customer current-password"
                              label="Current password"
                              name="currentPassword"
                              maxLength={128}
                              onChange={setRevokePassword}
                              value={revokePassword}
                            />
                            <div className="customer-account-session-confirm-actions">
                              <button
                                className="customer-account-secondary-button"
                                disabled={revokingSessions}
                                onClick={() => {
                                  setRevokePassword("");
                                  setSessionsError(null);
                                  setRevokeConfirmationOpen(false);
                                }}
                                type="button"
                              >
                                Cancel
                              </button>
                              <button disabled={revokingSessions || !revokePassword} type="submit">
                                {revokingSessions ? "Signing out..." : "Confirm sign out"}
                              </button>
                            </div>
                          </form>
                        ) : sessionRevokeVerificationStage === "idle" ? (
                          <div className="customer-account-session-confirm">
                            <div className="customer-account-session-confirm-copy">
                              <strong>Confirm it’s you</strong>
                              <p>
                                We’ll send a 6-digit code to your account email before signing out
                                the other active sessions. This session will stay signed in.
                              </p>
                            </div>
                            <div className="customer-account-session-confirm-actions">
                              <button
                                className="customer-account-secondary-button"
                                disabled={sessionRevokeVerificationBusy}
                                onClick={closeRevokeConfirmation}
                                type="button"
                              >
                                Cancel
                              </button>
                              <button
                                disabled={sessionRevokeVerificationBusy}
                                onClick={() => void handleSessionRevokeVerificationRequest()}
                                type="button"
                              >
                                {sessionRevokeVerificationBusy
                                  ? "Sending code..."
                                  : "Send verification code"}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <form
                            className="customer-account-session-confirm"
                            onSubmit={(event) => void handleSessionRevokeOtpSubmit(event)}
                          >
                            <div className="customer-account-session-confirm-copy">
                              <strong>Verification code</strong>
                              <p>Enter the 6-digit code sent to your email.</p>
                            </div>
                            <input
                              aria-label="Session security verification code"
                              autoComplete="section-customer one-time-code"
                              className="customer-account-otp-input"
                              inputMode="numeric"
                              maxLength={6}
                              onChange={(event) =>
                                setSessionRevokeVerificationCode(
                                  event.target.value.replace(/\D/g, "").slice(0, 6)
                                )
                              }
                              pattern="[0-9]{6}"
                              value={sessionRevokeVerificationCode}
                            />
                            <div className="customer-account-otp-timers" aria-live="polite">
                              <span>
                                Code expires in{" "}
                                <strong>
                                  {formatPasswordSetupCountdown(sessionRevokeExpiresInMs)}
                                </strong>
                              </span>
                              <span>
                                {sessionRevokeResendReady ? (
                                  "You can request a new code now"
                                ) : (
                                  <>
                                    You can request a new code in{" "}
                                    <strong>
                                      {formatPasswordSetupCountdown(sessionRevokeResendInMs)}
                                    </strong>
                                  </>
                                )}
                              </span>
                            </div>
                            <div className="customer-account-session-otp-actions">
                              <button
                                className="customer-account-secondary-button"
                                disabled={sessionRevokeVerificationBusy}
                                onClick={closeRevokeConfirmation}
                                type="button"
                              >
                                Cancel
                              </button>
                              <button
                                className="customer-account-secondary-button"
                                disabled={
                                  sessionRevokeVerificationBusy || !sessionRevokeResendReady
                                }
                                onClick={() => void handleSessionRevokeVerificationRequest()}
                                type="button"
                              >
                                Resend code
                              </button>
                              <button
                                disabled={
                                  sessionRevokeVerificationBusy ||
                                  sessionRevokeVerificationCode.length !== 6 ||
                                  sessionRevokeCodeExpired
                                }
                                type="submit"
                              >
                                {sessionRevokeVerificationBusy
                                  ? "Verifying..."
                                  : "Verify & sign out"}
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    )}

                    {sessionActionMessage ? (
                      <p className="customer-account-form-success" role="status">
                        {sessionActionMessage}
                      </p>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </section>
        </main>
      </div>
    </section>
  );
}

type PasswordFieldProps = {
  autoComplete:
    | "current-password"
    | "new-password"
    | "section-customer current-password"
    | "section-customer new-password";
  label: string;
  maxLength: number;
  minLength?: number;
  name: string;
  onChange: (value: string) => void;
  value: string;
};

function PasswordField({
  autoComplete,
  label,
  maxLength,
  minLength,
  name,
  onChange,
  value
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <label>
      <span>{label}</span>
      <div className="customer-account-password-field">
        <input
          autoComplete={autoComplete}
          maxLength={maxLength}
          minLength={minLength}
          name={name}
          onChange={(event) => onChange(event.target.value)}
          type={visible ? "text" : "password"}
          value={value}
        />
        <button
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={visible}
          className="customer-account-password-toggle"
          onClick={() => setVisible((current) => !current)}
          title={visible ? "Hide password" : "Show password"}
          type="button"
        >
          {visible ? <EyeOff aria-hidden="true" size={18} /> : <Eye aria-hidden="true" size={18} />}
        </button>
      </div>
    </label>
  );
}

function isPaymongoAwaitingPayment(order: StorefrontOrder) {
  return order.paymentMethod === "PAYMONGO" && order.paymentStatus !== "PAID";
}

function DeliveryProgress({ order }: { order: StorefrontOrder }) {
  const eventByStatus = new Map(order.timeline.map((event) => [event.status, event] as const));

  return (
    <div className="customer-delivery-progress" aria-label="Delivery progress">
      <ol className="customer-delivery-stepper">
        {DELIVERY_PROGRESS_STEPS.map((step, index) => {
          const event = eventByStatus.get(step.status);
          const nextStep = DELIVERY_PROGRESS_STEPS[index + 1];
          const nextEvent = nextStep ? eventByStatus.get(nextStep.status) : undefined;
          const isCurrent = order.deliveryStatus === step.status;
          const isComplete = Boolean(event);
          const isConnectorComplete = isComplete && Boolean(nextEvent);

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
                  <span
                    className={`customer-delivery-stepper__connector${
                      isConnectorComplete ? " is-complete" : ""
                    }`}
                    aria-hidden="true"
                  />
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
