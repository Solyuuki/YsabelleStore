import { cn } from "@/lib/utils";
import type { RetailReceiptData, RetailReceiptItem } from "@/types/receipt";

import "@/styles/receipt.css";

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  currency: "PHP",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  style: "currency"
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short"
});

type RetailReceiptProps = {
  className?: string;
  compact?: boolean;
  receipt: RetailReceiptData;
};

export function formatReceiptCurrency(amount: string) {
  return currencyFormatter.format(Number(amount));
}

export function formatReceiptDateTime(value: string) {
  return dateTimeFormatter.format(new Date(value));
}

function ReceiptLineItem({ item }: { item: RetailReceiptItem }) {
  return (
    <li className="receipt-line grid grid-cols-[1.5rem_minmax(0,1fr)_auto] gap-x-2 py-2">
      <span className="pt-0.5 text-right text-[11px] font-medium text-slate-700">
        {item.quantity}
      </span>
      <div className="min-w-0">
        <p className="break-words text-[13px] font-medium leading-5 text-slate-950">
          {item.productName}
        </p>
        <p className="mt-0.5 text-[10px] text-slate-600">
          {item.sku}
          {item.barcode ? ` | ${item.barcode}` : ""}
        </p>
        <p className="mt-1 text-[10px] text-slate-600">
          {item.quantity} x {formatReceiptCurrency(item.unitPrice)}
        </p>
      </div>
      <span className="pt-0.5 text-right text-[13px] font-semibold text-slate-950">
        {formatReceiptCurrency(item.lineTotal)}
      </span>
    </li>
  );
}

function TotalsRow({
  label,
  value,
  emphasized = false
}: {
  emphasized?: boolean;
  label: string;
  value: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 text-sm",
        emphasized ? "font-semibold text-slate-950" : "text-slate-600"
      )}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export function RetailReceipt({ className, compact = false, receipt }: RetailReceiptProps) {
  const itemCountLabel = `${receipt.itemCount} item${receipt.itemCount === 1 ? "" : "s"}`;
  const subtotalValue = formatReceiptCurrency(receipt.subtotal);
  const totalValue = formatReceiptCurrency(receipt.total);
  const cashReceivedValue = formatReceiptCurrency(receipt.cashReceived);
  const changeValue = formatReceiptCurrency(receipt.change);
  const discountValue =
    receipt.discountAmount && Number(receipt.discountAmount) > 0
      ? formatReceiptCurrency(receipt.discountAmount)
      : null;
  const taxValue =
    receipt.taxAmount && Number(receipt.taxAmount) > 0
      ? formatReceiptCurrency(receipt.taxAmount)
      : null;

  return (
    <section
      className={cn(
        "receipt-paper rounded-2xl border border-slate-200 bg-white px-4 py-5 text-slate-950 shadow-sm",
        compact ? "mx-auto w-full max-w-[420px]" : "mx-auto w-full max-w-[80mm]",
        className
      )}
      aria-label={`Receipt ${receipt.receiptNumber}`}
    >
      <header className="border-b border-dashed border-slate-300 pb-4 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.42em] text-slate-500">
          YSABELLESTORE
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[0.16em] text-slate-950">
          Retail Store
        </h2>
        <p className="mt-1 text-sm text-slate-600">Official retail receipt</p>
      </header>

      <div className="space-y-4 py-4 text-sm">
        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-500">Receipt number</span>
            <span className="font-medium text-slate-950">{receipt.receiptNumber}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-500">Date / time</span>
            <span className="text-right font-medium text-slate-950">
              {formatReceiptDateTime(receipt.saleDate)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-500">Cashier</span>
            <span className="text-right font-medium text-slate-950">
              {receipt.cashierName ?? "Unassigned"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-500">Payment method</span>
            <span className="font-medium text-slate-950">{receipt.paymentMethod}</span>
          </div>
        </div>

        <div className="border-t border-dashed border-slate-300 pt-3">
          <div className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] gap-x-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            <span>Qty</span>
            <span>Description</span>
            <span className="text-right">Amount</span>
          </div>
          <ul className="divide-y divide-dashed divide-slate-200 border-t border-slate-200">
            {receipt.items.map((item) => (
              <ReceiptLineItem
                item={item}
                key={`${item.sku}-${item.productName}-${item.lineTotal}`}
              />
            ))}
          </ul>
        </div>

        <div className="space-y-2 border-t border-dashed border-slate-300 pt-3">
          <TotalsRow label="Subtotal" value={subtotalValue} />
          {discountValue ? <TotalsRow label="Discount" value={discountValue} /> : null}
          {taxValue ? <TotalsRow label="Tax" value={taxValue} /> : null}
          <TotalsRow label="Item count" value={itemCountLabel} />
          <TotalsRow label="Cash received" value={cashReceivedValue} />
          <TotalsRow label="Change" value={changeValue} />
          <TotalsRow emphasized label="Total" value={totalValue} />
        </div>

        <div className="border-t border-dashed border-slate-300 pt-4 text-center">
          <p className="text-sm font-medium text-slate-950">Thank you for your purchase!</p>
          <p className="mt-1 text-xs text-slate-500">Please keep this receipt for your records.</p>
        </div>

        <div className="border-t border-dashed border-slate-300 pt-3 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-500">
            Receipt code
          </p>
          <p className="mt-2 font-mono text-[11px] tracking-[0.3em] text-slate-950">
            {receipt.receiptNumber}
          </p>
        </div>
      </div>
    </section>
  );
}
