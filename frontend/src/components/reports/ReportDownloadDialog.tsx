import {
  Boxes,
  CheckCircle2,
  FileSpreadsheet,
  PackageOpen,
  Printer,
  ReceiptText
} from "lucide-react";
import { useEffect, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { fetchInventory, type InventoryRecord, type PaginationMeta } from "@/services/catalogApi";
import type { DashboardSummary } from "@/services/dashboardApi";
import {
  listRestockOrders,
  type RestockOrder,
  type RestockOrderStatus
} from "@/services/restockApi";
import type { PosSale } from "@/types/pos";
import {
  downloadInventoryReportCsv,
  downloadOperationalSummaryCsv,
  printInventoryReport,
  printOperationalSummary,
  type InternalReportSnapshot
} from "@/utils/reportExport";
import {
  downloadRestockSupplierCsv,
  printRestockSupplierCopy,
  type RestockSupplierSnapshot
} from "@/utils/restockExport";

const EXPORT_PAGE_SIZE = 100;
const REPORT_TYPE_SESSION_KEY = "ysabelle.report-download.type";
const SUPPLIER_EXPORT_STATUSES: RestockOrderStatus[] = [
  "APPROVED",
  "AWAITING_DELIVERY",
  "PARTIALLY_RECEIVED"
];

type ReportType = "operational" | "inventory" | "restock";
type ExportBusy = "csv" | "print" | null;

type Props = {
  completedSales: PosSale[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
  summary: DashboardSummary | null;
};

function initialReportType(): ReportType {
  if (typeof window === "undefined") return "operational";
  const saved = window.sessionStorage.getItem(REPORT_TYPE_SESSION_KEY);
  return saved === "inventory" || saved === "restock" ? saved : "operational";
}

export function ReportDownloadDialog({ completedSales, onOpenChange, open, summary }: Props) {
  const [reportType, setReportType] = useState<ReportType>(initialReportType);
  const [exportBusy, setExportBusy] = useState<ExportBusy>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [supplierOrder, setSupplierOrder] = useState<RestockOrder | null>(null);
  const [supplierOrderLoading, setSupplierOrderLoading] = useState(false);
  const [supplierOrderError, setSupplierOrderError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setSupplierOrderLoading(true);
    setSupplierOrderError(null);

    void fetchLatestSupplierOrder()
      .then((order) => {
        if (active) setSupplierOrder(order);
      })
      .catch((error) => {
        if (!active) return;
        setSupplierOrder(null);
        setSupplierOrderError(
          error instanceof Error ? error.message : "Confirmed restock orders could not be loaded."
        );
      })
      .finally(() => {
        if (active) setSupplierOrderLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open]);

  function chooseReport(type: ReportType) {
    setReportType(type);
    setExportError(null);
    window.sessionStorage.setItem(REPORT_TYPE_SESSION_KEY, type);
  }

  async function prepareInternalSnapshot(): Promise<InternalReportSnapshot> {
    if (!summary) throw new Error("Report data is not ready yet.");
    const inventory = await fetchAllInventory();
    return { completedSales, inventory, summary };
  }

  async function handleCsv() {
    setExportBusy("csv");
    setExportError(null);

    try {
      if (reportType === "restock") {
        const snapshot = supplierOrder ? buildSupplierSnapshot(supplierOrder) : null;
        if (!snapshot) throw new Error("Confirm a restock order before exporting a supplier copy.");
        downloadRestockSupplierCsv(snapshot);
      } else {
        const snapshot = await prepareInternalSnapshot();
        if (reportType === "inventory") downloadInventoryReportCsv(snapshot);
        else downloadOperationalSummaryCsv(snapshot);
      }
      onOpenChange(false);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "The report could not be exported.");
    } finally {
      setExportBusy(null);
    }
  }

  async function handlePrint() {
    setExportError(null);

    if (reportType === "restock") {
      const snapshot = supplierOrder ? buildSupplierSnapshot(supplierOrder) : null;
      if (!snapshot) {
        setExportError("Confirm a restock order before exporting a supplier copy.");
        return;
      }
      if (!printRestockSupplierCopy(snapshot)) {
        setExportError("Pop-up was blocked. Allow pop-ups for Ysabelle Store and try again.");
        return;
      }
      onOpenChange(false);
      return;
    }

    const printWindow = window.open("", "_blank", "width=1100,height=800");
    if (!printWindow) {
      setExportError("Pop-up was blocked. Allow pop-ups for Ysabelle Store and try again.");
      return;
    }

    printWindow.opener = null;
    printWindow.document.open();
    printWindow.document.write(
      '<!doctype html><title>Preparing report…</title><p style="font:14px Arial;padding:24px">Preparing Ysabelle Store report…</p>'
    );
    printWindow.document.close();
    setExportBusy("print");

    try {
      const snapshot = await prepareInternalSnapshot();
      if (reportType === "inventory") printInventoryReport(printWindow, snapshot);
      else printOperationalSummary(printWindow, snapshot);
      onOpenChange(false);
    } catch (error) {
      printWindow.close();
      setExportError(error instanceof Error ? error.message : "The report could not be prepared.");
    } finally {
      setExportBusy(null);
    }
  }

  const restockDisabled =
    reportType === "restock" &&
    (supplierOrderLoading || supplierOrderError !== null || !supplierOrder);

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) setExportError(null);
      }}
      open={open}
    >
      <DialogContent className="max-w-[760px]">
        <DialogHeader>
          <DialogTitle>Download report</DialogTitle>
          <DialogDescription>
            Choose the report you need. Internal store data stays separate from the supplier-facing
            restock order.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-6 pb-6">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Report type
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <ReportChoice
                active={reportType === "operational"}
                description="Store health and sales overview"
                icon={ReceiptText}
                onClick={() => chooseReport("operational")}
                title="Operational Summary"
              />
              <ReportChoice
                active={reportType === "inventory"}
                description="Full current stock and inventory status"
                icon={Boxes}
                onClick={() => chooseReport("inventory")}
                title="Inventory Report"
              />
              <ReportChoice
                active={reportType === "restock"}
                description="Products and quantities to send to supplier"
                icon={PackageOpen}
                onClick={() => chooseReport("restock")}
                title="Restock / Supplier Order"
              />
            </div>
          </div>

          {reportType === "restock" ? (
            supplierOrderLoading ? (
              <Alert>
                <AlertTitle>Checking confirmed restock orders</AlertTitle>
                <AlertDescription>
                  Finding the latest supplier-ready restock order.
                </AlertDescription>
              </Alert>
            ) : supplierOrderError ? (
              <Alert variant="destructive">
                <AlertTitle>Restock order could not be loaded</AlertTitle>
                <AlertDescription>{supplierOrderError}</AlertDescription>
              </Alert>
            ) : supplierOrder ? (
              <Alert>
                <AlertTitle>Supplier copy ready</AlertTitle>
                <AlertDescription>
                  {supplierOrder.orderNumber} · {selectedLineCount(supplierOrder).toLocaleString()}{" "}
                  products · {selectedUnitCount(supplierOrder).toLocaleString()} units
                </AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <AlertTitle>No confirmed restock order yet</AlertTitle>
                <AlertDescription>
                  Confirm the Restock Planner first. Drafts are intentionally not exported as
                  supplier orders.
                </AlertDescription>
              </Alert>
            )
          ) : null}

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Export format
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                className="h-auto min-h-20 items-start justify-start whitespace-normal p-4 text-left"
                disabled={exportBusy !== null || restockDisabled || !summary}
                onClick={() => void handlePrint()}
                type="button"
                variant="secondary"
              >
                <Printer className="mt-0.5 h-5 w-5 shrink-0" />
                <span>
                  <span className="block font-semibold text-slate-950">
                    {exportBusy === "print" ? "Preparing…" : "Print / Save PDF"}
                  </span>
                  <span className="mt-1 block text-xs font-normal leading-5 text-slate-500">
                    Clean print view for paper or Save as PDF.
                  </span>
                </span>
              </Button>

              <Button
                className="h-auto min-h-20 items-start justify-start whitespace-normal p-4 text-left"
                disabled={exportBusy !== null || restockDisabled || !summary}
                onClick={() => void handleCsv()}
                type="button"
                variant="secondary"
              >
                <FileSpreadsheet className="mt-0.5 h-5 w-5 shrink-0" />
                <span>
                  <span className="block font-semibold text-slate-950">
                    {exportBusy === "csv" ? "Preparing…" : "Excel-compatible CSV"}
                  </span>
                  <span className="mt-1 block text-xs font-normal leading-5 text-slate-500">
                    Spreadsheet-ready copy of the selected report.
                  </span>
                </span>
              </Button>
            </div>
          </div>

          {exportError ? (
            <Alert variant="destructive">
              <AlertTitle>Export needs attention</AlertTitle>
              <AlertDescription>{exportError}</AlertDescription>
            </Alert>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReportChoice({
  active,
  description,
  icon: Icon,
  onClick,
  title
}: {
  active: boolean;
  description: string;
  icon: typeof ReceiptText;
  onClick: () => void;
  title: string;
}) {
  return (
    <Button
      aria-pressed={active}
      className={`h-auto min-h-28 items-start justify-start whitespace-normal p-4 text-left ${
        active ? "ring-2 ring-indigo-500" : ""
      }`}
      onClick={onClick}
      type="button"
      variant="secondary"
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 font-semibold text-slate-950">
          {title}
          {active ? <CheckCircle2 className="h-4 w-4 shrink-0 text-indigo-600" /> : null}
        </span>
        <span className="mt-1 block text-xs font-normal leading-5 text-slate-500">
          {description}
        </span>
      </span>
    </Button>
  );
}

async function fetchAllInventory() {
  return fetchEveryPage<InventoryRecord>((page) =>
    fetchInventory({ page, pageSize: EXPORT_PAGE_SIZE })
  );
}

async function fetchEveryPage<T>(
  fetchPage: (page: number) => Promise<{ items: T[]; meta: PaginationMeta }>
): Promise<T[]> {
  const items: T[] = [];
  let page = 1;

  while (true) {
    const result = await fetchPage(page);
    items.push(...result.items);
    if (page >= result.meta.totalPages) return items;
    page += 1;
  }
}

async function fetchLatestSupplierOrder() {
  const results = await Promise.all(
    SUPPLIER_EXPORT_STATUSES.map((status) => listRestockOrders({ page: 1, pageSize: 1, status }))
  );

  return (
    results
      .flatMap((result) => result.items)
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))[0] ?? null
  );
}

function selectedLineCount(order: RestockOrder) {
  return order.lines.filter((line) => line.isSelected && line.requestedQuantity > 0).length;
}

function selectedUnitCount(order: RestockOrder) {
  return order.lines
    .filter((line) => line.isSelected && line.requestedQuantity > 0)
    .reduce((sum, line) => sum + line.requestedQuantity, 0);
}

function statusLabel(status: RestockOrderStatus) {
  return status
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}

function buildSupplierSnapshot(order: RestockOrder): RestockSupplierSnapshot | null {
  const lines = order.lines
    .filter((line) => line.isSelected && line.requestedQuantity > 0)
    .map((line) => ({
      barcode: line.product.barcode,
      notes: line.notes ?? null,
      productName: line.product.name,
      quantity: line.requestedQuantity,
      sku: line.product.sku
    }));

  if (lines.length === 0) return null;

  return {
    generatedAt: new Date().toISOString(),
    lines,
    notes: order.notes,
    orderNumber: order.orderNumber,
    preparedBy: order.approvedBy?.name ?? order.createdBy?.name ?? null,
    statusLabel: statusLabel(order.status)
  };
}
