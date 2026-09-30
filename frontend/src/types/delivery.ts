import type { CustomerAddress } from "@/types/customerAddress";
import type {
  StorefrontDeliveryStatus,
  StorefrontDeliveryTimelineEvent,
  StorefrontPaymentMethod,
  StorefrontPaymentStatus
} from "@/types/storefront";

export type DeliveryTicket = {
  id: string;
  orderNumber: string;
  deliveryTicketNumber: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string;
  status: "PENDING" | "CONFIRMED" | "PROCESSING" | "COMPLETED" | "CANCELLED";
  fulfillmentMethod: "DELIVERY";
  paymentMethod: StorefrontPaymentMethod;
  paymentStatus: StorefrontPaymentStatus;
  deliveryStatus: StorefrontDeliveryStatus;
  deliveryStatusLabel: string;
  courierProvider: string | null;
  courierReference: string | null;
  deliveryNotes: string | null;
  dispatchedAt: string | null;
  deliveredAt: string | null;
  customerConfirmedAt: string | null;
  codCollectedAt: string | null;
  codCollectedBy: { id: string; name: string } | null;
  paidAt: string | null;
  sale: { id: string; saleNumber: string } | null;
  totalAmount: string;
  subtotalAmount: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  address: CustomerAddress | null;
  itemCount: number;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: string;
    totalAmount: string;
  }>;
  timeline: StorefrontDeliveryTimelineEvent[];
  canCustomerConfirmReceipt: boolean;
  canConfirmCodCollected: boolean;
};

export type DeliverySummary = Record<StorefrontDeliveryStatus, number>;

export type DeliveryListMeta = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  summary: DeliverySummary;
};

export type DeliveryTransitionInput = {
  targetStatus:
    | "PREPARING"
    | "READY_FOR_DELIVERY"
    | "OUT_FOR_DELIVERY"
    | "DELIVERY_FAILED"
    | "CANCELLED";
  courierProvider?: string;
  courierReference?: string;
  note?: string;
};
