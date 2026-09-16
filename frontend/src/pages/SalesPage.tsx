import { useEffect, useMemo, useState } from "react";
import { ReceiptText } from "lucide-react";

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

  function openReceiptDialog(sale: PosSale) {
    setReceiptSale(sale);
    setReceiptPrintError(null);
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

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_440px] xl:items-start 2xl:grid-cols-[minmax(0,1fr)_460px]">
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
                  <Table className="min-w-[640px]">
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead>Receipt</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="w-20 text-center">Items</TableHead>
                        <TableHead className="w-32 text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedSales.map((sale) => {
                        const isSelected = sale.id === selectedSale?.id;

                        return (
                          <TableRow
                            aria-selected={isSelected}
                            className={`cursor-pointer ${
                              isSelected ? "bg-indigo-50/80" : "hover:bg-slate-50"
                            }`}
                            key={sale.id}
                            onClick={() => setSelectedSaleId(sale.id)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                setSelectedSaleId(sale.id);
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
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                <AppPagination
                  itemLabel="sales"
                  onPageChange={setSalesPage}
                  page={currentSalesPage}
                  pageSize={SALES_PAGE_SIZE}
                  totalItems={sales.length}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white/95 shadow-sm xl:sticky xl:top-4 xl:flex xl:max-h-[calc(100vh-2rem)] xl:flex-col">
          <CardHeader className="xl:shrink-0">
            <div className="flex items-center justify-between gap-4">
              <CardTitle>Receipt details</CardTitle>
              <Button
                disabled={!selectedSale}
                size="sm"
                type="button"
                variant="secondary"
                onClick={() => {
                  if (selectedSale) {
                    openReceiptDialog(selectedSale);
                  }
                }}
              >
                Print receipt
              </Button>
            </div>
          </CardHeader>

          <CardContent className="xl:flex xl:min-h-0 xl:flex-1 xl:flex-col xl:px-0 xl:pb-5">
            {selectedSale ? (
              <div className="space-y-4 xl:flex xl:min-h-0 xl:flex-1 xl:flex-col xl:space-y-0">
                <div className="px-5 xl:shrink-0">
                  <Card className="border-slate-200 bg-slate-50/80 shadow-none">
                    <CardContent className="p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Receipt</p>
                      <h3 className="mt-1 break-words text-base font-semibold text-slate-950">
                        {selectedSale.saleNumber}
                      </h3>
                      <p className="mt-1 text-sm text-slate-600">
                        {formatSaleDate(selectedSale.saleDate, "full")}
                      </p>
                      <p className="mt-2 text-sm text-slate-600">
                        Cashier:{" "}
                        <span className="font-medium text-slate-950">
                          {selectedSale.cashierName ?? "Unknown"}
                        </span>
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 pr-4 [scrollbar-gutter:stable]">
                  <div className="space-y-3">
                    {selectedSale.items.map((item) => (
                      <Card className="border-slate-200 bg-white shadow-none" key={item.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium leading-5 text-slate-950">
                                {item.productName}
                              </p>
                              <p className="mt-1 break-all text-xs text-slate-500">
                                {item.barcode ?? item.sku}
                              </p>
                            </div>
                            <p className="shrink-0 text-sm font-semibold text-slate-950">
                              {currencyFormatter.format(Number(item.totalAmount))}
                            </p>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                            <span>
                              Qty {item.quantity} × {currencyFormatter.format(Number(item.unitPrice))}
                            </span>
                            <Badge variant={item.batchId ? "success" : "warning"}>
                              {item.batchId ? "Batch linked" : "No batch link"}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                <div className="px-5 xl:shrink-0">
                  <Card className="border-slate-200 bg-slate-50 shadow-none">
                    <CardContent className="space-y-2 p-4">
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
                    </CardContent>
                  </Card>
                </div>
              </div>
            ) : (
              <div className="px-5">
                <EmptyState
                  description="Select a receipt from the list to review its persisted sale items and totals."
                  icon={ReceiptText}
                  title="No receipt selected"
                />
              </div>
            )}
          </CardContent>
        </Card>
      </section>

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
