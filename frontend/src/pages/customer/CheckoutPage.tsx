import { ArrowLeft, CheckCircle2, MapPin, ShieldCheck, Store } from "lucide-react";
import { useState, type FormEvent } from "react";

import { CustomerLink } from "@/components/customer/CustomerLink";
import { formatCurrency } from "@/components/customer/ProductCard";
import { useCart } from "@/context/CartContext";
import { placeStorefrontOrder } from "@/services/storefrontService";

const LAST_ORDER_KEY = "ysabelle:last-customer-order";

export function CheckoutPage({ navigate }: { navigate: (path: string) => void }) {
  const { items, itemCount, subtotal, clearCart } = useCart();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!items.length || submitting) return;
    setSubmitting(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const order = await placeStorefrontOrder({
        customerName: String(form.get("customerName") ?? ""),
        customerEmail: String(form.get("customerEmail") ?? ""),
        customerPhone: String(form.get("customerPhone") ?? ""),
        notes: String(form.get("notes") ?? ""),
        fulfillmentMethod: "STORE_PICKUP",
        paymentMethod: "CASH_ON_PICKUP",
        items: items.map((item) => ({ productId: item.product.id, quantity: item.quantity }))
      });
      sessionStorage.setItem(LAST_ORDER_KEY, JSON.stringify(order));
      clearCart();
      navigate(`/order-success?order=${encodeURIComponent(order.orderNumber)}`);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Your order could not be placed. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!items.length) {
    return (
      <div className="customer-page customer-container">
        <div className="customer-empty-state">
          <h1>Your cart is empty</h1>
          <p>Add at least one product before checkout.</p>
          <CustomerLink className="customer-button" href="/shop" navigate={navigate}>
            Browse groceries
          </CustomerLink>
        </div>
      </div>
    );
  }

  return (
    <div className="customer-page customer-checkout-page">
      <div className="customer-container">
        <CustomerLink className="customer-back-link" href="/cart" navigate={navigate}>
          <ArrowLeft aria-hidden="true" size={17} /> Back to cart
        </CustomerLink>
        <div className="customer-page-heading">
          <p className="customer-kicker">Pickup order</p>
          <h1>Checkout</h1>
          <p>Tell us who will collect this order. No online payment is required.</p>
        </div>
        <form className="customer-checkout-layout" onSubmit={submit}>
          <div className="customer-checkout-form">
            <section>
              <div className="customer-checkout-section-title">
                <span>1</span>
                <div>
                  <h2>Your details</h2>
                  <p>Used only to identify and coordinate this pickup request.</p>
                </div>
              </div>
              <div className="customer-form-grid">
                <label>
                  <span>Full name</span>
                  <input
                    autoComplete="name"
                    maxLength={120}
                    minLength={2}
                    name="customerName"
                    required
                    type="text"
                  />
                </label>
                <label>
                  <span>Mobile number</span>
                  <input
                    autoComplete="tel"
                    maxLength={40}
                    minLength={7}
                    name="customerPhone"
                    required
                    type="tel"
                  />
                </label>
                <label className="customer-form-grid__full">
                  <span>
                    Email <small>(optional)</small>
                  </span>
                  <input autoComplete="email" maxLength={191} name="customerEmail" type="email" />
                </label>
              </div>
            </section>
            <section>
              <div className="customer-checkout-section-title">
                <span>2</span>
                <div>
                  <h2>Fulfillment</h2>
                  <p>Pickup is the currently supported option.</p>
                </div>
              </div>
              <div className="customer-choice-card is-selected">
                <Store aria-hidden="true" />
                <div>
                  <strong>Store pickup</strong>
                  <span>
                    <MapPin aria-hidden="true" size={15} /> 110 A. Mabini Street, Pasig City, Metro
                    Manila
                  </span>
                </div>
                <CheckCircle2 aria-hidden="true" />
              </div>
            </section>
            <section>
              <div className="customer-checkout-section-title">
                <span>3</span>
                <div>
                  <h2>Payment</h2>
                  <p>No card or e-wallet integration is presented.</p>
                </div>
              </div>
              <div className="customer-choice-card is-selected">
                <ShieldCheck aria-hidden="true" />
                <div>
                  <strong>Cash on pickup</strong>
                  <span>Pay at the store when your order is collected.</span>
                </div>
                <CheckCircle2 aria-hidden="true" />
              </div>
              <label className="customer-notes-field">
                <span>
                  Order notes <small>(optional)</small>
                </span>
                <textarea
                  maxLength={255}
                  name="notes"
                  placeholder="A short note for the store"
                  rows={3}
                />
              </label>
            </section>
          </div>
          <aside className="customer-order-summary customer-checkout-summary">
            <p className="customer-kicker">Final review</p>
            <h2>
              {itemCount} item{itemCount === 1 ? "" : "s"}
            </h2>
            <div className="customer-checkout-lines">
              {items.map((item) => (
                <div key={item.product.id}>
                  <span>
                    {item.quantity} × {item.product.name}
                  </span>
                  <strong>
                    {formatCurrency(Number(item.product.sellingPrice) * item.quantity)}
                  </strong>
                </div>
              ))}
            </div>
            <div>
              <span>Pickup</span>
              <strong>Free</strong>
            </div>
            <div className="customer-order-summary__total">
              <span>Total</span>
              <strong>{formatCurrency(subtotal)}</strong>
            </div>
            <p>
              Placing this order creates a pending pickup request. Inventory is deducted only when
              the store completes the sale.
            </p>
            {error ? (
              <div aria-live="assertive" className="customer-form-error" role="alert">
                {error}
              </div>
            ) : null}
            <button
              className="customer-button customer-button--full"
              disabled={submitting}
              type="submit"
            >
              {submitting ? "Checking stock..." : "Place pickup order"}
            </button>
          </aside>
        </form>
      </div>
    </div>
  );
}

export { LAST_ORDER_KEY };
