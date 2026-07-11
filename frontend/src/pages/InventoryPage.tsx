import {
  Barcode,
  Boxes,
  ClipboardList,
  ArrowUpDown,
  CircleCheck,
  Filter,
  History,
  LoaderCircle,
  PackagePlus,
  PencilLine,
  Tag,
  Search,
  ChevronDown,
  X
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { AppPagination } from "@/components/shared/AppPagination";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useToast } from "@/components/shared/ToastProvider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  adjustInventoryStock,
  fetchCategories,
  fetchInventory,
  fetchInventoryByProductId,
  fetchMovements,
  lookupInventoryByBarcode,
  stockInInventory,
  type InventoryListQuery,
  type InventoryMovementType,
  type InventoryRecord,
  type InventorySortBy,
  type MovementRecord,
  type PaginationMeta,
  type ProductCategorySummary,
  type StockAdjustmentRequest,
  type StockInRequest
} from "@/services/catalogApi";
import { waitForMinimumDuration } from "@/utils/timing";

const DEFAULT_PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 350;
const INVENTORY_INITIAL_MINIMUM_MS = 500;
const INVENTORY_UPDATE_MINIMUM_MS = 400;
const DETAILS_MINIMUM_MS = 450;
const MOVEMENTS_MINIMUM_MS = 450;
const LOOKUP_MINIMUM_MS = 450;
const MUTATION_MINIMUM_MS = 550;

type LoadingReason =
  | "initial"
  | "search"
  | "filter"
  | "pagination"
  | "page-size"
  | "refresh"
  | null;
type StockStatusFilter = "ALL" | "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
type ProductStatusFilter = "ALL" | "ACTIVE" | "INACTIVE" | "DISCONTINUED";
type SortOrder = "asc" | "desc";

const stockStatusDisplay = {
  IN_STOCK: { label: "IN STOCK", variant: "success" as const },
  LOW_STOCK: { label: "LOW STOCK", variant: "warning" as const },
  OUT_OF_STOCK: { label: "OUT OF STOCK", variant: "error" as const }
};

const movementTypes: InventoryMovementType[] = [
  "STOCK_IN",
  "SALE",
  "ADJUSTMENT_IN",
  "ADJUSTMENT_OUT",
  "RETURN_IN",
  "RETURN_OUT",
  "DAMAGE",
  "EXPIRED",
  "INITIAL_STOCK"
];

