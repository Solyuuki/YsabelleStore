export type PosProduct = {
  availableStock: number;
  barcode: string | null;
  categoryName: string;
  id: string;
  isActive: boolean;
  name: string;
  sku: string;
  sellingPrice: string;
  unit: string;
};

export type PosProductSearchResponse = {
  catalogCount: number;
  products: PosProduct[];
  query: string;
};

export type PosCheckoutItemInput = {
  productId: string;
  quantity: number;
};

export type PosCheckoutRequest = {
  items: PosCheckoutItemInput[];
  notes?: string;
  paymentMethod: "CASH";
};

export type PosSaleItem = {
  batchId: string | null;
  barcode: string | null;
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  sku: string;
  totalAmount: string;
  unitPrice: string;
};

export type PosSale = {
  cashierName: string | null;
  discountAmount: string;
  id: string;
  itemCount: number;
  items: PosSaleItem[];
  saleDate: string;
  saleNumber: string;
  status: "DRAFT" | "COMPLETED" | "VOIDED";
  subtotalAmount: string;
  totalAmount: string;
};

export type PosCheckoutResponse = {
  sale: PosSale;
};

export type PosSalesListResponse = {
  sales: PosSale[];
};
