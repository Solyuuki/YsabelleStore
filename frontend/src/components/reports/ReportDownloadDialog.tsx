import {
  Boxes,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileDown,
  FileSpreadsheet,
  PackageOpen,
  Printer,
  ReceiptText
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

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
const SUPPLIER_ORDER_PAGE_SIZE = 6;
const SUPPLIER_EXPORT_STATUSES: RestockOrderStatus[] = [
  "APPROVED",
  "AWAITING_DELIVERY",
  "PARTIALLY_RECEIVED"
];

type ReportType = "operational" | "inventory" | "restock";
type ExportBusy = "csv" | "pdf" | "print" | null;
type SupplierOrderMeta = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

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
  const [supplierOrders, setSupplierOrders] = useState<RestockOrder[]>([]);
  const [supplierOrderId, setSupplierOrderId] = useState<string | null>(null);
  const [supplierMeta, setSupplierMeta] = useState<SupplierOrderMeta | null>(null);
  const [supplierPage, setSupplierPage] = useState(1);
  const [supplierOrderLoading, setSupplierOrderLoading] = useState(false);
  const [supplierOrderError, setSupplierOrderError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || reportType !== "restock") return;
    let active = true;
    setSupplierOrderLoading(true);
    setSupplierOrderError(null);

    void listRestockOrders({
      page: supplierPage,
      pageSize: SUPPLIER_ORDER_PAGE_SIZE,
      statuses: SUPPLIER_EXPORT_STATUSES
    })
      .then((result) => {
        if (!active) return;
        setSupplierOrders(result.items);
        setSupplierMeta(result.meta);
        setSupplierOrderId((current) => {
          if (current && result.items.some((order) => order.id === current)) return current;
          return result.items[0]?.id ?? null;
        });
        if (result.meta.totalPages > 0 && supplierPage > result.meta.totalPages) {
          setSupplierPage(result.meta.totalPages);
        }
      })
      .catch((error) => {
        if (!active) return;
        setSupplierOrders([]);
        setSupplierMeta(null);
        setSupplierOrderId(null);
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
  }, [open, reportType, supplierPage]);

  const supplierOrder = useMemo(
    () => supplierOrders.find((order) => order.id === supplierOrderId) ?? supplierOrders[0] ?? null,
    [supplierOrderId, supplierOrders]
  );

  function chooseReport(type: ReportType) {
    setReportType(type);
    setExportError(null);
    if (type === "restock") setSupplierPage(1);
    window.sessionStorage.setItem(REPORT_TYPE_SESSION_KEY, type);
  }

  async function prepareInternalSnapshot(): Promise<InternalReportSnapshot> {
    if (!summary) throw new Error("Report data is not ready yet.");
    const inventory = await fetchAllInventory();
    return { completedSales, inventory, summary };
  }

  async function handlePdf() {
    setExportBusy("pdf");
    setExportError(null);

    try {
      const {
        downloadInventoryReportPdf,
        downloadOperationalSummaryPdf,
        downloadRestockSupplierPdf
      } = await import("@/utils/directPdfExport");

      if (reportType === "restock") {
        const snapshot = supplierOrder ? buildSupplierSnapshot(supplierOrder) : null;
        if (!snapshot) throw new Error("Select a confirmed restock order before exporting.");
        downloadRestockSupplierPdf(snapshot);
      } else {
        const snapshot = await prepareInternalSnapshot();
        if (reportType === "inventory") downloadInventoryReportPdf(snapshot);
        else downloadOperationalSummaryPdf(snapshot);
      }
      onOpenChange(false);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "The PDF could not be generated.");
    } finally {
      setExportBusy(null);
    }
  }

  async function handleCsv() {
    setExportBusy("csv");
    setExportError(null);

    try {
      if (reportType === "restock") {
        const snapshot = supplierOrder ? buildSupplierSnapshot(supplierOrder) : null;
        if (!snapshot) throw new Error("Select a confirmed restock order before exporting.");
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
      setExportBusy("print");
      try {
        const snapshot = supplierOrder ? buildSupplierSnapshot(supplierOrder) : null;
        if (!snapshot) {
          setExportError("Select a confirmed restock order before exporting.");
          return;
        }
        if (!printRestockSupplierCopy(snapshot)) {
          setExportError("Pop-up was blocked. Allow pop-ups for Ysabelle Store and try again.");
          return;
        }
        onOpenChange(false);
      } finally {
        setExportBusy(null);
      }
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
  const internalDisabled = reportType !== "restock" && !summary;
  const exportDisabled = exportBusy !== null || restockDisabled || internalDisabled;

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
                <AlertTitle>Loading supplier-ready restock orders</AlertTitle>
                <AlertDescription>Reading confirmed orders for this page.</AlertDescription>
              </Alert>
            ) : supplierOrderError ? (
              <Alert variant="destructive">
                <AlertTitle>Restock orders could not be loaded</AlertTitle>
                <AlertDescription>{supplierOrderError}</AlertDescription>
              </Alert>
            ) : supplierOrders.length > 0 && supplierOrder ? (
              <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div>
                  <label
                    className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500"
                    htmlFor="supplier-order-select"
                  >
                    Supplier order
                  </label>
                  <select
                    className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    id="supplier-order-select"
                    onChange={(event) => setSupplierOrderId(event.target.value)}
                    value={supplierOrder.id}
                  >
                    {supplierOrders.map((order) => (
                      <option key={order.id} value={order.id}>
                        {order.orderNumber} · {statusLabel(order.status)} ·{" "}
                        {selectedUnitCount(order).toLocaleString()} units
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                  <span>
                    Selected: {selectedLineCount(supplierOrder).toLocaleString()} products ·{" "}
                    {selectedUnitCount(supplierOrder).toLocaleString()} units
                  </span>
                  {supplierMeta && supplierMeta.totalPages > 1 ? (
                    <div className="flex items-center gap-1">
                      <Button
                        aria-label="Previous supplier order page"
                        disabled={supplierPage <= 1 || supplierOrderLoading}
                        onClick={() => setSupplierPage((current) => Math.max(1, current - 1))}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
                      </Button>
                      <span className="min-w-[86px] text-center tabular-nums">
                        Page {supplierMeta.page} of {supplierMeta.totalPages}
                      </span>
                      <Button
                        aria-label="Next supplier order page"
                        disabled={supplierPage >= supplierMeta.totalPages || supplierOrderLoading}
                        onClick={() => setSupplierPage((current) => current + 1)}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        <ChevronRight aria-hidden="true" className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : null}
                </div>

                <p className="text-xs leading-5 text-slate-500">
                  The exact order selected here will be used for PDF, Print, or CSV export.
                </p>
              </div>
            ) : (
              <Alert>
                <AlertTitle>No supplier-ready restock order yet</AlertTitle>
                <AlertDescription>
                  Confirm the Restock Planner first. Drafts and cancelled orders are intentionally
                  not exported as supplier orders.
                </AlertDescription>
              </Alert>
            )
          ) : null}

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Export format
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Button
                className="h-auto min-h-20 items-start justify-start whitespace-normal p-4 text-left"
                disabled={exportDisabled}
                onClick={() => void handlePdf()}
                type="button"
              >
                <FileDown className="mt-0.5 h-5 w-5 shrink-0" />
                <span>
                  <span className="block font-semibold">
                    {exportBusy === "pdf" ? "Preparing…" : "Download PDF"}
                  </span>
                  <span className="mt-1 block text-xs font-normal leading-5 text-indigo-100">
                    Download a ready-to-send .pdf file directly.
                  </span>
                </span>
              </Button>

              <Button
                className="h-auto min-h-20 items-start justify-start whitespace-normal p-4 text-left"
                disabled={exportDisabled}
                onClick={() => void handlePrint()}
                type="button"
                variant="secondary"
              >
                <Printer className="mt-0.5 h-5 w-5 shrink-0" />
                <span>
                  <span className="block font-semibold text-slate-950">
                    {exportBusy === "print" ? "Preparing…" : "Print"}
                  </span>
                  <span className="mt-1 block text-xs font-normal leading-5 text-slate-500">
                    Open a clean print view for paper printing.
                  </span>
                </span>
              </Button>

              <Button
                className="h-auto min-h-20 items-start justify-start whitespace-normal p-4 text-left"
                disabled={exportDisabled}
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

function selectedLineCount(order: RestockOrder) {
  return order.lines.filter((line) => line.isSelected && line.requestedQuantity > 0).length;
}

function selectedUnitCount(order: RestockOrder) {
  return order.lines
    .filter((line) => line.isSelected && line.requestedQuantity > 0)
    .reduce((sum, line) => sum + line.requestedQuantity, 0);
}

function statusLabel(status: RestockOrderStatus) {
  switch (status) {
    case "APPROVED":
      return "Confirmed";
    case "AWAITING_DELIVERY":
      return "Awaiting delivery";
    case "PARTIALLY_RECEIVED":
      return "Partially received";
    case "RECEIVED":
      return "Received";
    case "CANCELLED":
      return "Cancelled";
    case "DRAFT":
      return "Saved for later";
    default:
      return status;
  }
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
