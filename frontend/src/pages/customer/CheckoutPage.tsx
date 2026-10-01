import { Checkbox } from "@base-ui/react/checkbox";
import {
  ArrowLeft,
  Banknote,
  Check,
  CheckCircle2,
  CreditCard,
  MapPin,
  Phone,
  ShieldCheck,
  Truck
} from "lucide-react";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";

import { CustomerLink } from "@/components/customer/CustomerLink";
import { formatCurrency } from "@/components/customer/ProductCard";
import { ScrollArea } from "@/components/ui/scroll-area";
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

function normalizeCheckoutAddress(address: CustomerAddress): CustomerAddress {
  return {
    addressLine1: address.addressLine1.trim(),
    addressLine2: address.addressLine2.trim(),
    barangay: address.barangay.trim(),
    cityMunicipality: address.cityMunicipality.trim(),
    provinceRegion: address.provinceRegion.trim(),
    postalCode: address.postalCode.trim(),
    country: "Philippines"
  };
}

function checkoutAddressIsComplete(address: CustomerAddress) {
  return (
    address.addressLine1.length >= 3 &&
    address.barangay.length >= 2 &&
    address.cityMunicipality.length >= 2 &&
    address.provinceRegion.length >= 2 &&
    address.postalCode.length >= 3
  );
}

