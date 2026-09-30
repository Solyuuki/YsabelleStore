import type { CustomerAddress } from "@/types/customerAddress";

export type StorefrontCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  productCount: number;
  storefrontCover: {
    imageUrl: string;
    position:
      | "LEFT"
      | "CENTER"
      | "RIGHT"
      | "TOP"
      | "BOTTOM"
      | "TOP_LEFT"
      | "TOP_RIGHT"
      | "BOTTOM_LEFT"
      | "BOTTOM_RIGHT";
  } | null;
};

export type StorefrontProduct = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  detailImageUrl?: string | null;
  unit: string;
  sellingPrice: string;
  availableStock: number;
  stockStatus: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
  averageRating: number;
  reviewCount: number;
  category: Pick<StorefrontCategory, "id" | "name" | "slug">;
};

export type StorefrontSizeVariant = {
  id: string;
  name: string;
  imageUrl: string | null;
  sellingPrice: string;
  availableStock: number;
  stockStatus: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
  sizeValue: string;
  sizeUnit: "MILLILITER" | "LITER" | "GRAM" | "KILOGRAM" | "PIECE";
  unit: string;
  packagingLabel: string;
  sizeTier: "SMALL" | "MEDIUM" | "LARGE" | null;
};

export type StorefrontProductDetail = StorefrontProduct & {
  sizeVariants: StorefrontSizeVariant[];
};

export type StorefrontPagination = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type StorefrontProductReview = {
  id: string;
  reviewerDisplayName: string;
  rating: number;
  comment: string;
  createdAt: string;
  verifiedPurchase: boolean;
};

export type StorefrontProductReviews = {
  summary: {
    averageRating: number | null;
    totalReviews: number;
    distribution: Array<{
      rating: number;
      count: number;
      percentage: number;
    }>;
  };
  reviews: StorefrontProductReview[];
  meta: StorefrontPagination;
};

export type StorefrontRelatedProducts = {
  category: Pick<StorefrontCategory, "id" | "name" | "slug">;
  sameCategory: StorefrontProduct[];
  fallback: StorefrontProduct[];
};

export type StorefrontMerchandisingEntry = {
  product: StorefrontProduct;
  rank: number;
  unitsSold: number;
  trendingScore: number;
  recentReviewCount: number;
  favoriteCount: number;
};

export type StorefrontMerchandising = {
  bestSellers: StorefrontMerchandisingEntry[];
  generatedAt: string;
  trending: StorefrontMerchandisingEntry[];
  trendingWindowDays: number;
};

export type StorefrontFavoriteProduct = StorefrontProduct & {
  favoritedAt: string;
};

export type StorefrontReviewContext = {
  eligible: boolean;
  reason: string | null;
  verifiedOrder: {
    id: string;
    orderNumber: string;
    completedAt: string;
  } | null;
  review: {
    id: string;
    rating: number;
    comment: string;
    status: "VISIBLE" | "HIDDEN" | "REMOVED";
    createdAt: string;
    updatedAt: string;
    verifiedPurchase: boolean;
  } | null;
};

export type StorefrontReviewInput = {
  rating: number;
  comment: string;
};

export type StorefrontPaymentMethod = "CASH_ON_DELIVERY" | "PAYMONGO";
export type StorefrontPaymentStatus = "PENDING" | "PAID" | "FAILED" | "CANCELLED";
export type StorefrontDeliveryStatus =
  | "ORDER_PLACED"
  | "PREPARING"
  | "READY_FOR_DELIVERY"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "DELIVERY_FAILED"
  | "CANCELLED";

export type StorefrontDeliveryTimelineEvent = {
  id: string;
  status: StorefrontDeliveryStatus;
  actorType: "SYSTEM" | "STAFF" | "CUSTOMER";
  note: string | null;
  createdAt: string;
};

export type StorefrontOrder = {
  id: string;
  orderNumber: string;
  deliveryTicketNumber: string;
  status: "PENDING" | "CONFIRMED" | "PROCESSING" | "COMPLETED" | "CANCELLED";
  fulfillmentMethod: "DELIVERY";
  paymentMethod: StorefrontPaymentMethod;
  paymentStatus: StorefrontPaymentStatus;
  deliveryStatus: StorefrontDeliveryStatus;
  courierProvider: string | null;
  courierReference: string | null;
  deliveryNotes: string | null;
  dispatchedAt: string | null;
  deliveredAt: string | null;
  customerConfirmedAt: string | null;
  totalAmount: string;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  address: CustomerAddress | null;
  timeline: StorefrontDeliveryTimelineEvent[];
  canCustomerConfirmReceipt: boolean;
  itemCount: number;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: string;
    totalAmount: string;
  }>;
};

export type StorefrontOrderInput = {
  customerName: string;
  customerEmail?: string;
  customerPhone: string;
  customerAddress: CustomerAddress;
  saveAddressToAccount?: boolean;
  saveContactPhoneToAccount?: boolean;
  notes?: string;
  fulfillmentMethod: "DELIVERY";
  paymentMethod: StorefrontPaymentMethod;
  items: Array<{ productId: string; quantity: number }>;
};

export type PaymongoCheckoutSession = {
  checkoutSessionId: string;
  checkoutUrl: string;
  livemode: false;
};

export type StorefrontPaymentStatusResult = {
  orderNumber: string;
  paymentMethod: StorefrontPaymentMethod;
  paymentStatus: StorefrontPaymentStatus;
  totalAmount: string;
  itemCount: number;
  paidAt: string | null;
  canResumePayment: boolean;
};
