import { CreditCard, PackageSearch, ScanBarcode, Search } from "lucide-react";

import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const productRows = [
  ["Barcode scan result", "Product name", "Available stock", "Unit price"],
  ["No scan", "Awaiting barcode or search", "0", "PHP 0.00"],
  ["No scan", "Awaiting barcode or search", "0", "PHP 0.00"],
  ["No scan", "Awaiting barcode or search", "0", "PHP 0.00"]
];

export function PosPage() {
  return (
    <>
      <PageHeader
        eyebrow="Barcode-first counter"
        title="Point of Sale"
        description="Retail selling workspace for scanner input, product lookup, current sale review, and payment actions."
      />

      <section className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <CardTitle>Barcode or product search</CardTitle>
                <StatusBadge variant="info">Ready</StatusBadge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 lg:grid-cols-[1fr_180px]">
                <label className="flex h-12 items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-4">
                  <ScanBarcode className="h-5 w-5 text-slate-500" aria-hidden="true" />
                  <input
                    className="w-full bg-transparent text-sm outline-none"
                    placeholder="Scan barcode or search product name"
                    readOnly
                  />
                </label>
                <Button type="button" variant="secondary">
                  <Search className="h-4 w-4" aria-hidden="true" />
                  Search
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Product results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-md border border-slate-200">
                <table className="w-full table-fixed border-collapse text-left text-sm">
                  <tbody>
                    {productRows.map((row, rowIndex) => (
                      <tr
                        className={rowIndex === 0 ? "bg-slate-100 font-medium" : "bg-white"}
                        key={`${row[0]}-${rowIndex}`}
                      >
                        {row.map((cell) => (
                          <td className="border-b border-slate-200 px-4 py-3" key={cell}>
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <EmptyState
            description="Scan a barcode or search by name to show matching store items."
            icon={PackageSearch}
            title="No product selected"
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Current sale</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="min-h-64 rounded-md border border-dashed border-slate-300 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-700">Sale items</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Scanned items, quantities, discounts, and totals will be shown in this panel.
                </p>
              </div>

              <div className="space-y-2 rounded-md border border-slate-200 bg-white p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="font-medium text-slate-950">PHP 0.00</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Discount</span>
                  <span className="font-medium text-slate-950">PHP 0.00</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-3 text-base font-semibold">
                  <span>Total</span>
                  <span>PHP 0.00</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button disabled type="button">
                  <CreditCard className="h-4 w-4" aria-hidden="true" />
                  Cash
                </Button>
                <Button disabled type="button" variant="secondary">
                  Card
                </Button>
                <Button disabled type="button" variant="secondary">
                  E-wallet
                </Button>
                <Button disabled type="button" variant="danger">
                  Void
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </>
  );
}