export function InventoryPage() {
  const { user } = useAuth();
  const { pushToast } = useToast();
  const [rows, setRows] = useState<InventoryRecord[]>([]);
  const [categories, setCategories] = useState<ProductCategorySummary[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [stockStatus, setStockStatus] = useState<StockStatusFilter>("ALL");
  const [productStatus, setProductStatus] = useState<ProductStatusFilter>("ALL");
  const [categoryId, setCategoryId] = useState("ALL");
  const [sortBy, setSortBy] = useState<InventorySortBy>("updatedAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [loadingReason, setLoadingReason] = useState<LoadingReason>("initial");
  const [error, setError] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedInventory, setSelectedInventory] = useState<InventoryRecord | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [lookupOpen, setLookupOpen] = useState(false);
  const [stockInOpen, setStockInOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [movementsOpen, setMovementsOpen] = useState(false);
  const [pendingMutationProductIds, setPendingMutationProductIds] = useState<Set<string>>(
    () => new Set()
  );
  const [movementRefreshVersion, setMovementRefreshVersion] = useState(0);
  const listRequestRef = useRef(0);
  const listAbortRef = useRef<AbortController | null>(null);
  const detailsRequestRef = useRef(0);
  const detailsAbortRef = useRef<AbortController | null>(null);
  const viewRef = useRef({
    categoryId,
    page,
    pageSize,
    productStatus,
    search,
    sortBy,
    sortOrder,
    stockStatus
  });
  const previousParamsRef = useRef<string | null>(null);

  const isOwner = user?.role === "OWNER";
  const isLoading = loadingReason !== null;
  const initialLoading = loadingReason === "initial" && rows.length === 0;
  const hasRows = rows.length > 0;

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setPage(1);
      setSearch(searchInput);
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  useEffect(() => {
    viewRef.current = {
      categoryId,
      page,
      pageSize,
      productStatus,
      search,
      sortBy,
      sortOrder,
      stockStatus
    };
  }, [categoryId, page, pageSize, productStatus, search, sortBy, sortOrder, stockStatus]);

  useEffect(() => {
    let active = true;
    void fetchCategories()
      .then((result) => {
        if (active) setCategories(result);
      })
      .catch(() => {
        if (active) setCategories([]);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => () => listAbortRef.current?.abort(), []);
  useEffect(() => () => detailsAbortRef.current?.abort(), []);

  const loadInventory = async (
    reason: Exclude<LoadingReason, null>,
    override?: Partial<typeof viewRef.current>
  ) => {
    const view = { ...viewRef.current, ...override };
    const requestId = ++listRequestRef.current;
    listAbortRef.current?.abort();
    const controller = new AbortController();
    listAbortRef.current = controller;
    setLoadingReason(reason);
    setError(null);

    const query: InventoryListQuery = {
      categoryId: view.categoryId === "ALL" ? undefined : view.categoryId,
      page: view.page,
      pageSize: view.pageSize,
      productStatus: view.productStatus === "ALL" ? undefined : view.productStatus,
      search: view.search.trim() || undefined,
      sortBy: view.sortBy,
      sortOrder: view.sortOrder,
      stockStatus: view.stockStatus
    };

    try {
      const result = await waitForMinimumDuration(
        fetchInventory(query, { signal: controller.signal }),
        reason === "initial" ? INVENTORY_INITIAL_MINIMUM_MS : INVENTORY_UPDATE_MINIMUM_MS
      );
      if (requestId !== listRequestRef.current) return;
      if (result.meta.totalPages > 0 && view.page > result.meta.totalPages) {
        setPage(result.meta.totalPages);
        return;
      }
      setRows(result.items);
      setMeta(result.meta);
    } catch (requestError) {
      if (requestId !== listRequestRef.current || isAbortError(requestError)) return;
      setError(requestError instanceof Error ? requestError.message : "Unable to load inventory.");
    } finally {
      if (requestId === listRequestRef.current) setLoadingReason(null);
    }
  };

  useEffect(() => {
    const params = JSON.stringify({
      categoryId,
      page,
      pageSize,
      productStatus,
      search,
      sortBy,
      sortOrder,
      stockStatus
    });
    const previous = previousParamsRef.current;
    let reason: Exclude<LoadingReason, null> = previous === null ? "initial" : "refresh";
    if (previous !== null) {
      const old = JSON.parse(previous) as typeof viewRef.current;
      if (old.search !== search) reason = "search";
      else if (
        old.categoryId !== categoryId ||
        old.productStatus !== productStatus ||
        old.stockStatus !== stockStatus ||
        old.sortBy !== sortBy ||
        old.sortOrder !== sortOrder
      )
        reason = "filter";
      else if (old.pageSize !== pageSize) reason = "page-size";
      else if (old.page !== page) reason = "pagination";
    }
    previousParamsRef.current = params;
    void loadInventory(reason, {
      categoryId,
      page,
      pageSize,
      productStatus,
      search,
      sortBy,
      sortOrder,
      stockStatus
    });
  }, [categoryId, page, pageSize, productStatus, search, sortBy, sortOrder, stockStatus]);

  useEffect(() => {
    if (!selectedProductId) return;
    const requestId = ++detailsRequestRef.current;
    detailsAbortRef.current?.abort();
    const controller = new AbortController();
    detailsAbortRef.current = controller;
    setDetailsLoading(true);
    setDetailsError(null);
    void waitForMinimumDuration(
      fetchInventoryByProductId(selectedProductId, { signal: controller.signal }),
      DETAILS_MINIMUM_MS
    )
      .then((result) => {
        if (requestId === detailsRequestRef.current) setSelectedInventory(result);
      })
      .catch((requestError) => {
        if (requestId === detailsRequestRef.current && !isAbortError(requestError))
          setDetailsError("Unable to load inventory details.");
      })
      .finally(() => {
        if (requestId === detailsRequestRef.current) setDetailsLoading(false);
      });
  }, [selectedProductId]);

  function openDetails(productId: string) {
    setSelectedProductId(productId);
    setSelectedInventory(rows.find((row) => row.productId === productId) ?? null);
  }

  function closeDetails() {
    setSelectedProductId(null);
    setSelectedInventory(null);
    setDetailsError(null);
  }

  function updateVisibleInventory(updated: InventoryRecord) {
    const view = viewRef.current;
    const stillMatches =
      (view.stockStatus === "ALL" || updated.stockStatus === view.stockStatus) &&
      (view.productStatus === "ALL" || updated.status === view.productStatus) &&
      (view.categoryId === "ALL" || updated.category.id === view.categoryId);
    setRows((current) =>
      stillMatches
        ? current.map((row) => (row.productId === updated.productId ? updated : row))
        : current.filter((row) => row.productId !== updated.productId)
    );
    setSelectedInventory(updated);
    void loadInventory("refresh");
  }

  async function handleMutation(
    productId: string,
    action: () => Promise<{ inventory: InventoryRecord }>,
    successTitle: string,
    successMessage: string
  ) {
    if (pendingMutationProductIds.has(productId)) return false;
    setPendingMutationProductIds((current) => new Set(current).add(productId));
    try {
      const result = await waitForMinimumDuration(action(), MUTATION_MINIMUM_MS);
      updateVisibleInventory(result.inventory);
      setMovementRefreshVersion((current) => current + 1);
      pushToast({ title: successTitle, message: successMessage, variant: "success" });
      return true;
    } catch (mutationError) {
      pushToast({
        title: successTitle === "Stock added" ? "Unable to add stock" : "Unable to update stock",
        message:
          mutationError instanceof Error
            ? mutationError.message
            : "The inventory quantity remains unchanged.",
        variant: "error"
      });
      return false;
    } finally {
      setPendingMutationProductIds((current) => {
        const next = new Set(current);
        next.delete(productId);
        return next;
      });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description="Monitor stock levels, batches, expiry dates, and inventory movements."
        actions={
          <Button type="button" variant="secondary" onClick={() => setLookupOpen(true)}>
            <Barcode className="h-4 w-4" aria-hidden="true" />
            Barcode lookup
          </Button>
        }
      />

      <Card>
        <CardContent className="space-y-4 p-4 lg:p-5">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <label className="relative flex h-10 min-w-[260px] flex-1 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3">
              <Search className="h-4 w-4 text-slate-500" aria-hidden="true" />
              <input
                aria-label="Search inventory"
                aria-busy={loadingReason === "search"}
                className="w-full bg-transparent text-sm outline-none"
                placeholder="Search product name, SKU, barcode"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
              />
              {loadingReason === "search" ? (
                <LoaderCircle
                  className="h-4 w-4 animate-spin text-emerald-700"
                  aria-hidden="true"
                />
              ) : null}
            </label>
            <FilterSelect
              icon={Filter}
              label="Stock level"
              minWidthClassName="min-w-[166px]"
              value={stockStatus}
              onChange={(value) => {
                setStockStatus(value as StockStatusFilter);
                setPage(1);
              }}
            >
              <option value="ALL">All stock levels</option>
              <option value="IN_STOCK">In stock</option>
              <option value="LOW_STOCK">Low stock</option>
              <option value="OUT_OF_STOCK">Out of stock</option>
            </FilterSelect>
            <FilterSelect
              icon={Tag}
              label="Category"
              minWidthClassName="min-w-[158px]"
              value={categoryId}
              onChange={(value) => {
                setCategoryId(value);
                setPage(1);
              }}
            >
              <option value="ALL">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect
              icon={CircleCheck}
              label="Availability"
              minWidthClassName="min-w-[172px]"
              value={productStatus}
              onChange={(value) => {
                setProductStatus(value as ProductStatusFilter);
                setPage(1);
              }}
            >
              <option value="ALL">All availability</option>
              <option value="ACTIVE">Available</option>
              <option value="INACTIVE">Unavailable</option>
              <option value="DISCONTINUED">Discontinued</option>
            </FilterSelect>
            <FilterSelect
              icon={ArrowUpDown}
              label="Sort"
              minWidthClassName="min-w-[194px]"
              value={`${sortBy}:${sortOrder}`}
              onChange={(value) => {
                const [nextSortBy, nextSortOrder] = value.split(":") as [
                  InventorySortBy,
                  SortOrder
                ];
                setSortBy(nextSortBy);
                setSortOrder(nextSortOrder);
                setPage(1);
              }}
            >
              <option value="updatedAt:desc">Recently updated</option>
              <option value="productName:asc">Product name</option>
              <option value="quantityOnHand:asc">Lowest quantity</option>
              <option value="quantityOnHand:desc">Highest quantity</option>
              <option value="reorderLevel:asc">Reorder level</option>
            </FilterSelect>
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Unable to load inventory</AlertTitle>
              <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                <span>{error}</span>
                <Button
                  disabled={isLoading}
                  size="sm"
                  type="button"
                  variant="secondary"
                  onClick={() => void loadInventory("refresh")}
                >
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          {meta?.totalItems === 0 && !isLoading && !error ? (
            <EmptyState
              description={
                search || stockStatus !== "ALL" || productStatus !== "ALL" || categoryId !== "ALL"
                  ? "Try changing your search or filters."
                  : "Create products first, then add stock through Inventory."
              }
              icon={Boxes}
              title={
                search || stockStatus !== "ALL" || productStatus !== "ALL" || categoryId !== "ALL"
                  ? "No matching inventory"
                  : "No inventory records"
              }
            />
          ) : null}

          <div aria-busy={isLoading} className="relative">
            {initialLoading ? (
              <InventoryTableSkeleton rowCount={pageSize} />
            ) : hasRows ? (
              <div className={isLoading ? "pointer-events-none opacity-60" : ""}>
                <InventoryTable rows={rows} onOpenDetails={openDetails} />
              </div>
            ) : null}
            {isLoading && hasRows ? (
              <div className="pointer-events-none absolute inset-0 grid place-items-start bg-white/25 pt-3">
                <span className="inline-flex items-center gap-2 rounded-md border border-emerald-100 bg-white px-3 py-2 text-xs font-medium text-emerald-800 shadow-sm">
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  Updating inventory...
                </span>
              </div>
            ) : null}
          </div>

          {meta && meta.totalItems > 0 ? (
            <AppPagination
              isLoading={isLoading}
              itemLabel="inventory records"
              page={page}
              pageSize={pageSize}
              totalItems={meta.totalItems}
              totalPages={meta.totalPages}
              onPageChange={setPage}
              onPageSizeChange={(nextPageSize) => {
                setPageSize(nextPageSize);
                setPage(1);
              }}
            />
          ) : null}
        </CardContent>
      </Card>

      <InventoryDetailsDialog
        inventory={selectedInventory}
        isLoading={detailsLoading}
        error={detailsError}
        isOpen={Boolean(selectedProductId)}
        isOwner={isOwner}
        mutationPending={
          selectedInventory ? pendingMutationProductIds.has(selectedInventory.productId) : false
        }
        onClose={closeDetails}
        onOpenAdjust={() => setAdjustOpen(true)}
        onOpenMovements={() => setMovementsOpen(true)}
        onOpenStockIn={() => setStockInOpen(true)}
      />
      <BarcodeLookupDialog
        open={lookupOpen}
        onClose={() => setLookupOpen(false)}
        onFound={(productId) => {
          setLookupOpen(false);
          openDetails(productId);
        }}
      />
      <StockInDialog
        inventory={selectedInventory}
        open={stockInOpen}
        pending={
          selectedInventory ? pendingMutationProductIds.has(selectedInventory.productId) : false
        }
        onClose={() => setStockInOpen(false)}
        onSubmit={(input) =>
          selectedInventory
            ? handleMutation(
                selectedInventory.productId,
                () => stockInInventory(selectedInventory.productId, input),
                "Stock added",
                "Inventory and batch quantities were updated successfully."
              )
            : Promise.resolve(false)
        }
      />
      <StockAdjustmentDialog
        inventory={selectedInventory}
        open={adjustOpen}
        pending={
          selectedInventory ? pendingMutationProductIds.has(selectedInventory.productId) : false
        }
        onClose={() => setAdjustOpen(false)}
        onSubmit={(input) =>
          selectedInventory
            ? handleMutation(
                selectedInventory.productId,
                () => adjustInventoryStock(selectedInventory.productId, input),
                "Stock updated",
                "The inventory adjustment was recorded in movement history."
              )
            : Promise.resolve(false)
        }
      />
      <MovementHistoryDialog
        inventory={selectedInventory}
        open={movementsOpen}
        refreshVersion={movementRefreshVersion}
        onClose={() => setMovementsOpen(false)}
      />
    </div>
  );
}

function FilterSelect({
  children,
  icon: Icon,
  label,
  onChange,
  minWidthClassName,
  value
}: {
  children: ReactNode;
  icon: LucideIcon;
  label: string;
  minWidthClassName?: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label
      className={`relative flex h-10 shrink-0 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600 ${minWidthClassName ?? "w-auto"}`}
    >
      <span className="sr-only">{label}</span>
      <Icon className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
      <Select
        aria-label={label}
        className="h-auto w-auto min-w-0 border-0 bg-transparent px-0 py-0 pr-7 shadow-none focus-visible:ring-0"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </Select>
      <ChevronDown
        className="pointer-events-none absolute right-3 h-4 w-4 shrink-0 text-slate-400"
        aria-hidden="true"
      />
    </label>
  );
}

function InventoryTable({
  onOpenDetails,
  rows
}: {
  onOpenDetails: (productId: string) => void;
  rows: InventoryRecord[];
}) {
  return (
    <div className="overflow-hidden rounded-md border border-slate-200">
      <Table className="table-fixed">
        <TableHeader className="bg-slate-100">
          <TableRow>
            <TableHead className="w-[48%] sm:w-[38%] lg:w-[24%]">Product</TableHead>
            <TableHead className="hidden lg:table-cell lg:w-[11%]">SKU</TableHead>
            <TableHead className="hidden xl:table-cell xl:w-[11%]">Category</TableHead>
            <TableHead className="w-[13%] text-right sm:w-[10%]">Quantity</TableHead>
            <TableHead className="hidden lg:table-cell lg:w-[9%] text-right">Reorder</TableHead>
            <TableHead className="hidden xl:table-cell xl:w-[9%] text-right">Target</TableHead>
            <TableHead className="w-[18%] sm:w-[15%]">Status</TableHead>
            <TableHead className="hidden md:table-cell md:w-[12%]">Nearest expiry</TableHead>
            <TableHead className="hidden xl:table-cell xl:w-[8%] text-right">Batches</TableHead>
            <TableHead className="w-[21%] text-center sm:w-[12%]">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              aria-label={`View inventory for ${row.productName}`}
              className="cursor-pointer bg-white hover:bg-emerald-50/40 focus-within:bg-emerald-50/70"
              key={row.inventoryId}
              tabIndex={0}
              onClick={() => onOpenDetails(row.productId)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onOpenDetails(row.productId);
                }
              }}
            >
              <TableCell>
                <p className="font-medium text-slate-950">{row.productName}</p>
                <p className="mt-1 text-xs text-slate-500">{row.barcode ?? row.unit}</p>
                <div className="mt-2 space-y-1 text-xs text-slate-500 lg:hidden">
                  <p>SKU: {row.sku}</p>
                  <p>
                    {row.category.name} · Reorder {row.reorderLevel} · Target {row.targetStockLevel}
                  </p>
                </div>
              </TableCell>
              <TableCell className="hidden break-words text-slate-600 lg:table-cell">
                {row.sku}
              </TableCell>
              <TableCell className="hidden text-slate-600 xl:table-cell">
                {row.category.name}
              </TableCell>
              <TableCell className="text-right font-semibold text-slate-950">
                {row.currentQuantity}
              </TableCell>
              <TableCell className="hidden text-right text-slate-600 lg:table-cell">
                {row.reorderLevel}
              </TableCell>
              <TableCell className="hidden text-right text-slate-600 xl:table-cell">
                {row.targetStockLevel}
              </TableCell>
              <TableCell>
                <StockStatusBadge status={row.stockStatus} />
              </TableCell>
              <TableCell className="hidden text-xs text-slate-600 md:table-cell">
                <ExpiryValue value={row.nearestExpiry} />
              </TableCell>
              <TableCell className="hidden text-right text-slate-600 xl:table-cell">
                {row.batchCount}
              </TableCell>
              <TableCell className="text-center">
                <Button
                  aria-label={`View details for ${row.productName}`}
                  size="sm"
                  type="button"
                  variant="secondary"
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpenDetails(row.productId);
                  }}
                >
                  View
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function InventoryTableSkeleton({ rowCount }: { rowCount: number }) {
  return (
    <div className="overflow-hidden rounded-md border border-slate-200">
      {Array.from({ length: Math.min(rowCount, 8) }, (_, index) => (
        <div
          className="grid grid-cols-[minmax(0,1fr)_70px_110px] gap-4 border-b border-slate-100 px-4 py-4 last:border-0"
          key={index}
        >
          <span className="loading-shimmer h-4 rounded bg-slate-100" />
          <span className="loading-shimmer h-4 rounded bg-slate-100" />
          <span className="loading-shimmer h-4 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

function StockStatusBadge({ status }: { status: InventoryRecord["stockStatus"] }) {
  const display = stockStatusDisplay[status];
  return <StatusBadge variant={display.variant}>{display.label}</StatusBadge>;
}
function ExpiryValue({ value }: { value: string | null }) {
  if (!value) return <>No expiry</>;
  const date = new Date(value);
  const isPast = date.getTime() < Date.now();
  return (
    <span className={isPast ? "font-medium text-red-700" : ""}>
      {date.toLocaleDateString()} {isPast ? "(Expired)" : ""}
    </span>
  );
}
function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function InventoryDetailsDialog({
  error,
  inventory,
  isLoading,
  isOpen,
  isOwner,
  mutationPending,
  onClose,
  onOpenAdjust,
  onOpenMovements,
  onOpenStockIn
}: {
  error: string | null;
  inventory: InventoryRecord | null;
  isLoading: boolean;
  isOpen: boolean;
  isOwner: boolean;
  mutationPending: boolean;
  onClose: () => void;
  onOpenAdjust: () => void;
  onOpenMovements: () => void;
  onOpenStockIn: () => void;
}) {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        aria-describedby="inventory-details-description"
        className="flex max-h-[90vh] w-[calc(100vw-32px)] max-w-[820px] flex-col gap-0 p-0"
      >
        <DialogHeader className="border-b border-slate-200 px-6 py-5 pr-14">
          <DialogClose asChild>
            <Button
              aria-label="Close inventory details"
              className="absolute right-4 top-4"
              size="icon"
              type="button"
              variant="ghost"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogClose>
          <DialogTitle>{inventory?.productName ?? "Inventory details"}</DialogTitle>
          <DialogDescription id="inventory-details-description">
            Review catalog and current inventory information.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {isLoading ? (
            <DetailsSkeleton />
          ) : error ? (
            <Alert variant="destructive">
              <AlertTitle>Unable to load inventory details</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : inventory ? (
            <div className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <Detail label="SKU" value={inventory.sku} />
                <Detail label="Barcode" value={inventory.barcode ?? "Not set"} />
                <Detail label="Category" value={inventory.category.name} />
                <Detail label="Unit" value={inventory.unit} />
                <Detail
                  label="Availability"
                  value={inventory.status === "ACTIVE" ? "Available" : inventory.status}
                />
                <Detail label="Current quantity" value={String(inventory.currentQuantity)} />
                <Detail label="Reorder level" value={String(inventory.reorderLevel)} />
                <Detail label="Target stock level" value={String(inventory.targetStockLevel)} />
                <Detail
                  label="Stock status"
                  value={stockStatusDisplay[inventory.stockStatus].label}
                />
                <Detail label="Batch count" value={String(inventory.batchCount)} />
                <Detail
                  label="Nearest expiry"
                  value={
                    inventory.nearestExpiry
                      ? new Date(inventory.nearestExpiry).toLocaleDateString()
                      : "No expiry"
                  }
                />
                <Detail
                  label="Last updated"
                  value={
                    inventory.lastStockUpdatedAt
                      ? new Date(inventory.lastStockUpdatedAt).toLocaleString()
                      : "Not yet updated"
                  }
                />
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Description
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  {inventory.description ?? "No description provided."}
                </p>
              </div>
            </div>
          ) : null}
        </div>
        <DialogFooter className="bg-white/95">
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={onOpenMovements}
            disabled={!inventory || isLoading}
          >
            {" "}
            <History className="h-4 w-4" />
            Movement history
          </Button>
          {isOwner ? (
            <>
              <Button
                type="button"
                variant="secondary"
                onClick={onOpenAdjust}
                disabled={!inventory || isLoading || mutationPending}
              >
                <PencilLine className="h-4 w-4" />
                Adjust stock
              </Button>
              <Button
                type="button"
                onClick={onOpenStockIn}
                disabled={!inventory || isLoading || mutationPending}
              >
                <PackagePlus className="h-4 w-4" />
                Stock in
              </Button>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 p-3">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}
function DetailsSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {Array.from({ length: 10 }, (_, index) => (
        <div className="h-16 loading-shimmer rounded-md bg-slate-100" key={index} />
      ))}
    </div>
  );
}

function BarcodeLookupDialog({
  onClose,
  onFound,
  open
}: {
  onClose: () => void;
  onFound: (productId: string) => void;
  open: boolean;
}) {
  const [barcode, setBarcode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const requestRef = useRef(0);
  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!barcode.trim() || pending) {
      if (!barcode.trim()) setError("Enter a barcode to search inventory.");
      return;
    }
    const id = ++requestRef.current;
    setPending(true);
    setError(null);
    try {
      const result = await waitForMinimumDuration(
        lookupInventoryByBarcode(barcode.trim()),
        LOOKUP_MINIMUM_MS
      );
      if (id === requestRef.current) onFound(result.productId);
    } catch (lookupError) {
      if (id === requestRef.current)
        setError(
          lookupError instanceof Error ? lookupError.message : "Unable to search inventory."
        );
    } finally {
      if (id === requestRef.current) setPending(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !pending) onClose();
      }}
    >
      <DialogContent aria-describedby="barcode-lookup-description">
        <DialogHeader>
          <DialogTitle>Barcode lookup</DialogTitle>
          <DialogDescription id="barcode-lookup-description">
            Scan or enter a product barcode to open its inventory record.
          </DialogDescription>
        </DialogHeader>
        <form
          id="barcode-lookup-form"
          className="space-y-4 px-6"
          onSubmit={(event) => void submit(event)}
        >
          <div className="space-y-2">
            <Label htmlFor="inventory-barcode">Barcode</Label>
            <Input
              autoComplete="off"
              id="inventory-barcode"
              ref={inputRef}
              value={barcode}
              onChange={(event) => setBarcode(event.target.value)}
            />
          </div>
          {error ? (
            <p aria-live="polite" className="text-sm text-red-700">
              {error}
            </p>
          ) : null}
        </form>
        <DialogFooter>
          <Button disabled={pending} type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={pending || !barcode.trim()} form="barcode-lookup-form" type="submit">
            {pending ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}{" "}
            {pending ? "Searching..." : "Search"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StockInDialog({
  inventory,
  onClose,
  onSubmit,
  open,
  pending
}: {
  inventory: InventoryRecord | null;
  onClose: () => void;
  onSubmit: (input: StockInRequest) => Promise<boolean>;
  open: boolean;
  pending: boolean;
}) {
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [referenceType, setReferenceType] = useState("");
  const [referenceId, setReferenceId] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setQuantity("");
      setReason("");
      setReferenceType("");
      setReferenceId("");
      setError(null);
    }
  }, [open]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = Number(quantity);
    if (!Number.isInteger(parsed) || parsed < 1) {
      setError("Quantity must be a positive whole number.");
      return;
    }
    const succeeded = await onSubmit({
      quantity: parsed,
      reason: reason.trim() || undefined,
      referenceType: referenceType.trim() || undefined,
      referenceId: referenceId.trim() || undefined
    });
    if (succeeded) onClose();
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !pending) onClose();
      }}
    >
      <DialogContent aria-describedby="stock-in-description">
        <DialogHeader>
          <DialogTitle>Stock in</DialogTitle>
          <DialogDescription id="stock-in-description">
            Add stock through the batch-aware inventory transaction.
          </DialogDescription>
        </DialogHeader>
        <form
          id="stock-in-form"
          className="space-y-4 px-6"
          onSubmit={(event) => void submit(event)}
        >
          <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">
            {inventory?.productName} currently has{" "}
            <strong>{inventory?.currentQuantity ?? 0}</strong> units.
          </p>
          <Field
            label="Quantity"
            id="stock-in-quantity"
            inputMode="numeric"
            value={quantity}
            onChange={setQuantity}
          />
          <Field
            label="Reason (optional)"
            id="stock-in-reason"
            value={reason}
            onChange={setReason}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Reference type (optional)"
              id="stock-in-reference-type"
              value={referenceType}
              onChange={setReferenceType}
            />
            <Field
              label="Reference ID (optional)"
              id="stock-in-reference-id"
              value={referenceId}
              onChange={setReferenceId}
            />
          </div>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
        </form>
        <DialogFooter>
          <Button disabled={pending} type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={pending} form="stock-in-form" type="submit">
            {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            {pending ? "Adding stock..." : "Add stock"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StockAdjustmentDialog({
  inventory,
  onClose,
  onSubmit,
  open,
  pending
}: {
  inventory: InventoryRecord | null;
  onClose: () => void;
  onSubmit: (input: StockAdjustmentRequest) => Promise<boolean>;
  open: boolean;
  pending: boolean;
}) {
  const [movementType, setMovementType] =
    useState<StockAdjustmentRequest["movementType"]>("ADJUSTMENT_IN");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [referenceType, setReferenceType] = useState("");
  const [referenceId, setReferenceId] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setMovementType("ADJUSTMENT_IN");
      setQuantity("");
      setReason("");
      setReferenceType("");
      setReferenceId("");
      setError(null);
    }
  }, [open]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = Number(quantity);
    if (!Number.isInteger(parsed) || parsed < 1) {
      setError("Quantity must be a positive whole number.");
      return;
    }
    if (!reason.trim()) {
      setError("A reason is required for an adjustment.");
      return;
    }
    if (movementType === "ADJUSTMENT_OUT" && parsed > (inventory?.currentQuantity ?? 0)) {
      setError("Removal quantity cannot exceed current stock.");
      return;
    }
    const succeeded = await onSubmit({
      movementType,
      quantity: parsed,
      reason: reason.trim(),
      referenceType: referenceType.trim() || undefined,
      referenceId: referenceId.trim() || undefined
    });
    if (succeeded) onClose();
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !pending) onClose();
      }}
    >
      <DialogContent aria-describedby="stock-adjustment-description">
        <DialogHeader>
          <DialogTitle>Adjust stock</DialogTitle>
          <DialogDescription id="stock-adjustment-description">
            Adjustments are recorded in movement history and can be corrected with another audited
            adjustment.
          </DialogDescription>
        </DialogHeader>
        <form
          id="stock-adjustment-form"
          className="space-y-4 px-6"
          onSubmit={(event) => void submit(event)}
        >
          <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">
            Current available quantity: <strong>{inventory?.currentQuantity ?? 0}</strong>
          </p>
          <div className="space-y-2">
            <Label htmlFor="adjustment-direction">Adjustment type</Label>
            <Select
              id="adjustment-direction"
              value={movementType}
              onChange={(event) =>
                setMovementType(event.target.value as StockAdjustmentRequest["movementType"])
              }
            >
              <option value="ADJUSTMENT_IN">Add stock</option>
              <option value="ADJUSTMENT_OUT">Remove stock</option>
            </Select>
          </div>
          <Field
            label="Quantity"
            id="adjustment-quantity"
            inputMode="numeric"
            value={quantity}
            onChange={setQuantity}
          />
          <Field label="Reason" id="adjustment-reason" value={reason} onChange={setReason} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Reference type (optional)"
              id="adjustment-reference-type"
              value={referenceType}
              onChange={setReferenceType}
            />
            <Field
              label="Reference ID (optional)"
              id="adjustment-reference-id"
              value={referenceId}
              onChange={setReferenceId}
            />
          </div>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
        </form>
        <DialogFooter>
          <Button disabled={pending} type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={pending} form="stock-adjustment-form" type="submit">
            {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            {pending ? "Updating stock..." : "Update stock"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  id,
  inputMode,
  label,
  onChange,
  value
}: {
  id: string;
  inputMode?: "numeric" | "text";
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        inputMode={inputMode}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function MovementHistoryDialog({
  inventory,
  onClose,
  open,
  refreshVersion
}: {
  inventory: InventoryRecord | null;
  onClose: () => void;
  open: boolean;
  refreshVersion: number;
}) {
  const [items, setItems] = useState<MovementRecord[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [movementType, setMovementType] = useState<"ALL" | InventoryMovementType>("ALL");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const load = async () => {
    if (!inventory) return;
    const id = ++requestRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const result = await waitForMinimumDuration(
        fetchMovements(
          inventory.productId,
          { movementType: movementType === "ALL" ? undefined : movementType, page, pageSize: 10 },
          { signal: controller.signal }
        ),
        MOVEMENTS_MINIMUM_MS
      );
      if (id === requestRef.current) {
        setItems(result.items);
        setMeta(result.meta);
      }
    } catch (loadError) {
      if (id === requestRef.current && !isAbortError(loadError))
        setError("Unable to load movement history.");
    } finally {
      if (id === requestRef.current) setLoading(false);
    }
  };
  useEffect(() => {
    if (open) void load();
  }, [open, inventory?.productId, movementType, page, refreshVersion]);
  useEffect(() => () => abortRef.current?.abort(), []);
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogContent
        aria-describedby="movement-history-description"
        className="flex max-h-[90vh] w-[calc(100vw-32px)] max-w-[900px] flex-col gap-0 p-0"
      >
        <DialogHeader className="border-b border-slate-200 px-6 py-5">
          <DialogTitle>Movement history</DialogTitle>
          <DialogDescription id="movement-history-description">
            Audited inventory changes for {inventory?.productName ?? "this product"}.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div className="max-w-xs">
            <Label htmlFor="movement-type">Movement type</Label>
            <Select
              id="movement-type"
              className="mt-2"
              value={movementType}
              onChange={(event) => {
                setMovementType(event.target.value as typeof movementType);
                setPage(1);
              }}
            >
              <option value="ALL">All movements</option>
              {movementTypes.map((type) => (
                <option key={type} value={type}>
                  {type.replaceAll("_", " ")}
                </option>
              ))}
            </Select>
          </div>
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Unable to load movement history</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {loading && items.length === 0 ? (
            <DetailsSkeleton />
          ) : items.length === 0 && !loading && !error ? (
            <EmptyState
              description="Stock movements will appear after stock-in, adjustments, or sales."
              icon={ClipboardList}
              title="No movements recorded"
            />
          ) : (
            <div className={loading ? "opacity-60" : ""}>
              <div className="overflow-hidden rounded-md border border-slate-200">
                <Table>
                  <TableHeader className="bg-slate-100">
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Before</TableHead>
                      <TableHead className="text-right">Changed</TableHead>
                      <TableHead className="text-right">After</TableHead>
                      <TableHead className="hidden md:table-cell">Reference / reason</TableHead>
                      <TableHead className="hidden lg:table-cell">Actor</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {item.type.replaceAll("_", " ")}
                        </TableCell>
                        <TableCell className="text-right">{item.quantityBefore}</TableCell>
                        <TableCell className="text-right">
                          {item.type === "ADJUSTMENT_OUT" || item.type === "SALE" ? "-" : "+"}
                          {item.quantity}
                        </TableCell>
                        <TableCell className="text-right">{item.quantityAfter}</TableCell>
                        <TableCell className="hidden max-w-48 text-xs text-slate-600 md:table-cell">
                          {item.referenceType ?? item.reason ?? "-"}
                        </TableCell>
                        <TableCell className="hidden text-xs text-slate-600 lg:table-cell">
                          {item.performedBy?.name ?? "System"}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600">
                          {new Date(item.createdAt).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {meta && meta.totalItems > 0 ? (
                <AppPagination
                  className="mt-4"
                  isLoading={loading}
                  itemLabel="movements"
                  page={page}
                  pageSize={10}
                  totalItems={meta.totalItems}
                  totalPages={meta.totalPages}
                  onPageChange={setPage}
                />
              ) : null}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
