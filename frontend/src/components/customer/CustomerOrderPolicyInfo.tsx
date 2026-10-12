import { ChevronDown, Info } from "lucide-react";

export function CustomerOrderPolicyInfo() {
  return (
    <details className="customer-order-policy">
      <summary className="customer-order-policy__trigger">
        <Info aria-hidden="true" size={17} />
        <span>Order cancellation policy</span>
        <ChevronDown aria-hidden="true" className="customer-order-policy__chevron" size={16} />
      </summary>
      <div className="customer-order-policy__content">
        <p>You can review and change your cart until you submit the order.</p>
        <p>
          After placing an order, you cannot cancel it directly from your account. Contact the
          store to request a cancellation. Whether it can be cancelled depends on its preparation,
          delivery and payment status; paid orders may require a refund process.
        </p>
      </div>
    </details>
  );
}
