import {
  Check,
  CircleAlert,
  CreditCard,
  LoaderCircle,
  MapPin,
  RefreshCw,
  ShoppingBasket
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { CustomerLink } from "@/components/customer/CustomerLink";
import { formatCurrency } from "@/components/customer/ProductCard";
import {
  fetchStorefrontPaymentStatus,
  startPaymongoCheckout
} from "@/services/storefrontService";
import type {
  StorefrontOrder,
  StorefrontPaymentStatusResult
} from "@/types/storefront";
import { LAST_ORDER_KEY } from "./CheckoutPage";

const PAYMENT_POLL_ATTEMPTS = 5;
const PAYMENT_POLL_DELAY_MS = 2_000;

export function OrderSuccessPage({
  location,
  navigate
}: {
  location: string;
  navigate: (path: string) => void;
}) {
  const order = useMemo(readOrder, []);
  const locationUrl = useMemo(() => new URL(location, window.location.origin), [location]);
  const orderNumber = order?.orderNumber ?? locationUrl.searchParams.get("order");
  const paymentReturn = locationUrl.searchParams.get("payment");
  const isPaymongo = order?.paymentMethod === "PAYMONGO" || paymentReturn !== null;
  const [payment, setPayment] = useState<StorefrontPaymentStatusResult | null>(null);
  const [checkingPayment, setCheckingPayment] = useState(isPaymongo);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [resumingPayment, setResumingPayment] = useState(false);

  useEffect(() => {
    if (!isPaymongo || !orderNumber) return;

    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

    async function refreshPayment() {
      attempts += 1;
      setCheckingPayment(true);

      try {
        const status = await fetchStorefrontPaymentStatus(orderNumber!, controller.signal);
        if (controller.signal.aborted) return;

        setPayment(status);
        setPaymentError(null);

        if (status.paymentStatus === "PENDING" && attempts < PAYMENT_POLL_ATTEMPTS) {
          timeout = setTimeout(() => void refreshPayment(), PAYMENT_POLL_DELAY_MS);
        }
      } catch (reason) {
        if (controller.signal.aborted) return;
        setPaymentError(
          reason instanceof Error
            ? reason.message
            : "Payment status could not be checked right now."
        );
      } finally {
        if (!controller.signal.aborted) setCheckingPayment(false);
      }
    }

    void refreshPayment();

    return () => {
      controller.abort();
      if (timeout) clearTimeout(timeout);
    };
  }, [isPaymongo, orderNumber]);

  const paymentStatus = payment?.paymentStatus ?? order?.paymentStatus ?? "PENDING";
  const displayTotal = payment?.totalAmount ?? order?.totalAmount;
  const displayItemCount = payment?.itemCount ?? order?.itemCount;

  async function resumePayment() {
    if (!orderNumber || resumingPayment) return;

    setResumingPayment(true);
    setPaymentError(null);

    try {
      const checkout = await startPaymongoCheckout(orderNumber);
      window.location.assign(checkout.checkoutUrl);
    } catch (reason) {
      setPaymentError(
        reason instanceof Error ? reason.message : "PayMongo checkout could not be reopened."
      );
      setResumingPayment(false);
    }
  }

  const paid = isPaymongo && paymentStatus === "PAID";
  const paymentPending = isPaymongo && !paid;
  const cancelledReturn = paymentReturn === "cancelled" && paymentStatus !== "PAID";

  return (
    <div className="customer-page customer-success-page">
      <div className="customer-container customer-success-card">
        <div
          className={`customer-success-card__icon${paymentPending ? " is-pending" : ""}`}
        >
          {paymentPending ? <CreditCard aria-hidden="true" /> : <Check aria-hidden="true" />}
        </div>
        <p className="customer-kicker">
          {paid
            ? "Test payment confirmed"
            : paymentPending
              ? "Order saved"
              : "Pickup request received"}
        </p>
        <h1>
          {paid
            ? "Your Test Payment Is Confirmed."
            : paymentPending
              ? "Your Order Is Saved."
              : "Your Essentials Are on the List."}
        </h1>
        <p>
          {paid
            ? "PayMongo confirmed this sandbox payment. The store can now continue processing your pickup order."
            : paymentPending
              ? cancelledReturn
                ? "You left PayMongo before payment was confirmed. Your order is safe and you can resume the same payment below."
                : "We are checking PayMongo for a confirmed test payment. Your order will not be marked paid from the browser redirect alone."
              : "The store has received your pending pickup order. Please keep the reference number below."}
        </p>

        {orderNumber ? (
          <div className="customer-order-reference">
            <span>Order reference</span>
            <strong>{orderNumber}</strong>
          </div>
        ) : null}

        {displayTotal !== undefined && displayItemCount !== undefined ? (
          <div className="customer-success-summary">
            <span>
              {displayItemCount} item{displayItemCount === 1 ? "" : "s"}
            </span>
            <strong>{formatCurrency(Number(displayTotal))}</strong>
          </div>
        ) : null}

        {isPaymongo ? (
          <div
            className={`customer-payment-status customer-payment-status--${paymentStatus.toLowerCase()}`}
            role="status"
          >
            {checkingPayment ? (
              <LoaderCircle aria-hidden="true" className="customer-payment-spinner" />
            ) : paid ? (
              <Check aria-hidden="true" />
            ) : (
              <CircleAlert aria-hidden="true" />
            )}
            <div>
              <strong>
                {paid
                  ? "PayMongo test payment: Paid"
                  : checkingPayment
                    ? "Checking PayMongo..."
                    : `PayMongo payment: ${paymentStatus}`}
              </strong>
              <span>
                {paid
                  ? "Verified by the backend against PayMongo."
                  : "No inventory or payment state is finalized from the return URL alone."}
              </span>
            </div>
          </div>
        ) : null}

        {paymentError ? (
          <div className="customer-form-error" role="alert">
            {paymentError}
          </div>
        ) : null}

        <div className="customer-success-pickup">
          <MapPin aria-hidden="true" />
          <div>
            <strong>Store pickup</strong>
            <span>110 A. Mabini Street, Pasig City, Metro Manila</span>
            <small>
              Payment: {isPaymongo ? (paid ? "PayMongo test payment confirmed" : "PayMongo pending") : "Cash on pickup"}
            </small>
          </div>
        </div>

        <p className="customer-success-card__note">
          {paid
            ? "This is still a pickup order until store fulfillment is completed."
            : "This is a pending order request, not a completed sale. Stock is finalized by the store during fulfillment."}
        </p>

        <div className="customer-success-actions">
          {paymentPending && orderNumber ? (
            <button
              className="customer-button"
              disabled={resumingPayment}
              onClick={() => void resumePayment()}
              type="button"
            >
              <RefreshCw aria-hidden="true" size={18} />
              {resumingPayment ? "Opening PayMongo..." : "Resume PayMongo payment"}
            </button>
          ) : (
            <CustomerLink className="customer-button" href="/shop" navigate={navigate}>
              <ShoppingBasket aria-hidden="true" size={18} /> Continue shopping
            </CustomerLink>
          )}
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
