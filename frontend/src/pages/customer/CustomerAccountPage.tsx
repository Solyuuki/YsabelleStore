import { History, LogOut, Mail, PackageCheck, Phone, UserRound } from "lucide-react";
import { useEffect, useState } from "react";

import { formatCurrency } from "@/components/customer/ProductCard";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { fetchCustomerOrders } from "@/services/storefrontService";
import type { StorefrontOrder } from "@/types/storefront";

const orderDateFormatter = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short"
});

export function CustomerAccountPage({ navigate }: { navigate: (path: string) => void }) {
  const { customer, error, logout, refreshSession } = useCustomerAuth();
  const [orders, setOrders] = useState<StorefrontOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [logoutMessage, setLogoutMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!customer) return;

    const controller = new AbortController();
    let active = true;

    async function loadOrders() {
      setOrdersLoading(true);
      setOrdersError(null);

      try {
        const customerOrders = await fetchCustomerOrders(controller.signal);
        if (active) setOrders(customerOrders);
      } catch (reason) {
        if (reason instanceof DOMException && reason.name === "AbortError") return;

        const restoredCustomer = await refreshSession();
        if (!active) return;

        if (!restoredCustomer) {
          navigate("/login");
          return;
        }

        setOrdersError(
          reason instanceof Error
            ? reason.message
            : "Your order history could not be loaded. Please try again."
        );
      } finally {
        if (active) setOrdersLoading(false);
      }
    }

    void loadOrders();

    return () => {
      active = false;
      controller.abort();
    };
  }, [customer, navigate, refreshSession]);

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

  return (
    <section className="customer-auth-page customer-account-page">
      <div className="customer-account-shell">
        <div className="customer-auth-card customer-account-card">
          <div className="customer-auth-card__intro">
            <span className="customer-auth-card__icon" aria-hidden="true">
              <UserRound size={22} />
            </span>
            <p className="customer-eyebrow">My Account</p>
            <h1>{customer.name}</h1>
            <p>Your storefront account keeps your signed-in pickup orders together in one place.</p>
          </div>

          {error || logoutMessage ? (
            <div className="customer-auth-alert" role="status">
              {logoutMessage ?? error}
            </div>
          ) : null}

          <dl className="customer-account-details">
            <div>
              <dt>
                <Mail aria-hidden="true" size={17} /> Email
              </dt>
              <dd>{customer.email}</dd>
            </div>
            <div>
              <dt>
                <Phone aria-hidden="true" size={17} /> Phone
              </dt>
              <dd>{customer.phone || "Not provided"}</dd>
            </div>
            <div>
              <dt>Account status</dt>
              <dd>{customer.status === "ACTIVE" ? "Active" : "Inactive"}</dd>
            </div>
          </dl>

          <div className="customer-account-actions">
            <button
              className="customer-auth-submit"
              onClick={() => navigate("/shop")}
              type="button"
            >
              Continue Shopping
            </button>
            <button
              className="customer-auth-secondary"
              disabled={signingOut}
              onClick={() => void handleLogout()}
              type="button"
            >
              <LogOut aria-hidden="true" size={18} />
              {signingOut ? "Signing out..." : "Sign Out"}
            </button>
          </div>
        </div>

        <section className="customer-account-orders" aria-labelledby="customer-order-history-title">
          <div className="customer-account-orders__heading">
            <div>
              <p className="customer-eyebrow">Pickup activity</p>
              <h2 id="customer-order-history-title">Order History</h2>
              <p>Only orders placed while signed in to this account appear here.</p>
            </div>
            <span className="customer-account-orders__icon" aria-hidden="true">
              <History size={21} />
            </span>
          </div>

          {ordersLoading ? (
            <div className="customer-account-orders__state" role="status">
              Loading your orders...
            </div>
          ) : ordersError ? (
            <div className="customer-auth-alert" role="alert">
              {ordersError}
            </div>
          ) : orders.length === 0 ? (
            <div className="customer-account-orders__empty">
              <PackageCheck aria-hidden="true" size={28} />
              <strong>No signed-in orders yet</strong>
              <p>Your next pickup order will appear here when you place it while signed in.</p>
              <button
                className="customer-auth-secondary"
                onClick={() => navigate("/shop")}
                type="button"
              >
                Browse the shop
              </button>
            </div>
          ) : (
            <div className="customer-account-order-list">
              {orders.map((order) => (
                <article className="customer-account-order" key={order.id}>
                  <div className="customer-account-order__topline">
                    <div>
                      <span>Order</span>
                      <strong>{order.orderNumber}</strong>
                    </div>
                    <span className="customer-account-order__status">{order.status}</span>
                  </div>
                  <div className="customer-account-order__meta">
                    <span>{orderDateFormatter.format(new Date(order.createdAt))}</span>
                    <strong>{formatCurrency(Number(order.totalAmount))}</strong>
                  </div>
                  <ul className="customer-account-order__items">
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
      </div>
    </section>
  );
}
