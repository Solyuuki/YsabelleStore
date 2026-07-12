import type { RetailReceiptData } from "@/types/receipt";

export const receiptPrintRequestChannel = "ysabellestore:request:receipt-print";
export const receiptPrintDataChannel = "ysabellestore:request:receipt-print-data";
export const receiptPrintReadyChannel = "ysabellestore:request:receipt-print-ready";

type PrintBridge = {
  receipt?: {
    print(receipt: RetailReceiptData): Promise<unknown>;
  };
};

function getBridge(): PrintBridge | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return (window.electron ?? window.ysabelleStore) as PrintBridge | undefined;
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

export async function requestReceiptPrint(receipt: RetailReceiptData) {
  const bridge = getBridge();

  if (bridge?.receipt?.print) {
    return bridge.receipt.print(receipt);
  }

  const printUrl = getReceiptPreviewUrl(receipt);
  const openedWindow = window.open(printUrl, "_blank", "noopener,noreferrer,width=420,height=860");

  if (!openedWindow) {
    throw new Error("Unable to open the print preview window.");
  }

  return true;
}
