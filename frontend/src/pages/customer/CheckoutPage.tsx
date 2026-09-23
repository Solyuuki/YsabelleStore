import { ArrowLeft, Banknote, CheckCircle2, CreditCard, MapPin, ShieldCheck, Store } from "lucide-react";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";

import { CustomerLink } from "@/components/customer/CustomerLink";
import { formatCurrency } from "@/components/customer/ProductCard";
import { useCart } from "@/context/CartContext";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { fetchCustomerAddress } from "@/services/customerAddressService";
import { placeStorefrontOrder, startPaymongoCheckout } from "@/services/storefrontService";
import { EMPTY_CUSTOMER_ADDRESS, type CustomerAddress } from "@/types/customerAddress";
import type { StorefrontOrder, StorefrontPaymentMethod } from "@/types/storefront";
import { getCustomerCheckoutDefaults } from "@/utils/customerAccountState";

const LAST_ORDER_KEY = "ysabelle:last-customer-order";

function addressSummary(address: CustomerAddress) {
  return [
    address.addressLine1,
    address.addressLine2,
    address.barangay,
    address.cityMunicipality,
    address.provinceRegion,
    address.postalCode
  ]
    .filter(Boolean)
    .join(", ");
}

export function CheckoutPage({ navigate }: { navigate: (path: string) => void }) {
  const { items, itemCount, subtotal, clearCart, isReady } = useCart();
  const { customer, status } = useCustomerAuth();
  const [contact, setContact] = useState(() => getCustomerCheckoutDefaults(customer));
  const [contactEdited, setContactEdited] = useState(false);
  const [address, setAddress] = useState<CustomerAddress>(EMPTY_CUSTOMER_ADDRESS);
  const [savedAddress, setSavedAddress] = useState<CustomerAddress | null>(null);
  const [editingAddress, setEditingAddress] = useState(true);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressLoadError, setAddressLoadError] = useState("");
  const [saveAddressToAccount, setSaveAddressToAccount] = useState(Boolean(customer));
  const [paymentMethod, setPaymentMethod] = useState<StorefrontPaymentMethod>("PAYMONGO");
  const [pendingPaymongoOrder, setPendingPaymongoOrder] = useState<StorefrontOrder | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!contactEdited) {
      setContact(getCustomerCheckoutDefaults(customer));
    }
  }, [contactEdited, customer]);

  useEffect(() => {
    setSaveAddressToAccount(Boolean(customer));
    if (!customer) {
      setSavedAddress(null);
      setAddress(EMPTY_CUSTOMER_ADDRESS);
      setEditingAddress(true);
      setAddressLoadError("");
      return;
    }

    const controller = new AbortController();
    setAddressLoading(true);
    setAddressLoadError("");

    void fetchCustomerAddress(controller.signal)
      .then((loadedAddress) => {
        if (!loadedAddress) {
          setSavedAddress(null);
          setAddress(EMPTY_CUSTOMER_ADDRESS);
          setEditingAddress(true);
          return;
        }
        setSavedAddress(loadedAddress);
        setAddress(loadedAddress);
        setEditingAddress(false);
      })
      .catch((reason) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setSavedAddress(null);
        setAddress(EMPTY_CUSTOMER_ADDRESS);
        setEditingAddress(true);
        setAddressLoadError("Your saved address could not be loaded. You can enter it below.");
      })
      .finally(() => setAddressLoading(false));

    return () => controller.abort();
  }, [customer]);

  function updateContact(event: ChangeEvent<HTMLInputElement>) {
    const field = event.currentTarget.name as keyof typeof contact;
    const value = event.currentTarget.value;
    setContact((current) => ({ ...current, [field]: value }));
    setContactEdited(true);
  }

  function updateAddress(event: ChangeEvent<HTMLInputElement>) {
    const field = event.currentTarget.name as keyof CustomerAddress;
    const value = event.currentTarget.value;
    setAddress((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if ((!items.length && !pendingPaymongoOrder) || submitting) return;

    setSubmitting(true);
    setError("");

    try {
      let order = pendingPaymongoOrder;

      if (!order) {
        const form = new FormData(event.currentTarget);
        order = await placeStorefrontOrder({
          customerName: String(form.get("customerName") ?? ""),
          customerEmail: String(form.get("customerEmail") ?? ""),
          customerPhone: String(form.get("customerPhone") ?? ""),
          customerAddress: address,
          saveAddressToAccount: Boolean(customer && saveAddressToAccount),
          notes: String(form.get("notes") ?? ""),
          fulfillmentMethod: "STORE_PICKUP",
          paymentMethod,
          items: items.map((item) => ({ productId: item.product.id, quantity: item.quantity }))
        });
        sessionStorage.setItem(LAST_ORDER_KEY, JSON.stringify(order));
      }

      if (order.paymentMethod === "PAYMONGO") {
        try {
          const checkout = await startPaymongoCheckout(order.orderNumber);
          clearCart();
          window.location.assign(checkout.checkoutUrl);
          return;
        } catch (reason) {
          setPendingPaymongoOrder(order);
          throw reason;
        }
      }

      clearCart();
      navigate(`/order-success?order=${encodeURIComponent(order.orderNumber)}`);
    } catch (reason) {
      setError(
        pendingPaymongoOrder
          ? `Order ${pendingPaymongoOrder.orderNumber} is saved. PayMongo checkout could not be opened; retry payment without creating another order.`
          : reason instanceof Error
            ? reason.message
            : "Your order could not be placed. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "authenticated" && !isReady) {
    return (
      <div className="customer-page customer-container">
        <div className="customer-empty-state" role="status">
          <h1>Syncing Your Cart</h1>
          <p>We are moving your guest items into your account before checkout.</p>
        </div>
      </div>
    );
  }

  if (status !== "authenticated" || !customer) {
    return (
      <div className="customer-page customer-container">
        <div className="customer-empty-state">
          <h1>Sign In Required</h1>
          <p>Your cart is safe. Sign in to continue with checkout.</p>
          <CustomerLink
            className="customer-button"
            href="/login?returnTo=%2Fcheckout"
            navigate={navigate}
          >
            Sign in to checkout
          </CustomerLink>
        </div>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="customer-page customer-container">
        <div className="customer-empty-state">
          <h1>Your Cart Is Empty</h1>
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
                  <h2>Your Details</h2>
                  <p>
                    {customer
                      ? "We prefilled your account details. You can edit them for this order."
                      : "Used only to identify and coordinate this pickup request."}
                  </p>
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
                    onChange={updateContact}
                    required
                    type="text"
                    value={contact.customerName}
                  />
                </label>
                <label>
                  <span>Mobile number</span>
                  <input
                    autoComplete="tel"
                    maxLength={40}
                    minLength={7}
                    name="customerPhone"
                    onChange={updateContact}
                    required
                    type="tel"
                    value={contact.customerPhone}
                  />
                </label>
                <label className="customer-form-grid__full">
                  <span>
                    Email <small>(optional)</small>
                  </span>
                  <input
                    autoComplete="email"
                    maxLength={191}
                    name="customerEmail"
                    onChange={updateContact}
                    type="email"
                    value={contact.customerEmail}
                  />
                </label>
              </div>
            </section>

            <section>
              <div className="customer-checkout-section-title">
                <span>2</span>
                <div>
                  <h2>Contact address</h2>
                  <p>
                    This identifies your customer record. Your order is still collected at the
                    store.
                  </p>
                </div>
              </div>

              {addressLoading ? (
                <div className="customer-choice-card" role="status">
                  <MapPin aria-hidden="true" />
                  <div>
                    <strong>Loading saved address...</strong>
                    <span>Checking your account details.</span>
                  </div>
                </div>
              ) : savedAddress && !editingAddress ? (
                <div className="customer-choice-card is-selected">
                  <MapPin aria-hidden="true" />
                  <div>
                    <strong>Saved address</strong>
                    <span>{addressSummary(savedAddress)}</span>
                    <button
                      className="customer-address-change"
                      onClick={() => setEditingAddress(true)}
                      type="button"
                    >
                      Change address
                    </button>
                  </div>
                  <CheckCircle2 aria-hidden="true" />
                </div>
              ) : (
                <div className="customer-form-grid customer-address-form-grid">
                  <label className="customer-form-grid__full">
                    <span>Address line 1</span>
                    <input
                      autoComplete="address-line1"
                      maxLength={180}
                      minLength={3}
                      name="addressLine1"
                      onChange={updateAddress}
                      placeholder="House / unit number and street"
                      required
                      value={address.addressLine1}
                    />
                  </label>
                  <label className="customer-form-grid__full">
                    <span>
                      Address line 2 <small>(optional)</small>
                    </span>
                    <input
                      autoComplete="address-line2"
                      maxLength={180}
                      name="addressLine2"
                      onChange={updateAddress}
                      placeholder="Building, subdivision, landmark"
                      value={address.addressLine2}
                    />
                  </label>
                  <label>
                    <span>Barangay</span>
                    <input
                      maxLength={120}
                      minLength={2}
                      name="barangay"
                      onChange={updateAddress}
                      required
                      value={address.barangay}
                    />
                  </label>
                  <label>
                    <span>City / Municipality</span>
                    <input
                      autoComplete="address-level2"
                      maxLength={120}
                      minLength={2}
                      name="cityMunicipality"
                      onChange={updateAddress}
                      required
                      value={address.cityMunicipality}
                    />
                  </label>
                  <label>
                    <span>Province / Region</span>
                    <input
                      autoComplete="address-level1"
                      maxLength={120}
                      minLength={2}
                      name="provinceRegion"
                      onChange={updateAddress}
                      required
                      value={address.provinceRegion}
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
                      onChange={updateAddress}
                      required
                      value={address.postalCode}
                    />
                  </label>
                  <label className="customer-form-grid__full">
                    <span>Country</span>
                    <input readOnly value="Philippines" />
                  </label>
                </div>
              )}

              {addressLoadError ? (
                <div className="customer-form-error" role="status">
                  {addressLoadError}
                </div>
              ) : null}

              {customer ? (
                <label className="customer-address-save-option">
                  <input
                    checked={saveAddressToAccount}
                    onChange={(event) => setSaveAddressToAccount(event.target.checked)}
                    type="checkbox"
                  />
                  <span>
                    <strong>Save this address to My Account</strong>
                    <small>
                      Use it automatically on your next checkout. You can change it anytime.
                    </small>
                  </span>
                </label>
              ) : null}
            </section>

            <section>
              <div className="customer-checkout-section-title">
                <span>3</span>
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
                <span>4</span>
                <div>
                  <h2>Payment</h2>
                  <p>Choose PayMongo test checkout or pay at the store when you collect the order.</p>
                </div>
              </div>
              <div
                aria-label="Payment method"
                className="customer-payment-options"
                role="radiogroup"
              >
                <label
                  className={`customer-payment-option${paymentMethod === "PAYMONGO" ? " is-selected" : ""}`}
                >
                  <input
                    checked={paymentMethod === "PAYMONGO"}
                    disabled={Boolean(pendingPaymongoOrder)}
                    name="paymentMethod"
                    onChange={() => setPaymentMethod("PAYMONGO")}
                    type="radio"
                    value="PAYMONGO"
                  />
                  <CreditCard aria-hidden="true" />
                  <span>
                    <strong>PayMongo online payment</strong>
                    <small>
                      Secure hosted checkout in test mode. No real money will be charged.
                    </small>
                  </span>
                  {paymentMethod === "PAYMONGO" ? <CheckCircle2 aria-hidden="true" /> : null}
                </label>
                <label
                  className={`customer-payment-option${paymentMethod === "CASH_ON_PICKUP" ? " is-selected" : ""}`}
                >
                  <input
                    checked={paymentMethod === "CASH_ON_PICKUP"}
                    disabled={Boolean(pendingPaymongoOrder)}
                    name="paymentMethod"
                    onChange={() => setPaymentMethod("CASH_ON_PICKUP")}
                    type="radio"
                    value="CASH_ON_PICKUP"
                  />
                  <Banknote aria-hidden="true" />
                  <span>
                    <strong>Cash on pickup</strong>
                    <small>Pay at the store when your order is collected.</small>
                  </span>
                  {paymentMethod === "CASH_ON_PICKUP" ? <CheckCircle2 aria-hidden="true" /> : null}
                </label>
              </div>
              {pendingPaymongoOrder ? (
                <div className="customer-payment-resume" role="status">
                  <ShieldCheck aria-hidden="true" size={18} />
                  <span>
                    Order <strong>{pendingPaymongoOrder.orderNumber}</strong> is already saved.
                    Retrying will reopen payment for this same order.
                  </span>
                </div>
              ) : null}
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
              disabled={submitting || addressLoading}
              type="submit"
            >
              {submitting
                ? paymentMethod === "PAYMONGO"
                  ? "Starting secure checkout..."
                  : "Checking stock..."
                : pendingPaymongoOrder
                  ? "Retry PayMongo checkout"
                  : paymentMethod === "PAYMONGO"
                    ? "Continue to PayMongo"
                    : "Place pickup order"}
            </button>
          </aside>
        </form>
      </div>
    </div>
  );
}

export { LAST_ORDER_KEY };
