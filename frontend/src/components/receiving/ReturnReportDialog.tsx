import { FileDown, FileSpreadsheet, Printer, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import type { RestockOrder } from "@/services/restockApi";
import {
  buildRestockReturnSnapshot,
  downloadRestockReturnCsv,
  printRestockReturnCopy
} from "@/utils/restockReturnExport";

type ExportBusy = "csv" | "pdf" | "print" | null;

export function ReturnReportDialog({
  onOpenChange,
  open,
  order
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  order: RestockOrder | null;
}) {
  const [busy, setBusy] = useState<ExportBusy>(null);
  const [error, setError] = useState<string | null>(null);
  const [supplierName, setSupplierName] = useState("");
  const [deliveryReference, setDeliveryReference] = useState("");
  const snapshot = useMemo(
    () =>
      order
        ? buildRestockReturnSnapshot(order, { deliveryReference, supplierName })
        : null,
    [deliveryReference, order, supplierName]
  );
  const canExport = supplierName.trim().length >= 2;

  useEffect(() => {
    setSupplierName("");
    setDeliveryReference("");
    setError(null);
  }, [order?.id]);
  const totalUnits = snapshot?.lines.reduce((sum, line) => sum + line.returnQuantity, 0) ?? 0;

  async function handlePdf() {
    if (!snapshot) return;
    setBusy("pdf");
    setError(null);
    try {
      const { downloadRestockReturnPdf } = await import("@/utils/restockReturnPdf");
      downloadRestockReturnPdf(snapshot);
      onOpenChange(false);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "The PDF could not be generated."
      );
    } finally {
      setBusy(null);
    }
  }

  function handlePrint() {
    if (!snapshot) return;
    setBusy("print");
    setError(null);
    try {
      if (!printRestockReturnCopy(snapshot)) {
        setError("Pop-up was blocked. Allow pop-ups for Ysabelle Store and try again.");
        return;
      }
      onOpenChange(false);
    } finally {
      setBusy(null);
    }
  }

  function handleCsv() {
    if (!snapshot) return;
    setBusy("csv");
    setError(null);
    try {
      downloadRestockReturnCsv(snapshot);
      onOpenChange(false);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) setError(null);
      }}
      open={open}
    >
      <DialogContent className="max-w-[720px]">
        <DialogHeader>
          <DialogTitle>Download return report</DialogTitle>
          <DialogDescription>
            Create the supplier-facing document only for damaged or rejected units recorded against
            this restock ticket.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-6 pb-6">
          {snapshot ? (
            <>
              <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <RotateCcw aria-hidden="true" className="h-4 w-4 text-amber-600" />
                    <p className="truncate text-sm font-semibold text-slate-950">
                      {snapshot.returnReference}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Restock ticket {snapshot.orderNumber}
                  </p>
                </div>
                <div className="flex gap-2 text-xs text-slate-600">
                  <span className="rounded-md bg-white px-2.5 py-1.5 shadow-sm">
                    {snapshot.lines.length.toLocaleString()} product
                    {snapshot.lines.length === 1 ? "" : "s"}
                  </span>
                  <span className="rounded-md bg-white px-2.5 py-1.5 shadow-sm">
                    {totalUnits.toLocaleString()} return unit{totalUnits === 1 ? "" : "s"}
                  </span>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="return-supplier">Supplier / manufacturer *</Label>
                  <Input
                    className="mt-1"
                    id="return-supplier"
                    maxLength={160}
                    onChange={(event) => setSupplierName(event.target.value)}
                    placeholder="Supplier or manufacturer name"
                    value={supplierName}
                  />
                </div>
                <div>
                  <Label htmlFor="return-delivery-reference">Delivery / invoice reference</Label>
                  <Input
                    className="mt-1"
                    id="return-delivery-reference"
                    maxLength={120}
                    onChange={(event) => setDeliveryReference(event.target.value)}
                    placeholder="Optional DR / invoice number"
                    value={deliveryReference}
                  />
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Export format
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Button
                    className="h-auto min-h-20 items-start justify-start whitespace-normal p-4 text-left"
                    disabled={busy !== null || !canExport}
                    onClick={() => void handlePdf()}
                    type="button"
                  >
                    <FileDown className="mt-0.5 h-5 w-5 shrink-0" />
                    <span>
                      <span className="block font-semibold">
                        {busy === "pdf" ? "Preparing…" : "Download PDF"}
                      </span>
                      <span className="mt-1 block text-xs font-normal leading-5 text-indigo-100">
                        Ready-to-send supplier return document.
                      </span>
                    </span>
                  </Button>

                  <Button
                    className="h-auto min-h-20 items-start justify-start whitespace-normal p-4 text-left"
                    disabled={busy !== null || !canExport}
                    onClick={handlePrint}
                    type="button"
                    variant="secondary"
                  >
                    <Printer className="mt-0.5 h-5 w-5 shrink-0" />
                    <span>
                      <span className="block font-semibold text-slate-950">
                        {busy === "print" ? "Preparing…" : "Print"}
                      </span>
                      <span className="mt-1 block text-xs font-normal leading-5 text-slate-500">
                        Open a clean paper-ready return copy.
                      </span>
                    </span>
                  </Button>

                  <Button
                    className="h-auto min-h-20 items-start justify-start whitespace-normal p-4 text-left"
                    disabled={busy !== null || !canExport}
                    onClick={handleCsv}
                    type="button"
                    variant="secondary"
                  >
                    <FileSpreadsheet className="mt-0.5 h-5 w-5 shrink-0" />
                    <span>
                      <span className="block font-semibold text-slate-950">
                        {busy === "csv" ? "Preparing…" : "Excel-compatible CSV"}
                      </span>
                      <span className="mt-1 block text-xs font-normal leading-5 text-slate-500">
                        Spreadsheet-ready damaged and rejected quantities.
                      </span>
                    </span>
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <Alert>
              <AlertTitle>No returnable units recorded</AlertTitle>
              <AlertDescription>
                A return report becomes available only when receiving records damaged or rejected
                physical units.
              </AlertDescription>
            </Alert>
          )}

          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Return report needs attention</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
