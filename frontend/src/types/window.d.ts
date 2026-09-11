import type { RetailReceiptData } from "@/types/receipt";

type ReceiptPrinterInfo = {
  description: string;
  displayName: string;
  isDefault: boolean;
  name: string;
  status: number;
};

type ReceiptPrinterStatus = {
  activePrinterName: string | null;
  availablePrinters: ReceiptPrinterInfo[];
  isAvailable: boolean;
  selectedPrinterName: string | null;
  source: "auto" | "none" | "saved";
};

type ReceiptPrintResult = {
  printed: boolean;
  printerName: string | null;
  reason: string | null;
  requestId: string;
};

type DesktopApi = {
  isElectron: true;
  invoke(channel: string, ...args: unknown[]): Promise<unknown>;
  platform: NodeJS.Platform;
  receipt: {
    getPrinterStatus(): Promise<ReceiptPrinterStatus>;
    print(receipt: RetailReceiptData): Promise<ReceiptPrintResult>;
    selectPrinter(printerName: string): Promise<ReceiptPrinterStatus>;
  };
};

declare global {
  interface Window {
    electron: DesktopApi;
    ysabelleStore: DesktopApi;
  }
}

export {};
