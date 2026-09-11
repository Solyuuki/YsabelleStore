export type ReceiptPrintItem = {
  barcode: string | null;
  lineTotal: string;
  productName: string;
  quantity: number;
  sku: string;
  unitPrice: string;
};

export type ReceiptPrintPayload = {
  cashReceived: string;
  cashierName: string | null;
  change: string;
  discountAmount?: string | null;
  itemCount: number;
  items: ReceiptPrintItem[];
  paymentMethod: "CASH";
  receiptNumber: string;
  saleDate: string;
  subtotal: string;
  taxAmount?: string | null;
  total: string;
};

export type ReceiptPrinterInfo = {
  description: string;
  displayName: string;
  isDefault?: boolean;
  name: string;
  status?: number;
};

export type ReceiptPrinterSelectionSource = "auto" | "none" | "saved";

export type ReceiptPrinterStatus = {
  activePrinterName: string | null;
  availablePrinters: ReceiptPrinterInfo[];
  isAvailable: boolean;
  selectedPrinterName: string | null;
  source: ReceiptPrinterSelectionSource;
};

export type ReceiptPrintResult = {
  printed: boolean;
  printerName: string | null;
  reason: string | null;
  requestId: string;
};
