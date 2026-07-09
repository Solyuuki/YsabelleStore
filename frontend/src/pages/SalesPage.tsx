import { useEffect, useMemo, useState } from "react";
import { ReceiptText } from "lucide-react";

import { AppPagination } from "@/components/shared/AppPagination";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listRecentSales } from "@/services/posService";
import type { PosSale } from "@/types/pos";

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  currency: "PHP",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  style: "currency"
});

const SALES_PAGE_SIZE = 10;

export function SalesPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sales, setSales] = useState<PosSale[]>([]);
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [salesPage, setSalesPage] = useState(1);

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

  return (
    <>
      <PageHeader
        eyebrow="Verified receipts"
        title="Sales"
        description="Recent persisted sales and receipt totals from the live database."
      />

      <section className="grid gap-4 xl:grid-cols-[1fr_420px]">
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
              <div className="space-y-3">
                <div className="overflow-hidden rounded-md border border-slate-200">
                  <div className="max-h-[31rem] overflow-auto">
                    <table className="w-full table-fixed border-collapse text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-[0.16em] text-slate-500">
                        <tr>
                          <th className="px-4 py-3 font-medium">Receipt</th>
                          <th className="px-4 py-3 font-medium">Date</th>
                          <th className="px-4 py-3 font-medium">Items</th>
                          <th className="px-4 py-3 font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedSales.map((sale) => {
                          const isSelected = sale.id === selectedSale?.id;

                          return (
                            <tr
                              className={`cursor-pointer border-t border-slate-200 transition-colors ${
                                isSelected ? "bg-emerald-50" : "hover:bg-slate-50"
                              }`}
                              key={sale.id}
                              onClick={() => setSelectedSaleId(sale.id)}
                            >
                              <td className="px-4 py-3">
                                <p className="font-medium text-slate-950">{sale.saleNumber}</p>
                                <p className="text-xs text-slate-500">
                                  {sale.cashierName ?? "Unassigned cashier"}
                                </p>
                              </td>
                              <td className="px-4 py-3 text-slate-600">
                                {new Intl.DateTimeFormat("en-PH", {
                                  dateStyle: "medium",
                                  timeStyle: "short"
                                }).format(new Date(sale.saleDate))}
                              </td>
                              <td className="px-4 py-3 text-slate-600">{sale.itemCount}</td>
                              <td className="px-4 py-3 font-semibold text-slate-950">
                                {currencyFormatter.format(Number(sale.totalAmount))}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-slate-500">
                    Showing {salesPageStartIndex + 1}–{salesPageEndIndex} of {sales.length} sales
                  </p>
                  <AppPagination
                    onPageChange={setSalesPage}
                    page={currentSalesPage}
                    pageSize={SALES_PAGE_SIZE}
                    totalItems={sales.length}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white/95 shadow-sm">
          <CardHeader>
            <CardTitle>Receipt details</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedSale ? (
              <div className="space-y-4">
                <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Receipt</p>
                  <h3 className="mt-1 text-lg font-semibold text-slate-950">
                    {selectedSale.saleNumber}
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">
                    {new Intl.DateTimeFormat("en-PH", {
                      dateStyle: "full",
                      timeStyle: "short"
                    }).format(new Date(selectedSale.saleDate))}
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    Cashier:{" "}
                    <span className="font-medium text-slate-950">
                      {selectedSale.cashierName ?? "Unknown"}
                    </span>
                  </p>
                </div>

                <div className="space-y-2">
                  {selectedSale.items.map((item) => (
                    <div
                      className="rounded-md border border-slate-200 bg-white p-4 shadow-sm"
                      key={item.id}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-950">{item.productName}</p>
                          <p className="mt-1 text-xs text-slate-500">{item.barcode ?? item.sku}</p>
                        </div>
                        <p className="text-sm font-semibold text-slate-950">
                          {currencyFormatter.format(Number(item.totalAmount))}
                        </p>
                      </div>
                      <div className="mt-3 flex justify-between text-sm text-slate-600">
                        <span>
                          Qty {item.quantity} x {currencyFormatter.format(Number(item.unitPrice))}
                        </span>
                        <span>{item.batchId ? "Batch linked" : "No batch link"}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Subtotal</span>
                    <span className="font-medium text-slate-950">
                      {currencyFormatter.format(Number(selectedSale.subtotalAmount))}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Discount</span>
                    <span className="font-medium text-slate-950">
                      {currencyFormatter.format(Number(selectedSale.discountAmount))}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-3 text-base font-semibold">
                    <span>Total</span>
                    <span>{currencyFormatter.format(Number(selectedSale.totalAmount))}</span>
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState
                description="Select a receipt from the list to review its persisted sale items and totals."
                icon={ReceiptText}
                title="No receipt selected"
              />
            )}
          </CardContent>
        </Card>
      </section>
    </>
  );
}
