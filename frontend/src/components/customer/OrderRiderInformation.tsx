import { Copy, Phone, Truck } from "lucide-react";
import { useState } from "react";
import type { StorefrontOrder } from "@/types/storefront";
import "@/styles/customer-delivery-handoff.css";

export function OrderRiderInformation({ order }: { order: StorefrontOrder }) {
  const [copyFeedback, setCopyFeedback] = useState("");
  if (!["OUT_FOR_DELIVERY", "DELIVERED"].includes(order.deliveryStatus)) return null;
  if (!order.courierProvider && !order.riderPhone && !order.customerDeliveryNote) return null;
  const contactNumber = order.riderPhone?.replace(/[^\d+]/g, "") ?? "";

  async function copyContact() {
    if (!order.riderPhone) return;
    try {
      await navigator.clipboard.writeText(order.riderPhone);
      setCopyFeedback("Rider number copied.");
    } catch {
      setCopyFeedback("Copy unavailable. Select the number shown above to copy.");
    }
  }

  return (
    <section aria-label="Rider information" className="customer-rider-handoff">
      <div className="customer-rider-handoff__header">
        <Truck aria-hidden="true" size={19} />
        <div>
          <strong>Rider information</strong>
          <span>
            {order.deliveryStatus === "DELIVERED"
              ? "Delivery completed"
              : "Your order is on the way"}
          </span>
        </div>
      </div>
      <div className="customer-rider-handoff__grid">
        <div className="customer-rider-handoff__contact">
          <dl>
            <div>
              <dt>Delivery service</dt>
              <dd>{order.courierProvider || "Courier"}</dd>
            </div>
            {order.riderName ? (
              <div>
                <dt>Rider</dt>
                <dd>{order.riderName}</dd>
              </div>
            ) : null}
            {order.riderPhone ? (
              <div>
                <dt>Contact number</dt>
                <dd className="customer-rider-handoff__phone">{order.riderPhone}</dd>
              </div>
            ) : null}
            {order.courierReference ? (
              <div>
                <dt>Booking reference</dt>
                <dd>{order.courierReference}</dd>
              </div>
            ) : null}
          </dl>
          {order.riderPhone ? (
            <div className="customer-rider-handoff__actions">
              <a className="customer-rider-handoff__call" href={`tel:${contactNumber}`}>
                <Phone aria-hidden="true" size={16} /> Call rider
              </a>
              <button onClick={() => void copyContact()} type="button">
                <Copy aria-hidden="true" size={16} /> Copy number
              </button>
            </div>
          ) : null}
          {copyFeedback ? (
            <p aria-live="polite" className="customer-rider-handoff__feedback">
              {copyFeedback}
            </p>
          ) : null}
        </div>
        {order.customerDeliveryNote ? (
          <div className="customer-rider-handoff__note">
            <strong>Delivery note</strong>
            <p>{order.customerDeliveryNote}</p>
            <small>For delivery coordination only.</small>
          </div>
        ) : null}
      </div>
    </section>
  );
}
