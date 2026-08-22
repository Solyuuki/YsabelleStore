import { LogOut, Mail, Phone, UserRound } from "lucide-react";
import { useState } from "react";

import { useCustomerAuth } from "@/context/CustomerAuthContext";

export function CustomerAccountPage({ navigate }: { navigate: (path: string) => void }) {
  const { customer, error, logout } = useCustomerAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [logoutMessage, setLogoutMessage] = useState<string | null>(null);

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
      <div className="customer-auth-card customer-account-card">
        <div className="customer-auth-card__intro">
          <span className="customer-auth-card__icon" aria-hidden="true">
            <UserRound size={22} />
          </span>
          <p className="customer-eyebrow">My Account</p>
          <h1>{customer.name}</h1>
          <p>Your storefront account is signed in and ready while you browse and shop.</p>
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
          <button className="customer-auth-submit" onClick={() => navigate("/shop")} type="button">
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

        <div className="customer-account-note">
          <strong>Your account is ready.</strong>
          <p>Guest checkout remains available whenever you prefer to shop without signing in.</p>
        </div>
      </div>
    </section>
  );
}
