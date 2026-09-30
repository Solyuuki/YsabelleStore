import {
  Check,
  CircleAlert,
  CreditCard,
  LoaderCircle,
  PackageCheck,
  RefreshCw,
  ShoppingBasket,
  Truck
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { CustomerLink } from "@/components/customer/CustomerLink";
import { formatCurrency } from "@/components/customer/ProductCard";
import { fetchStorefrontPaymentStatus, startPaymongoCheckout } from "@/services/storefrontService";
import type { StorefrontOrder, StorefrontPaymentStatusResult } from "@/types/storefront";
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
  const paid = isPaymongo && paymentStatus === "PAID";
  const paymentPending = isPaymongo && !paid;
  const cancelledReturn = paymentReturn === "cancelled" && paymentStatus !== "PAID";

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

  return (
    <div className="customer-page customer-success-page">
      <div className="customer-container customer-success-card">
        <div className={`customer-success-card__icon${paymentPending ? " is-pending" : ""}`}>
          {paymentPending ? <CreditCard aria-hidden="true" /> : <PackageCheck aria-hidden="true" />}
        </div>

        <p className="customer-kicker">
          {paid ? "Payment confirmed" : paymentPending ? "Order saved" : "Delivery order placed"}
        </p>
        <h1>
          {paid
            ? "Payment Confirmed. We’ll Prepare Your Delivery."
            : paymentPending
              ? "Your Order Is Saved."
              : "Your Delivery Order Is Confirmed."}
        </h1>
        <p>
          {paid
            ? "PayMongo confirmed the test payment. Store staff can now prepare and coordinate delivery."
            : paymentPending
              ? cancelledReturn
                ? "You left PayMongo before payment was confirmed. Your order is safe and you can resume the same payment below."
                : "We are checking PayMongo for a confirmed test payment. The browser redirect alone never marks your order paid."
              : "Your Cash on Delivery order is saved. Store staff will prepare it and coordinate a courier for your address."}
        </p>

        {orderNumber ? (
          <div className="customer-order-reference">
            <span>Order reference</span>
            <strong>{orderNumber}</strong>
            {order?.deliveryTicketNumber ? <small>{order.deliveryTicketNumber}</small> : null}
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
                  : "Payment is not finalized from the return URL alone."}
              </span>
            </div>
          </div>
        ) : (
          <div className="customer-payment-status" role="status">
            <Truck aria-hidden="true" />
            <div>
              <strong>Cash on Delivery</strong>
              <span>Pay in cash when your order arrives.</span>
            </div>
          </div>
        )}

        {paymentError ? (
          <div className="customer-form-error" role="alert">
            {paymentError}
          </div>
        ) : null}

        <div className="customer-success-pickup">
          <Truck aria-hidden="true" />
          <div>
            <strong>Delivery tracking starts here</strong>
            <span>
              Open My Account to follow Preparing, Ready for delivery, On the way, and Delivered.
            </span>
            <small>
              Courier booking is coordinated by store staff. Grab, Lalamove, or another service can
              be recorded on your delivery ticket.
            </small>
          </div>
        </div>

        <p className="customer-success-card__note">
          {paid
            ? "Your order is paid. Inventory is finalized when the delivery is completed."
            : "For COD, payment remains pending until delivery is confirmed and store staff verifies cash collection."}
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
            <CustomerLink className="customer-button" href="/account" navigate={navigate}>
              <Truck aria-hidden="true" size={18} /> Track my order
            </CustomerLink>
          )}
          <CustomerLink
            className="customer-button customer-button--secondary"
            href="/shop"
            navigate={navigate}
          >
            <ShoppingBasket aria-hidden="true" size={18} /> Continue shopping
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
