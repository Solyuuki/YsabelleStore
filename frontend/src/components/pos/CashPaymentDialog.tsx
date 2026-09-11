import { Banknote, LoaderCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  currency: "PHP",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  style: "currency"
});

type CashPaymentDialogProps = {
  error?: string | null;
  isSubmitting: boolean;
  onConfirm: (cashReceived: string) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  total: number;
};

function buildTenderSuggestions(total: number) {
  const suggestions = [
    Math.ceil(total / 100) * 100,
    Math.ceil(total / 500) * 500,
    Math.ceil(total / 1000) * 1000
  ];

  return [...new Set(suggestions)].filter((value) => value > total).slice(0, 3);
}

export function CashPaymentDialog({
  error,
  isSubmitting,
  onConfirm,
  onOpenChange,
  open,
  total
}: CashPaymentDialogProps) {
  const [cashInput, setCashInput] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const cashReceived = Number(cashInput);
  const hasCashInput = cashInput.trim().length > 0;
  const hasValidCash =
    hasCashInput && Number.isFinite(cashReceived) && cashReceived >= total && cashReceived >= 0;
  const change = hasValidCash ? cashReceived - total : 0;
  const suggestions = useMemo(() => buildTenderSuggestions(total), [total]);

  useEffect(() => {
    if (!open) return;

    setCashInput("");
    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [open, total]);

  function submitPayment() {
    if (!hasValidCash || isSubmitting) return;
    onConfirm(cashReceived.toFixed(2));
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !isSubmitting && onOpenChange(nextOpen)}>
      <DialogContent className="w-[calc(100vw-32px)] max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-indigo-600" aria-hidden="true" />
            Cash payment
          </DialogTitle>
          <DialogDescription>
            Confirm the customer tender before the sale is committed and inventory is deducted.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-medium text-slate-600">Amount due</span>
              <span className="text-2xl font-bold text-slate-950">
                {currencyFormatter.format(total)}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="cash-received">
              Cash received
            </label>
            <div className="flex h-14 items-center rounded-md border border-slate-300 bg-white px-4 shadow-sm focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100">
              <span className="mr-2 text-lg font-semibold text-slate-500">₱</span>
              <input
                ref={inputRef}
                id="cash-received"
                inputMode="decimal"
                className="min-w-0 flex-1 bg-transparent text-xl font-semibold text-slate-950 outline-none"
                placeholder="0.00"
                type="text"
                value={cashInput}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  if (/^\d{0,10}(?:\.\d{0,2})?$/.test(nextValue)) {
                    setCashInput(nextValue);
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    submitPayment();
                  }
                }}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              disabled={isSubmitting}
              size="sm"
              type="button"
              variant="secondary"
              onClick={() => setCashInput(total.toFixed(2))}
            >
              Exact
            </Button>
            {suggestions.map((amount) => (
              <Button
                disabled={isSubmitting}
                key={amount}
                size="sm"
                type="button"
                variant="secondary"
                onClick={() => setCashInput(amount.toFixed(2))}
              >
                {currencyFormatter.format(amount)}
              </Button>
            ))}
          </div>

          <div
            className={`rounded-lg border p-4 ${
              hasValidCash
                ? "border-emerald-200 bg-emerald-50"
                : "border-slate-200 bg-slate-50"
            }`}
          >
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-medium text-slate-600">Change</span>
              <span
                className={`text-xl font-bold ${
                  hasValidCash ? "text-emerald-700" : "text-slate-400"
                }`}
              >
                {currencyFormatter.format(change)}
              </span>
            </div>
            {hasCashInput && !hasValidCash ? (
              <p className="mt-2 text-sm text-amber-700">
                Cash received must cover the full amount due.
              </p>
            ) : null}
          </div>

          {error ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            disabled={isSubmitting}
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            aria-busy={isSubmitting}
            disabled={!hasValidCash || isSubmitting}
            type="button"
            onClick={submitPayment}
          >
            {isSubmitting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : null}
            {isSubmitting ? "Completing sale…" : "Complete sale"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
