import { LoaderCircle, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AppPagination } from "@/components/shared/AppPagination";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  listRestockOrders,
  type PaginationMeta,
  type RestockOrder
} from "@/services/restockApi";
import {
  buildRestockReturnSnapshot,
  getRestockReturnDocumentInfo
} from "@/utils/restockReturnExport";

const EMPTY_META: PaginationMeta = {
  page: 1,
  pageSize: 10,
  totalItems: 0,
  totalPages: 0
};

const dateFormatter = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeZone: "Asia/Manila"
});

export function ReturnHistoryDialog({
  onOpenChange,
  onView,
  open
}: {
  onOpenChange: (open: boolean) => void;
  onView: (order: RestockOrder) => void;
  open: boolean;
}) {
  const [items, setItems] = useState<RestockOrder[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>(EMPTY_META);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    void listRestockOrders(
      { hasReturns: true, page, pageSize },
      { signal: controller.signal }
    )
      .then((result) => {
        setItems(result.items);
        setMeta(result.meta);
        const lastPage = Math.max(1, result.meta.totalPages);
        if (page > lastPage) setPage(lastPage);
      })
      .catch((requestError) => {
        if (controller.signal.aborted) return;
        setError(
requestError instanceof Error
  ? requestError.message
  : "Return history could not be loaded."
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [open, page, pageSize]);

  const rows = useMemo(
    () =>
      items.map((order) => {
        const info = getRestockReturnDocumentInfo(order);
        const snapshot = buildRestockReturnSnapshot(order, info);
        return { info, order, snapshot };
      }),
    [items]
  );

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[82vh] max-w-[920px] grid-rows-[auto_minmax(0,1fr)] gap-0">
        <DialogHeader className="border-b border-slate-200 px-6 py-5">
<div className="flex items-center gap-2">
  <RotateCcw aria-hidden="true" className="h-5 w-5 text-amber-600" />
  <DialogTitle>Return history</DialogTitle>
</div>
<DialogDescription>
  Reopen supplier return documents for damaged or rejected deliveries.
</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto p-6">
{error ? (
  <Alert variant="destructive">
    <AlertTitle>Return history needs attention</AlertTitle>
    <AlertDescription>{error}</AlertDescription>
  </Alert>
) : null}

{loading && items.length === 0 ? (
  <div className="flex items-center justify-center gap-2 py-14 text-sm text-slate-500">
    <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
    Loading return history…
  </div>
) : null}

{!loading && !error && rows.length === 0 ? (
  <div className="rounded-lg border border-dashed border-slate-200 px-5 py-12 text-center">
    <p className="text-sm font-semibold text-slate-900">No return reports yet.</p>
    <p className="mt-1 text-xs text-slate-500">
      Damaged or rejected receiving records will appear here automatically.
    </p>
  </div>
) : null}

{rows.length > 0 ? (
  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
    {rows.map(({ info, order, snapshot }) => {
      const units =
        snapshot?.lines.reduce((sum, line) => sum + line.returnQuantity, 0) ?? 0;
      return (
        <div
          className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
          key={order.id}
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold text-slate-950">
                {snapshot?.returnReference ?? `RETURN-${order.orderNumber}`}
              </p>
              <Badge variant="warning">
                {units.toLocaleString()} return unit{units === 1 ? "" : "s"}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {order.orderNumber} · {dateFormatter.format(new Date(info.createdAt))}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              {info.supplierName || "Supplier / manufacturer not recorded yet"}
            </p>
          </div>
          <Button
            onClick={() => onView(order)}
            size="sm"
            type="button"
            variant="secondary"
          >
            View report
          </Button>
        </div>
      );
    })}
  </div>
) : null}

{meta.totalItems > 0 ? (
  <AppPagination
    className="mt-4"
    isLoading={loading}
    itemLabel="return reports"
    onPageChange={setPage}
    onPageSizeChange={(nextSize) => {
      setPageSize(nextSize);
      setPage(1);
    }}
    page={page}
    pageSize={pageSize}
    totalItems={meta.totalItems}
    totalPages={meta.totalPages}
  />
) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
