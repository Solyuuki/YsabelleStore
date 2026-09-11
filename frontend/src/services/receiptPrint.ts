import type { RetailReceiptData } from "@/types/receipt";

export const receiptPrintRequestChannel = "ysabellestore:request:receipt-print";
export const receiptPrintDataChannel = "ysabellestore:request:receipt-print-data";
export const receiptPrintReadyChannel = "ysabellestore:request:receipt-print-ready";

export type ReceiptPrinterInfo = {
  description: string;
  displayName: string;
  name: string;
};

export type ReceiptPrinterStatus = {
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

type PrintBridge = {
  receipt?: {
    getPrinterStatus?(): Promise<ReceiptPrinterStatus>;
    print(receipt: RetailReceiptData): Promise<ReceiptPrintResult>;
    selectPrinter?(printerName: string): Promise<ReceiptPrinterStatus>;
  };
};

function getBridge(): PrintBridge | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return (window.electron ?? window.ysabelleStore) as PrintBridge | undefined;
}

export function hasNativeReceiptPrinter() {
  return Boolean(getBridge()?.receipt?.print);
}

export async function getReceiptPrinterStatus(): Promise<ReceiptPrinterStatus | null> {
  const bridge = getBridge();

  if (!bridge?.receipt?.getPrinterStatus) {
    return null;
  }

  return bridge.receipt.getPrinterStatus();
}

export async function selectReceiptPrinter(printerName: string): Promise<ReceiptPrinterStatus> {
  const bridge = getBridge();

  if (!bridge?.receipt?.selectPrinter) {
    throw new Error("Receipt printer selection is only available in the desktop app.");
  }

  return bridge.receipt.selectPrinter(printerName);
}

export function encodeReceiptPayload(receipt: RetailReceiptData) {
  const json = JSON.stringify(receipt);
  const utf8Bytes = new TextEncoder().encode(json);
  let binary = "";

  for (const byte of utf8Bytes) {
    binary += String.fromCharCode(byte);
  }

  return window.btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export function decodeReceiptPayload(encodedPayload: string): RetailReceiptData | null {
  try {
    const normalized = encodedPayload.replaceAll("-", "+").replaceAll("_", "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const binary = window.atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    const parsed: unknown = JSON.parse(json);

    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return parsed as RetailReceiptData;
  } catch {
    return null;
  }
}

export function getReceiptPreviewUrl(receipt: RetailReceiptData) {
  const url = new URL(window.location.href);

  url.searchParams.set("print", "receipt");
  url.searchParams.set("data", encodeReceiptPayload(receipt));

  return url.toString();
}

/**
 * Automatically print only through the desktop/native receipt bridge. Browser QA must stay
 * nonblocking after checkout; manual reprint can still open the browser print preview.
 */
export async function requestAutomaticReceiptPrint(receipt: RetailReceiptData) {
  const bridge = getBridge();

  if (!bridge?.receipt?.print) {
    return false;
  }

  const result = await bridge.receipt.print(receipt);
  return result.printed === true;
}

export async function requestReceiptPrint(receipt: RetailReceiptData) {
  const bridge = getBridge();

  if (bridge?.receipt?.print) {
    const result = await bridge.receipt.print(receipt);

    if (!result.printed) {
      throw new Error(result.reason ?? "The receipt printer did not complete the print request.");
    }

    return result;
  }

  const printUrl = getReceiptPreviewUrl(receipt);
  const openedWindow = window.open(printUrl, "_blank", "noopener,noreferrer,width=420,height=860");

  if (!openedWindow) {
    throw new Error("Unable to open the print preview window.");
  }

  return true;
}
