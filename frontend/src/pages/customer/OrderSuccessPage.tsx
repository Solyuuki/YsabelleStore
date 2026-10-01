import {
  Check,
  CircleAlert,
  CreditCard,
  LoaderCircle,
  PackageCheck,
  RefreshCw,
  Banknote,
  ShoppingBasket,
  Truck
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { CustomerLink } from "@/components/customer/CustomerLink";
import { formatCurrency } from "@/components/customer/ProductCard";
import { Button } from "@/components/ui/button";
import {
  fetchStorefrontPaymentStatus,
  startPaymongoCheckout,
  switchStorefrontPaymentToCod
} from "@/services/storefrontService";
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
  const [payment, setPayment] = useState<StorefrontPaymentStatusResult | null>(null);
  const paymentMethod =
    payment?.paymentMethod ??
    order?.paymentMethod ??
    (paymentReturn !== null ? "PAYMONGO" : "CASH_ON_DELIVERY");
  const isPaymongo = paymentMethod === "PAYMONGO";
  const [checkingPayment, setCheckingPayment] = useState(
    order?.paymentMethod === "PAYMONGO" || paymentReturn !== null
  );
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [resumingPayment, setResumingPayment] = useState(false);
  const [switchingPayment, setSwitchingPayment] = useState(false);
  const [paymentChangeMessage, setPaymentChangeMessage] = useState<string | null>(null);

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

  async function switchToCod() {
    if (!orderNumber || switchingPayment) return;
    setSwitchingPayment(true);
    setPaymentError(null);
    setPaymentChangeMessage(null);
    try {
      const status = await switchStorefrontPaymentToCod(orderNumber);
      setPayment(status);
      setPaymentChangeMessage("Payment method changed to Cash on Delivery.");

      if (order) {
        sessionStorage.setItem(
          LAST_ORDER_KEY,
          JSON.stringify({
            ...order,
            paymentMethod: "CASH_ON_DELIVERY",
            paymentStatus: status.paymentStatus
          })
        );
      }
    } catch (reason) {
      setPaymentError(
        reason instanceof Error ? reason.message : "Payment method could not be changed."
      );
    } finally {
      setSwitchingPayment(false);
    }
  }

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
            ? "Payment confirmed."
            : paymentPending
              ? "Your order is saved."
              : "Your order is confirmed."}
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
        {paymentChangeMessage ? (
          <div className="customer-form-success" role="status">
            {paymentChangeMessage}
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

        <div className="customer-success-actions-v2">
          {paymentPending && orderNumber ? (
            <>
              <Button
                className="customer-success-primary-action h-11 w-full rounded-xl text-sm font-semibold"
                disabled={resumingPayment || switchingPayment}
                onClick={() => void resumePayment()}
                type="button"
              >
                <RefreshCw aria-hidden="true" className="h-4 w-4" />
                {resumingPayment ? "Opening PayMongo..." : "Resume PayMongo"}
              </Button>

              <div
                className={
                  payment?.canChangePaymentMethod ? "grid gap-3 sm:grid-cols-2" : "grid gap-3"
                }
              >
                {payment?.canChangePaymentMethod ? (
                  <Button
                    className="customer-success-secondary-action h-11 rounded-xl text-sm font-semibold"
                    disabled={resumingPayment || switchingPayment}
                    onClick={() => void switchToCod()}
                    type="button"
                    variant="secondary"
                  >
                    <Banknote aria-hidden="true" className="h-4 w-4" />
                    {switchingPayment ? "Switching..." : "Use Cash on Delivery"}
                  </Button>
                ) : null}

                <Button
                  asChild
                  className="customer-success-secondary-action h-11 rounded-xl text-sm font-semibold"
                  variant="secondary"
                >
                  <CustomerLink href="/shop" navigate={navigate}>
                    <ShoppingBasket aria-hidden="true" className="h-4 w-4" />
                    Continue shopping
                  </CustomerLink>
                </Button>
              </div>
            </>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                asChild
                className="customer-success-primary-action h-11 rounded-xl text-sm font-semibold"
              >
                <CustomerLink href="/account" navigate={navigate}>
                  <Truck aria-hidden="true" className="h-4 w-4" />
                  Track my order
                </CustomerLink>
              </Button>
              <Button
                asChild
                className="customer-success-secondary-action h-11 rounded-xl text-sm font-semibold"
                variant="secondary"
              >
                <CustomerLink href="/shop" navigate={navigate}>
                  <ShoppingBasket aria-hidden="true" className="h-4 w-4" />
                  Continue shopping
                </CustomerLink>
              </Button>
            </div>
          )}
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
