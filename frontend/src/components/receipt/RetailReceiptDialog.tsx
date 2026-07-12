import { LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { RetailReceipt } from "@/components/receipt/RetailReceipt";
import type { RetailReceiptData } from "@/types/receipt";

type RetailReceiptDialogProps = {
  error?: string | null;
  isPrinting?: boolean;
  onOpenChange: (open: boolean) => void;
  onPrint: () => void;
  open: boolean;
  receipt: RetailReceiptData | null;
  title?: string;
};

export function RetailReceiptDialog({
  error,
  isPrinting = false,
  onOpenChange,
  onPrint,
  open,
  receipt,
  title = "Receipt preview"
}: RetailReceiptDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[90vh] w-[calc(100vw-32px)] max-w-[820px] flex-col overflow-hidden p-0"
        aria-describedby="retail-receipt-dialog-description"
      >
        <DialogHeader className="border-b border-slate-200 px-6 py-5">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription id="retail-receipt-dialog-description">
            Review and print the completed retail receipt.
          </DialogDescription>
          {error ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {error}
            </p>
          ) : null}
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          {receipt ? <RetailReceipt className="shadow-none" compact receipt={receipt} /> : null}
        </div>

        <DialogFooter className="border-t border-slate-200 px-6 py-5">
          <DialogClose asChild>
            <Button disabled={isPrinting} type="button" variant="secondary">
              Close
            </Button>
          </DialogClose>
          <Button
            aria-busy={isPrinting}
            disabled={isPrinting || !receipt}
            type="button"
            onClick={onPrint}
          >
            {isPrinting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : null}
            {isPrinting ? "Printing…" : "Print receipt"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
