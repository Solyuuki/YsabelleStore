export type RetailReceiptItem = {
  barcode: string | null;
  lineTotal: string;
  productName: string;
  quantity: number;
  sku: string;
  unitPrice: string;
};

export type RetailReceiptData = {
  cashReceived: string;
  cashierName: string | null;
  change: string;
  discountAmount?: string | null;
  itemCount: number;
  items: RetailReceiptItem[];
  paymentMethod: "CASH";
  receiptNumber: string;
  saleDate: string;
  subtotal: string;
  taxAmount?: string | null;
  total: string;
};
