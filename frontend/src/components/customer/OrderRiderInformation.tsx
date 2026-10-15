import { Copy, MessageSquareText, Truck } from "lucide-react";
import { useState } from "react";
import type { StorefrontOrder } from "@/types/storefront";
import "@/styles/customer-delivery-handoff.css";

export function OrderRiderInformation({ order }: { order: StorefrontOrder }) {
  const [copyFeedback, setCopyFeedback] = useState("");
  if (!["OUT_FOR_DELIVERY", "DELIVERED"].includes(order.deliveryStatus)) return null;
  if (!order.courierProvider && !order.riderPhone && !order.customerDeliveryNote) return null;

  const riderName = order.riderName?.trim() || "Delivery rider";
  const delivered = order.deliveryStatus === "DELIVERED";

  async function copyContact() {
    if (!order.riderPhone) return;
    try {
      await navigator.clipboard.writeText(order.riderPhone);
      setCopyFeedback("Rider number copied.");
    } catch {
      setCopyFeedback("Copy unavailable. Select the number to copy it manually.");
    }
  }

  return (
    <section aria-label="Rider information" className="customer-rider-handoff">
      <div className="customer-rider-handoff__header">
        <span aria-hidden="true" className="customer-rider-handoff__header-icon">
          <Truck size={19} />
        </span>
        <div className="customer-rider-handoff__heading">
          <strong>Rider information</strong>
          <span>{delivered ? "Delivery completed" : "Your delivery is on its way"}</span>
        </div>
        <span className="customer-rider-handoff__status">
          {delivered ? "Delivered" : "On the way"}
        </span>
      </div>

      <div className="customer-rider-handoff__identity">
        <span aria-hidden="true" className="customer-rider-handoff__avatar">
          {riderName.charAt(0).toLocaleUpperCase()}
        </span>
        <div className="customer-rider-handoff__identity-copy">
          <strong>{riderName}</strong>
          <span>{order.courierProvider || "Courier"} · Delivery partner</span>
        </div>
      </div>

      {order.riderPhone ? (
        <div className="customer-rider-handoff__contact">
          <div className="customer-rider-handoff__contact-copy">
            <span>Contact number</span>
            <strong className="customer-rider-handoff__phone">{order.riderPhone}</strong>
          </div>
          <button
            aria-label="Copy rider contact number"
            className="customer-rider-handoff__copy"
            onClick={() => void copyContact()}
            type="button"
          >
            <Copy aria-hidden="true" size={16} />
            Copy
          </button>
        </div>
      ) : null}
      {copyFeedback ? (
        <p aria-live="polite" className="customer-rider-handoff__feedback" role="status">
          {copyFeedback}
        </p>
      ) : null}

      {order.courierReference ? (
        <p className="customer-rider-handoff__reference">
          <span>Booking reference</span>
          <strong>{order.courierReference}</strong>
        </p>
      ) : null}

      {order.customerDeliveryNote ? (
        <div className="customer-rider-handoff__note">
          <div className="customer-rider-handoff__note-title">
            <MessageSquareText aria-hidden="true" size={16} />
            <strong>Delivery instructions</strong>
          </div>
          <p>{order.customerDeliveryNote}</p>
          <small>For delivery coordination only.</small>
        </div>
      ) : null}
    </section>
  );
}
