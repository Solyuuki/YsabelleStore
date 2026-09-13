import { LoaderCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
      <DialogContent className="w-[calc(100vw-32px)] max-w-[480px] p-0">
        <DialogHeader className="border-b border-slate-200 px-6 py-5">
          <DialogTitle>Cash payment</DialogTitle>
          <DialogDescription>
            Enter the amount received from the customer, then confirm the sale.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-6 py-5">
          <Card>
            <CardContent className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="type-body-sm font-medium text-slate-500">Amount due</p>
                <p className="mt-1 text-xs text-slate-400">Cash sale</p>
              </div>
              <p className="text-2xl font-semibold tracking-tight text-slate-950">
                {currencyFormatter.format(total)}
              </p>
            </CardContent>
          </Card>

          <div className="space-y-2">
            <Label htmlFor="cash-received">Cash received</Label>
            <Input
              ref={inputRef}
              id="cash-received"
              inputMode="decimal"
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
            <p className="type-body-sm text-slate-500">
              Enter the cash tendered in Philippine pesos.
            </p>
          </div>

          <div className="flex flex-wrap gap-2" aria-label="Quick cash amounts">
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

          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-slate-500">Cash received</span>
                <span className="font-medium text-slate-950">
                  {hasCashInput && Number.isFinite(cashReceived)
                    ? currencyFormatter.format(cashReceived)
                    : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 border-t border-slate-200 pt-3">
                <span className="font-medium text-slate-700">Change</span>
                <span className="text-lg font-semibold text-slate-950">
                  {currencyFormatter.format(change)}
                </span>
              </div>
            </CardContent>
          </Card>

          {hasCashInput && !hasValidCash ? (
            <Alert>Cash received must cover the full amount due.</Alert>
          ) : null}

          {error ? <Alert variant="destructive">{error}</Alert> : null}
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
