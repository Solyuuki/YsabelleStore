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
  customerName?: string | null;
  saleSource?: "POS" | "WEB";
  change: string;
  discountAmount?: string | null;
  itemCount: number;
  items: RetailReceiptItem[];
  paymentMethod: "CASH";
  receiptNumber: string;
  saleDate: string;
  subtotal: string;
  vatableSalesAmount: string | null;
  vatAmount: string | null;
  vatExemptSalesAmount: string | null;
  zeroRatedSalesAmount: string | null;
  total: string;
};
