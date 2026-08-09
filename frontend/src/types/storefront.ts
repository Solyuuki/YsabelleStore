export type StorefrontCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  productCount: number;
};

export type StorefrontProduct = {
  id: string;
  name: string;
  description: string | null;
  imageUrl?: string | null;
  unit: string;
  sellingPrice: string;
  availableStock: number;
  stockStatus: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
  category: Pick<StorefrontCategory, "id" | "name" | "slug">;
};

export type StorefrontPagination = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type StorefrontOrder = {
  id: string;
  orderNumber: string;
  status: "PENDING";
  fulfillmentMethod: "STORE_PICKUP";
  paymentMethod: "CASH_ON_PICKUP";
  totalAmount: string;
  createdAt: string;
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
  notes?: string;
  fulfillmentMethod: "STORE_PICKUP";
  paymentMethod: "CASH_ON_PICKUP";
  items: Array<{ productId: string; quantity: number }>;
};
