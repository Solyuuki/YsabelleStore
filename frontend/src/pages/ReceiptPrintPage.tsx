import { useEffect, useMemo, useState } from "react";

import { RetailReceipt } from "@/components/receipt/RetailReceipt";
import {
  decodeReceiptPayload,
  receiptPrintDataChannel,
  receiptPrintReadyChannel
} from "@/services/receiptPrint";
import type { RetailReceiptData } from "@/types/receipt";

type ReceiptPrintPageProps = {
  requestId?: string | null;
  payload?: string | null;
};

export function ReceiptPrintPage({ requestId, payload }: ReceiptPrintPageProps) {
  const [receipt, setReceipt] = useState<RetailReceiptData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasElectronBridge = Boolean(window.electron?.receipt?.print);

  const decodedPayload = useMemo(() => {
    if (!payload) {
      return null;
    }

    return decodeReceiptPayload(payload);
  }, [payload]);

  useEffect(() => {
    let active = true;

    async function loadReceipt() {
      if (decodedPayload) {
        setReceipt(decodedPayload);
        return;
      }

      if (hasElectronBridge && requestId) {
        try {
          const data = (await window.ysabelleStore.invoke(
            receiptPrintDataChannel,
            requestId
          )) as RetailReceiptData | null;

          if (!active) {
            return;
          }

          if (data) {
            setReceipt(data);
            return;
          }
        } catch {
          if (!active) {
            return;
          }

          setError("The receipt data could not be loaded.");
          return;
        }
      }

      if (!active) {
        return;
      }

      if (!decodedPayload) {
        setError("Receipt data is unavailable.");
      }
    }

    void loadReceipt();

    return () => {
      active = false;
    };
  }, [decodedPayload, hasElectronBridge, requestId]);

  useEffect(() => {
    if (!receipt) {
      return;
    }

    if (hasElectronBridge && requestId) {
      void window.ysabelleStore.invoke(receiptPrintReadyChannel, requestId);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      window.print();
    }, 150);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [hasElectronBridge, receipt, requestId]);

  return (
    <main className="receipt-print-page flex min-h-screen items-start justify-center bg-white px-4 py-4">
      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : receipt ? (
        <RetailReceipt receipt={receipt} />
      ) : (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Loading receipt...
        </div>
      )}
    </main>
  );
}