export function CheckoutPage({ navigate }: { navigate: (path: string) => void }) {
  const { items, itemCount, subtotal, clearCart, isReady } = useCart();
  const { customer, status } = useCustomerAuth();
  const savedContactPhone = customer?.defaultContactPhone ?? customer?.phone ?? "";
  const [contact, setContact] = useState(() => getCustomerCheckoutDefaults(customer));
  const [contactEdited, setContactEdited] = useState(false);
  const [editingContactPhone, setEditingContactPhone] = useState(() => !savedContactPhone);
  const [saveContactPhoneToAccount, setSaveContactPhoneToAccount] = useState(
    () => !savedContactPhone
  );
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
    if (!contactEdited) setContact(getCustomerCheckoutDefaults(customer));
    setEditingContactPhone(!savedContactPhone);
    setSaveContactPhoneToAccount(!savedContactPhone);
  }, [contactEdited, customer, savedContactPhone]);

  useEffect(() => {
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
          setSaveAddressToAccount(true);
          return;
        }
        setSavedAddress(loadedAddress);
        setAddress(loadedAddress);
        setEditingAddress(false);
        setSaveAddressToAccount(false);
      })
      .catch((reason) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setSavedAddress(null);
        setAddress(EMPTY_CUSTOMER_ADDRESS);
        setEditingAddress(true);
        setSaveAddressToAccount(true);
        setAddressLoadError(
          "Your saved address could not be loaded. Enter the delivery address below."
        );
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

    const form = new FormData(event.currentTarget);
    const effectivePhone = (
      editingContactPhone ? contact.customerPhone : savedContactPhone || contact.customerPhone
    ).trim();
    const effectiveAddress = normalizeCheckoutAddress(
      editingAddress ? address : savedAddress ?? address
    );
    const customerName = contact.customerName.trim();
    const customerEmail = contact.customerEmail.trim();
    const notes = String(form.get("notes") ?? "").trim();

    if (!pendingPaymongoOrder) {
      if (customerName.length < 2) {
        setError("Enter your full name before placing the order.");
        return;
      }
      if (effectivePhone.length < 7) {
        setError("Enter a valid mobile number for delivery coordination.");
        return;
      }
      if (!checkoutAddressIsComplete(effectiveAddress)) {
        setError("Complete the delivery address before placing the order.");
        return;
      }
    }

    setSubmitting(true);
    setError("");
    let retryOrder = pendingPaymongoOrder;

    try {
      let order = pendingPaymongoOrder;

      if (!order) {
        order = await placeStorefrontOrder({
          customerName,
          customerEmail,
          customerPhone: effectivePhone,
          customerAddress: effectiveAddress,
          saveAddressToAccount: Boolean(customer && editingAddress && saveAddressToAccount),
          saveContactPhoneToAccount: Boolean(
            customer && editingContactPhone && saveContactPhoneToAccount
          ),
          notes,
          fulfillmentMethod: "DELIVERY",
          paymentMethod,
          items: items.map((item) => ({
            productId: item.product.id,
            quantity: item.quantity
          }))
        });
        sessionStorage.setItem(LAST_ORDER_KEY, JSON.stringify(order));
      }

      if (order.paymentMethod === "PAYMONGO") {
        try {
          const paymongoCheckout = await startPaymongoCheckout(order.orderNumber);
          clearCart();
          window.location.assign(paymongoCheckout.checkoutUrl);
          return;
        } catch (reason) {
          retryOrder = order;
          setPendingPaymongoOrder(order);
          throw reason;
        }
      }

      clearCart();
      navigate(`/order-success?order=${encodeURIComponent(order.orderNumber)}`);
    } catch (reason) {
      setError(
        retryOrder
          ? `Order ${retryOrder.orderNumber} is saved. PayMongo checkout could not be opened; retry payment without creating another order.`
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
          <p className="customer-kicker">Delivery checkout</p>
          <h1>Checkout</h1>
          <p>
            Confirm your delivery details, then choose secure online payment or Cash on Delivery.
          </p>
        </div>

        <form className="customer-checkout-layout" onSubmit={submit}>
          <div className="customer-checkout-form">
            <section>
              <div className="customer-checkout-section-title">
                <span>1</span>
                <div>
                  <h2>Your details</h2>
                  <p>We prefilled your account details. You can edit them for this order.</p>
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
                <div className="customer-checkout-contact-field">
                  <span className="customer-checkout-field-label">Mobile number</span>
                  {savedContactPhone && !editingContactPhone ? (
                    <div className="customer-choice-card customer-choice-card--compact is-selected">
                      <Phone aria-hidden="true" />
                      <div>
                        <strong>Use saved contact number</strong>
                        <span>{savedContactPhone}</span>
                        <button
                          className="customer-address-change"
                          onClick={() => {
                            setEditingContactPhone(true);
                            setSaveContactPhoneToAccount(false);
                          }}
                          type="button"
                        >
                          Use a different number
                        </button>
                      </div>
                      <CheckCircle2 aria-hidden="true" />
                    </div>
                  ) : (
                    <div className="customer-checkout-alternate-field">
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
                      {savedContactPhone ? (
                        <button
                          className="customer-checkout-use-saved"
                          onClick={() => {
                            setContact((current) => ({
                              ...current,
                              customerPhone: savedContactPhone
                            }));
                            setEditingContactPhone(false);
                            setSaveContactPhoneToAccount(false);
                          }}
                          type="button"
                        >
                          Use saved number
                        </button>
                      ) : null}
                      <label className="customer-profile-default-option">
                        <Checkbox.Root
                          checked={saveContactPhoneToAccount}
                          className="customer-address-save-checkbox"
                          onCheckedChange={setSaveContactPhoneToAccount}
                        >
                          <Checkbox.Indicator>
                            <Check aria-hidden="true" size={14} />
                          </Checkbox.Indicator>
                        </Checkbox.Root>
                        <span>
                          <strong>Save as my default contact number</strong>
                          <small>Use this number automatically on future checkouts.</small>
                        </span>
                      </label>
                    </div>
                  )}
                </div>
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
                  <h2>Delivery address</h2>
                  <p>
                    This is where your order will be delivered. Check the details before placing it.
                  </p>
                </div>
              </div>

              {addressLoading ? (
                <div className="customer-choice-card" role="status">
                  <MapPin aria-hidden="true" />
                  <div>
                    <strong>Loading saved address...</strong>
                    <span>Checking your account delivery details.</span>
                  </div>
                </div>
              ) : savedAddress && !editingAddress ? (
                <div className="customer-choice-card is-selected">
                  <MapPin aria-hidden="true" />
                  <div>
                    <strong>Deliver to this address</strong>
                    <span>{addressSummary(savedAddress)}</span>
                    <button
                      className="customer-address-change"
                      onClick={() => {
                        setAddress(EMPTY_CUSTOMER_ADDRESS);
                        setEditingAddress(true);
                        setSaveAddressToAccount(false);
                      }}
                      type="button"
                    >
                      Use a different address
                    </button>
                  </div>
                  <CheckCircle2 aria-hidden="true" />
                </div>
              ) : (
                <div className="customer-checkout-alternate-address">
                  {savedAddress ? (
                    <button
                      className="customer-checkout-use-saved"
                      onClick={() => {
                        setAddress(savedAddress);
                        setEditingAddress(false);
                        setSaveAddressToAccount(false);
                      }}
                      type="button"
                    >
                      Use saved address
                    </button>
                  ) : null}
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
                </div>
              )}

              {addressLoadError ? (
                <div className="customer-form-error" role="status">
                  {addressLoadError}
                </div>
              ) : null}

              {editingAddress ? (
                <label className="customer-address-save-option">
                  <Checkbox.Root
                    checked={saveAddressToAccount}
                    className="customer-address-save-checkbox"
                    onCheckedChange={setSaveAddressToAccount}
                  >
                    <Checkbox.Indicator>
                      <Check aria-hidden="true" size={14} />
                    </Checkbox.Indicator>
                  </Checkbox.Root>
                  <span className="customer-address-save-copy">
                    <strong>Save as my default delivery address</strong>
                    <small>Use this address automatically on future checkouts.</small>
                  </span>
                </label>
              ) : null}
            </section>

            <section>
              <div className="customer-checkout-section-title">
                <span>3</span>
                <div>
                  <h2>Payment method</h2>
                  <p>Pay securely online now or pay in cash when your order arrives.</p>
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
                      Secure hosted test checkout. Pay before delivery using an available PayMongo
                      test payment method. No real money will be charged.
                    </small>
                  </span>
                  {paymentMethod === "PAYMONGO" ? <CheckCircle2 aria-hidden="true" /> : null}
                </label>

                <label
                  className={`customer-payment-option${paymentMethod === "CASH_ON_DELIVERY" ? " is-selected" : ""}`}
                >
                  <input
                    checked={paymentMethod === "CASH_ON_DELIVERY"}
                    disabled={Boolean(pendingPaymongoOrder)}
                    name="paymentMethod"
                    onChange={() => setPaymentMethod("CASH_ON_DELIVERY")}
                    type="radio"
                    value="CASH_ON_DELIVERY"
                  />
                  <Banknote aria-hidden="true" />
                  <span>
                    <strong>Cash on Delivery</strong>
                    <small>Pay in cash when your order arrives at your delivery address.</small>
                  </span>
                  {paymentMethod === "CASH_ON_DELIVERY" ? (
                    <CheckCircle2 aria-hidden="true" />
                  ) : null}
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
            </section>

            <section>
              <div className="customer-checkout-section-title">
                <span>4</span>
                <div>
                  <h2>Order notes</h2>
                  <p>
                    Add delivery instructions or a short note for store staff. This is optional.
                  </p>
                </div>
              </div>
              <label className="customer-notes-field customer-notes-field--standalone">
                <span>
                  Notes <small>(optional)</small>
                </span>
                <textarea
                  maxLength={255}
                  name="notes"
                  placeholder="Example: Please call before delivery."
                  rows={3}
                />
              </label>
            </section>
          </div>

          <aside className="customer-order-summary customer-checkout-summary">
            <div className="customer-order-summary__heading">
              <p className="customer-kicker">Final review</p>
              <h2>
                {itemCount} item{itemCount === 1 ? "" : "s"}
              </h2>
            </div>

            <ScrollArea
              className="customer-checkout-scroll-area"
              style={{ height: Math.min(260, Math.max(64, items.length * 42)) }}
              viewportClassName="customer-checkout-scroll-area__viewport"
            >
              <div className="customer-checkout-scroll-area__content">
                {items.map((item) => (
                  <div className="customer-checkout-line" key={item.product.id}>
                    <span>
                      {item.quantity} × {item.product.name}
                    </span>
                    <strong>
                      {formatCurrency(Number(item.product.sellingPrice) * item.quantity)}
                    </strong>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="customer-order-summary__row">
              <span>Delivery</span>
              <strong>Store coordinated</strong>
            </div>

            <div className="customer-order-summary__total">
              <span>Total</span>
              <strong>{formatCurrency(subtotal)}</strong>
            </div>

            <div className="customer-order-summary__payment">
              {paymentMethod === "PAYMONGO" ? (
                <CreditCard aria-hidden="true" />
              ) : (
                <Truck aria-hidden="true" />
              )}
              <div>
                <strong>
                  {paymentMethod === "PAYMONGO" ? "PayMongo online payment" : "Cash on Delivery"}
                </strong>
                <span>
                  {paymentMethod === "PAYMONGO"
                    ? "Payment is verified before delivery."
                    : "Payment is collected when your order arrives."}
                </span>
              </div>
            </div>

            <p className="customer-order-summary__helper">
              Store staff will prepare your order and coordinate the courier. You can follow its
              delivery status from My Account.
            </p>

            {error ? (
              <div aria-live="assertive" className="customer-form-error" role="alert">
                {error}
              </div>
            ) : null}

            <button
              className="customer-button customer-button--full customer-order-summary__action"
              disabled={submitting || addressLoading}
              type="submit"
            >
              {submitting
                ? paymentMethod === "PAYMONGO"
                  ? "Starting secure checkout..."
                  : "Placing delivery order..."
                : pendingPaymongoOrder
                  ? "Retry PayMongo checkout"
                  : paymentMethod === "PAYMONGO"
                    ? "Continue to PayMongo"
                    : "Place COD order"}
            </button>
          </aside>
        </form>
      </div>
    </div>
  );
}

export { LAST_ORDER_KEY };
