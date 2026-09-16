import { useEffect, useMemo, useState } from "react";
import { ReceiptText, X } from "lucide-react";

import { RetailReceiptDialog } from "@/components/receipt/RetailReceiptDialog";
import { AppPagination } from "@/components/shared/AppPagination";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { listRecentSales } from "@/services/posService";
import { requestReceiptPrint } from "@/services/receiptPrint";
import type { PosSale } from "@/types/pos";
import { buildRetailReceiptDataFromSale } from "@/utils/receipt";
import { waitForMinimumDuration } from "@/utils/timing";

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  currency: "PHP",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  style: "currency"
});

const SALES_PAGE_SIZE = 10;

function formatSaleDate(value: string, style: "short" | "full" = "short") {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: style === "full" ? "full" : "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function SalesPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sales, setSales] = useState<PosSale[]>([]);
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [salesPage, setSalesPage] = useState(1);
  const [isSaleSheetOpen, setIsSaleSheetOpen] = useState(false);
  const [receiptSale, setReceiptSale] = useState<PosSale | null>(null);
  const [isReceiptDialogOpen, setIsReceiptDialogOpen] = useState(false);
  const [isPrintingReceipt, setIsPrintingReceipt] = useState(false);
  const [receiptPrintError, setReceiptPrintError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadSales() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await listRecentSales(50);

        if (!response.success || !response.data) {
          if (!active) {
            return;
          }

          setError(response.message || "Sales could not be loaded.");
          setSales([]);
          return;
        }

        if (!active) {
          return;
        }

        const salesData = response.data;

        setSales(salesData.sales);
        setSalesPage(1);
        setSelectedSaleId((current) => current ?? salesData.sales[0]?.id ?? null);
      } catch {
        if (!active) {
          return;
        }

        setError("The sales history service is unavailable.");
        setSales([]);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadSales();

    return () => {
      active = false;
    };
  }, []);

  const selectedSale = useMemo(
    () => sales.find((sale) => sale.id === selectedSaleId) ?? sales[0] ?? null,
    [sales, selectedSaleId]
  );

  const totalSalesPages = Math.max(1, Math.ceil(sales.length / SALES_PAGE_SIZE));
  const currentSalesPage = Math.min(salesPage, totalSalesPages);
  const salesPageStartIndex = sales.length === 0 ? 0 : (currentSalesPage - 1) * SALES_PAGE_SIZE;
  const salesPageEndIndex = Math.min(salesPageStartIndex + SALES_PAGE_SIZE, sales.length);
  const paginatedSales = useMemo(
    () => sales.slice(salesPageStartIndex, salesPageEndIndex),
    [sales, salesPageEndIndex, salesPageStartIndex]
  );

  useEffect(() => {
    if (sales.length === 0) {
      setSelectedSaleId(null);
      return;
    }

    const selectedSaleIsVisible = paginatedSales.some((sale) => sale.id === selectedSaleId);

    if (!selectedSaleIsVisible) {
      setSelectedSaleId(paginatedSales[0]?.id ?? null);
    }
  }, [paginatedSales, sales.length, selectedSaleId]);

  function openSaleDetails(sale: PosSale) {
    setSelectedSaleId(sale.id);
    setIsSaleSheetOpen(true);
  }

  function openReceiptDialog(sale: PosSale) {
    setReceiptSale(sale);
    setReceiptPrintError(null);
    setIsSaleSheetOpen(false);
    setIsReceiptDialogOpen(true);
  }

  async function handlePrintReceipt() {
    if (!receiptSale || isPrintingReceipt) {
      return;
    }

    setIsPrintingReceipt(true);
    setReceiptPrintError(null);

    try {
      await waitForMinimumDuration(
        requestReceiptPrint(buildRetailReceiptDataFromSale(receiptSale)),
        450
      );
    } catch {
      setReceiptPrintError("The receipt could not be printed.");
    } finally {
      setIsPrintingReceipt(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Verified receipts"
        title="Sales"
        description="Recent persisted sales and receipt totals from the live database."
      />

      <Card className="border-slate-200/80 bg-white/95 shadow-sm">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle>Recent sales</CardTitle>
              <p className="mt-1 text-sm text-slate-500">
                {sales.length > 0
                  ? `Showing ${salesPageStartIndex + 1}–${salesPageEndIndex} of ${sales.length} sales`
                  : "Use this view to confirm checkout writes are being persisted."}
              </p>
            </div>
            <StatusBadge variant={sales.length > 0 ? "success" : "warning"}>
              {sales.length > 0
                ? `${sales.length} receipt${sales.length === 1 ? "" : "s"}`
                : "No sales"}
            </StatusBadge>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <LoadingState
              badge="Loading"
              helper="Retrieving the latest persisted sales records from the backend."
              label="Loading recent sales"
            />
          ) : error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : sales.length === 0 ? (
            <EmptyState
              description="Run a cash checkout from POS and return here to confirm the sale record was saved."
              icon={ReceiptText}
              title="No sales recorded yet"
            />
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto rounded-md border border-slate-200">
                <Table className="min-w-[760px]">
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead>Receipt</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="w-24 text-center">Items</TableHead>
                      <TableHead className="w-36 text-right">Total</TableHead>
                      <TableHead className="w-32 text-right">Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedSales.map((sale) => {
                      const isSelected = sale.id === selectedSale?.id;

                      return (
                        <TableRow
                          aria-selected={isSelected}
                          className={`cursor-pointer ${
                            isSelected ? "bg-indigo-50/70" : "hover:bg-slate-50"
                          }`}
                          key={sale.id}
                          onClick={() => openSaleDetails(sale)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              openSaleDetails(sale);
                            }
                          }}
                          role="button"
                          tabIndex={0}
                        >
                          <TableCell>
                            <p className="font-medium text-slate-950">{sale.saleNumber}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              {sale.cashierName ?? "Unassigned cashier"}
                            </p>
                          </TableCell>
                          <TableCell className="text-slate-600">
                            {formatSaleDate(sale.saleDate)}
                          </TableCell>
                          <TableCell className="text-center text-slate-600">
                            {sale.itemCount}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-slate-950">
                            {currencyFormatter.format(Number(sale.totalAmount))}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              aria-label={`View ${sale.saleNumber}`}
                              size="sm"
                              type="button"
                              variant="secondary"
                              onClick={(event) => {
                                event.stopPropagation();
                                openSaleDetails(sale);
                              }}
                            >
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <AppPagination
                itemLabel="sales"
                onPageChange={(page) => {
                  setSalesPage(page);
                  setIsSaleSheetOpen(false);
                }}
                page={currentSalesPage}
                pageSize={SALES_PAGE_SIZE}
                totalItems={sales.length}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={isSaleSheetOpen && Boolean(selectedSale)} onOpenChange={setIsSaleSheetOpen}>
        <SheetContent className="sm:max-w-[640px]">
          {selectedSale ? (
            <>
              <SheetHeader className="border-b border-slate-200 pb-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <SheetTitle>Receipt details</SheetTitle>
                    <SheetDescription className="mt-1 break-words">
                      {selectedSale.saleNumber} · {formatSaleDate(selectedSale.saleDate, "full")}
                    </SheetDescription>
                  </div>
                  <SheetClose asChild>
                    <Button
                      aria-label="Close receipt details"
                      className="shrink-0"
                      size="icon"
                      type="button"
                      variant="ghost"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </SheetClose>
                </div>
              </SheetHeader>

              <div className="shrink-0 border-b border-slate-200 px-6 py-4">
                <dl className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-500">Cashier</dt>
                    <dd className="mt-1 text-sm font-medium text-slate-950">
                      {selectedSale.cashierName ?? "Unknown"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-500">Items</dt>
                    <dd className="mt-1 text-sm font-medium text-slate-950">
                      {selectedSale.itemCount}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-500">Total</dt>
                    <dd className="mt-1 text-sm font-semibold text-slate-950">
                      {currencyFormatter.format(Number(selectedSale.totalAmount))}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="w-20 text-center">Qty</TableHead>
                        <TableHead className="w-28 text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedSale.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <p className="font-medium text-slate-950">{item.productName}</p>
                            <p className="mt-1 break-all text-xs text-slate-500">
                              {item.barcode ?? item.sku}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span className="text-xs text-slate-500">
                                {currencyFormatter.format(Number(item.unitPrice))} each
                              </span>
                              <Badge variant={item.batchId ? "success" : "warning"}>
                                {item.batchId ? "Batch linked" : "No batch link"}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="text-center font-medium text-slate-700">
                            {item.quantity}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-slate-950">
                            {currencyFormatter.format(Number(item.totalAmount))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-6 py-5">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Subtotal</span>
                    <span className="font-medium text-slate-950">
                      {currencyFormatter.format(Number(selectedSale.subtotalAmount))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Discount</span>
                    <span className="font-medium text-slate-950">
                      {currencyFormatter.format(Number(selectedSale.discountAmount))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-base font-semibold text-slate-950">
                    <span>Total</span>
                    <span>{currencyFormatter.format(Number(selectedSale.totalAmount))}</span>
                  </div>
                </div>

                <Button
                  className="mt-4 w-full"
                  type="button"
                  onClick={() => openReceiptDialog(selectedSale)}
                >
                  Print receipt
                </Button>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <RetailReceiptDialog
        error={receiptPrintError}
        isPrinting={isPrintingReceipt}
        open={isReceiptDialogOpen}
        receipt={receiptSale ? buildRetailReceiptDataFromSale(receiptSale) : null}
        onOpenChange={(open) => {
          setIsReceiptDialogOpen(open);

          if (!open) {
            setReceiptSale(null);
            setReceiptPrintError(null);
          }
        }}
        onPrint={() => void handlePrintReceipt()}
        title="Sales receipt"
      />
    </>
  );
}
