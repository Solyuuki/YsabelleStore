import { Check, MapPin, ShoppingBasket } from "lucide-react";

import { CustomerLink } from "@/components/customer/CustomerLink";
import { formatCurrency } from "@/components/customer/ProductCard";
import type { StorefrontOrder } from "@/types/storefront";
import { LAST_ORDER_KEY } from "./CheckoutPage";

export function OrderSuccessPage({
  location,
  navigate
}: {
  location: string;
  navigate: (path: string) => void;
}) {
  const order = readOrder();
  const orderNumber =
    order?.orderNumber ?? new URL(location, window.location.origin).searchParams.get("order");

  return (
    <div className="customer-page customer-success-page">
      <div className="customer-container customer-success-card">
        <div className="customer-success-card__icon">
          <Check aria-hidden="true" />
        </div>
        <p className="customer-kicker">Pickup request received</p>
        <h1>Your Essentials Are on the List.</h1>
        <p>
          The store has received your pending pickup order. Please keep the reference number below.
        </p>
        {orderNumber ? (
          <div className="customer-order-reference">
            <span>Order reference</span>
            <strong>{orderNumber}</strong>
          </div>
        ) : null}
        {order ? (
          <div className="customer-success-summary">
            <span>
              {order.itemCount} item{order.itemCount === 1 ? "" : "s"}
            </span>
            <strong>{formatCurrency(order.totalAmount)}</strong>
          </div>
        ) : null}
        <div className="customer-success-pickup">
          <MapPin aria-hidden="true" />
          <div>
            <strong>Store pickup</strong>
            <span>110 A. Mabini Street, Pasig City, Metro Manila</span>
            <small>Payment: Cash on pickup</small>
          </div>
        </div>
        <p className="customer-success-card__note">
          This is a pending order request, not a completed sale. Stock is finalized by the store
          during fulfillment.
        </p>
        <div className="customer-success-actions">
          <CustomerLink className="customer-button" href="/shop" navigate={navigate}>
            <ShoppingBasket aria-hidden="true" size={18} /> Continue shopping
          </CustomerLink>
          <CustomerLink
            className="customer-button customer-button--secondary"
            href="/"
            navigate={navigate}
          >
            Back home
          </CustomerLink>
        </div>
      </div>
    </div>
  );
}

function readOrder(): StorefrontOrder | null {
  try {
    const raw = sessionStorage.getItem(LAST_ORDER_KEY);
    return raw ? (JSON.parse(raw) as StorefrontOrder) : null;
  } catch {
    return null;
  }
}
