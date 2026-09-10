import {
  ArrowUpDown,
  Boxes,
  CalendarDays,
  ChevronDown,
  CircleCheck,
  ClipboardList,
  FileUp,
  Filter,
  History,
  LoaderCircle,
  Minus,
  PackagePlus,
  PencilLine,
  Plus,
  Search,
  Tag,
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
  stockInInventory,
  type InventoryListQuery,
  type InventoryMovementQuery,
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
import { InventoryImportDialog } from "@/components/inventory/InventoryImportDialog";

const DEFAULT_PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 350;
const INVENTORY_INITIAL_MINIMUM_MS = 500;
const INVENTORY_UPDATE_MINIMUM_MS = 400;
const DETAILS_MINIMUM_MS = 450;
const MOVEMENTS_MINIMUM_MS = 450;
const MUTATION_MINIMUM_MS = 550;
const MOVEMENT_PAGE_SIZE = 10;
const MOVEMENT_ASCENDING_FETCH_SIZE = 100;

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
type MovementDateRange = "ALL_TIME" | "TODAY" | "LAST_7_DAYS" | "LAST_30_DAYS" | "THIS_MONTH" | "CUSTOM";

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

const adjustmentReasonOptions = [
  { label: "Physical count", value: "Physical count correction" },
  { label: "Damaged", value: "Damaged" },
  { label: "Expired", value: "Expired" },
  { label: "Returned item", value: "Returned item" },
  { label: "Other", value: "OTHER" }
] as const;

type AdjustmentReasonPreset = (typeof adjustmentReasonOptions)[number]["value"];

function formatMovementAction(type: string) {
  switch (type) {
    case "STOCK_IN":
      return "Stock received";
    case "ADJUSTMENT_IN":
      return "Quantity increased";
    case "ADJUSTMENT_OUT":
      return "Quantity reduced";
    case "SALE":
      return "Sold through POS";
    case "RETURN_IN":
      return "Return received";
    case "RETURN_OUT":
      return "Return sent";
    case "DAMAGE":
      return "Marked as damaged";
    case "EXPIRED":
      return "Marked as expired";
    case "INITIAL_STOCK":
      return "Opening stock";
    default:
      return type.replaceAll("_", " ");
  }
}

function formatMovementReason(item: MovementRecord) {
  return item.reason ?? "No reason recorded";
}

function isReductionMovement(type: string) {
  return (
    type === "SALE" ||
    type === "ADJUSTMENT_OUT" ||
    type === "RETURN_OUT" ||
    type === "DAMAGE" ||
    type === "EXPIRED"
  );
}

function formatMovementChange(item: MovementRecord) {
  return `${isReductionMovement(item.type) ? "-" : "+"}${item.quantity}`;
}

function formatMovementSource(item: MovementRecord) {
  if (!item.referenceType) return null;
  return item.referenceType
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/(^|\s)\S/g, (character) => character.toUpperCase());
}

function localDateFromInput(value: string, endOfDay: boolean) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;

  return new Date(
    year,
    month - 1,
    day,
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0
  );
}

function buildMovementDateWindow(
  range: MovementDateRange,
  customFrom: string,
  customTo: string
): { from?: string; to?: string; error?: string } {
  if (range === "ALL_TIME") return {};

  if (range === "CUSTOM") {
    const fromDate = customFrom ? localDateFromInput(customFrom, false) : null;
    const toDate = customTo ? localDateFromInput(customTo, true) : null;

    if (fromDate && toDate && fromDate.getTime() > toDate.getTime()) {
      return { error: "Start date must be on or before the end date." };
    }

    return {
      ...(fromDate ? { from: fromDate.toISOString() } : {}),
      ...(toDate ? { to: toDate.toISOString() } : {})
    };
  }

  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (range === "LAST_7_DAYS") {
    start.setDate(start.getDate() - 6);
  } else if (range === "LAST_30_DAYS") {
    start.setDate(start.getDate() - 29);
  } else if (range === "THIS_MONTH") {
    start.setDate(1);
  }

  return {
    from: start.toISOString(),
    to: now.toISOString()
  };
}

async function fetchAscendingMovementPage(
  productId: string,
  baseQuery: Omit<InventoryMovementQuery, "page" | "pageSize">,
  page: number,
  pageSize: number,
  signal: AbortSignal
): Promise<{ items: MovementRecord[]; meta: PaginationMeta }> {
  const probe = await fetchMovements(
    productId,
    { ...baseQuery, page: 1, pageSize: 1 },
    { signal }
  );
  const totalItems = probe.meta.totalItems;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  if (totalItems === 0) {
    return {
      items: [],
      meta: { page: 1, pageSize, totalItems: 0, totalPages: 1 }
    };
  }

  const normalizedPage = Math.min(page, totalPages);
  const ascendingStart = (normalizedPage - 1) * pageSize;
  const ascendingEndExclusive = Math.min(ascendingStart + pageSize, totalItems);
  const descendingStart = totalItems - ascendingEndExclusive;
  const descendingEndExclusive = totalItems - ascendingStart;
  const firstServerPage = Math.floor(descendingStart / MOVEMENT_ASCENDING_FETCH_SIZE) + 1;
  const lastServerPage = Math.floor((descendingEndExclusive - 1) / MOVEMENT_ASCENDING_FETCH_SIZE) + 1;
  const requests: Array<Promise<{ items: MovementRecord[]; meta: PaginationMeta }>> = [];

  for (let serverPage = firstServerPage; serverPage <= lastServerPage; serverPage += 1) {
    requests.push(
      fetchMovements(
        productId,
        {
          ...baseQuery,
          page: serverPage,
          pageSize: MOVEMENT_ASCENDING_FETCH_SIZE
        },
        { signal }
      )
    );
  }

  const chunks = await Promise.all(requests);
  const descendingItems = chunks.flatMap((chunk) => chunk.items);
  const firstGlobalIndex = (firstServerPage - 1) * MOVEMENT_ASCENDING_FETCH_SIZE;
  const sliceStart = descendingStart - firstGlobalIndex;
  const sliceEnd = descendingEndExclusive - firstGlobalIndex;

  return {
    items: descendingItems.slice(sliceStart, sliceEnd).reverse(),
    meta: {
      page: normalizedPage,
      pageSize,
      totalItems,
      totalPages
    }
  };
}

export function InventoryPage() {
  const { user } = useAuth();
  const { pushToast } = useToast();
  const importTriggerRef = useRef<HTMLButtonElement | null>(null);
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
  const [importOpen, setImportOpen] = useState(false);
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
        title: successTitle === "Stock received" ? "Unable to receive stock" : "Unable to update stock",
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
          <Button
            onClick={() => setImportOpen(true)}
            ref={importTriggerRef}
            type="button"
            variant="default"
          >
            <FileUp className="h-4 w-4" aria-hidden="true" />
            Import Stock
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
              <option value="quantityOnHand:asc">Lowest stock</option>
              <option value="quantityOnHand:desc">Highest stock</option>
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
                  : "Products appear here automatically. Receive stock when inventory arrives."
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
                "Stock received",
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
                "Stock adjusted",
                "The inventory correction was recorded in stock activity."
              )
            : Promise.resolve(false)
        }
      />
      <InventoryImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => void loadInventory("refresh")}
        triggerRef={importTriggerRef}
      />
      <StockActivityDialog
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
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] table-fixed border-collapse text-left text-sm">
        <thead className="bg-slate-100 text-slate-700">
          <tr>
            <th className="w-[29%] px-3 py-2.5">Product</th>
            <th className="w-[14%] px-3 py-2.5">SKU</th>
            <th className="w-[9%] px-3 py-2.5 text-center">Stock</th>
            <th className="w-[16%] px-3 py-2.5 text-center">Restock levels</th>
            <th className="w-[14%] px-3 py-2.5">Expiry</th>
            <th className="w-[7%] px-3 py-2.5 text-center">Batches</th>
            <th className="w-[11%] px-3 py-2.5 text-center">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              aria-label={`View inventory for ${row.productName}`}
              className="cursor-pointer border-t border-slate-200 bg-white transition-colors hover:bg-emerald-50/40 focus-visible:bg-emerald-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500"
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
              <td className="px-3 py-3 align-middle">
                <div className="font-medium text-slate-950">{row.productName}</div>
                <div className="mt-0.5 text-xs leading-5 text-slate-500">
                  {row.barcode ?? "No barcode"} · {row.category.name}
                </div>
              </td>
              <td className="px-3 py-3 align-middle break-words text-slate-700">{row.sku}</td>
              <td className="px-3 py-3 align-middle text-center">
                <div className="tabular-nums text-base font-semibold text-slate-950">
                  {row.currentQuantity}
                </div>
                <div className="mt-0.5 text-xs text-slate-500">on hand</div>
              </td>
              <td className="px-3 py-3 align-middle text-center">
                <div className="inline-flex items-center gap-2 whitespace-nowrap text-sm tabular-nums text-slate-700">
                  <span>
                    <span className="font-semibold text-slate-950">{row.reorderLevel}</span> reorder
                  </span>
                  <span className="text-slate-300">/</span>
                  <span>
                    <span className="font-semibold text-slate-950">{row.targetStockLevel}</span> target
                  </span>
                </div>
              </td>
              <td className="px-3 py-3 align-middle text-slate-700">
                <ExpiryValue quantity={row.currentQuantity} value={row.nearestExpiry} />
              </td>
              <td className="px-3 py-3 align-middle text-center tabular-nums text-slate-700">
                {row.batchCount === 0 ? "None" : row.batchCount}
              </td>
              <td className="px-3 py-3 align-middle text-center">
                <div className="inline-flex justify-center">
                  <StockStatusBadge status={row.stockStatus} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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

function ExpiryValue({ quantity, value }: { quantity: number; value: string | null }) {
  if (quantity <= 0) return <>No stock yet</>;
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
        className="flex max-h-[90vh] w-[calc(100vw-32px)] max-w-[860px] flex-col gap-0 p-0"
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
            Current stock position, product reference, and operational controls.
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
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <InventoryMetric label="On hand" value={String(inventory.currentQuantity)} />
                <InventoryMetric label="Reorder at" value={String(inventory.reorderLevel)} />
                <InventoryMetric label="Target" value={String(inventory.targetStockLevel)} />
                <InventoryMetric
                  label="Status"
                  value={<StockStatusBadge status={inventory.stockStatus} />}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <InfoPanel title="Stock lifecycle">
                  <InfoLine label="Batches" value={inventory.batchCount === 0 ? "None" : String(inventory.batchCount)} />
                  <InfoLine
                    label="Expiry"
                    value={
                      inventory.currentQuantity <= 0
                        ? "No stock yet"
                        : inventory.nearestExpiry
                          ? new Date(inventory.nearestExpiry).toLocaleDateString()
                          : "No expiry"
                    }
                  />
                  <InfoLine
                    label="Last stock update"
                    value={
                      inventory.lastStockUpdatedAt
                        ? new Date(inventory.lastStockUpdatedAt).toLocaleString()
                        : "Not yet updated"
                    }
                  />
                </InfoPanel>

                <InfoPanel title="Product reference">
                  <InfoLine label="SKU" value={inventory.sku} />
                  <InfoLine label="Barcode" value={inventory.barcode ?? "Not set"} />
                  <InfoLine label="Category" value={inventory.category.name} />
                  <InfoLine label="Unit" value={inventory.unit} />
                  <InfoLine
                    label="Availability"
                    value={inventory.status === "ACTIVE" ? "Available" : inventory.status}
                  />
                </InfoPanel>
              </div>

              {inventory.description ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Product note
                  </p>
                  <p className="mt-1.5 text-sm leading-6 text-slate-700">{inventory.description}</p>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        <DialogFooter className="border-t border-slate-200 bg-white/95">
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={onOpenMovements}
              disabled={!inventory || isLoading}
            >
              <History className="h-4 w-4" />
              Stock activity
            </Button>
            {isOwner ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onOpenAdjust}
                  disabled={!inventory || isLoading || mutationPending}
                >
                  <PencilLine className="h-4 w-4" />
                  Adjust quantity
                </Button>
                <Button
                  type="button"
                  onClick={onOpenStockIn}
                  disabled={!inventory || isLoading || mutationPending}
                >
                  <PackagePlus className="h-4 w-4" />
                  Receive stock
                </Button>
              </div>
            ) : null}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InventoryMetric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <div className="mt-1.5 min-h-6 text-xl font-semibold tabular-nums text-slate-950">{value}</div>
    </div>
  );
}

function InfoPanel({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
      <div className="mt-3 divide-y divide-slate-100">{children}</div>
    </section>
  );
}

function InfoLine({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="max-w-[65%] break-words text-right text-sm font-medium text-slate-900">
        {value}
      </span>
    </div>
  );
}

function DetailsSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {Array.from({ length: 8 }, (_, index) => (
        <div className="h-20 loading-shimmer rounded-lg bg-slate-100" key={index} />
      ))}
    </div>
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
  const [batchCode, setBatchCode] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [noExpirationDate, setNoExpirationDate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setQuantity("");
      setBatchCode("");
      setExpiresAt("");
      setNoExpirationDate(false);
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
    const trimmedBatchCode = batchCode.trim();
    if (!trimmedBatchCode) {
      setError("Batch/Lot number is required.");
      return;
    }
    const succeeded = await onSubmit({
      quantity: parsed,
      batchCode: trimmedBatchCode,
      expiresAt: noExpirationDate || !expiresAt ? null : expiresAt
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
      <DialogContent
        aria-describedby="stock-in-description"
        className="flex max-h-[90vh] w-[calc(100vw-32px)] max-w-[720px] flex-col gap-0 p-0"
      >
        <DialogHeader className="border-b border-slate-200 px-6 py-5 pr-14">
          <DialogClose asChild>
            <Button
              aria-label="Close receive stock"
              className="absolute right-4 top-4"
              disabled={pending}
              size="icon"
              type="button"
              variant="ghost"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogClose>
          <DialogTitle>Receive stock</DialogTitle>
          <DialogDescription id="stock-in-description">
            Record incoming stock for this product with its batch and expiry information.
          </DialogDescription>
        </DialogHeader>
        <form
          id="stock-in-form"
          className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5"
          onSubmit={(event) => void submit(event)}
        >
          <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-950">{inventory?.productName}</p>
              <p className="mt-1 text-xs text-slate-500">SKU: {inventory?.sku}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">On hand</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-slate-950">
                {inventory?.currentQuantity ?? 0}
              </p>
            </div>
          </div>
          <Field
            label="Quantity received"
            id="stock-in-quantity"
            inputMode="numeric"
            value={quantity}
            onChange={setQuantity}
          />
          <Field
            label="Batch/Lot number"
            id="stock-in-batch-code"
            value={batchCode}
            onChange={setBatchCode}
          />
          <Field
            disabled={noExpirationDate}
            label="Expiration date"
            id="stock-in-expiration-date"
            type="date"
            value={expiresAt}
            onChange={setExpiresAt}
          />
          <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
            <input
              checked={noExpirationDate}
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              type="checkbox"
              onChange={(event) => {
                const checked = event.target.checked;
                setNoExpirationDate(checked);
                if (checked) setExpiresAt("");
              }}
            />
            <span>No expiration date</span>
          </label>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
        </form>
        <DialogFooter className="border-t border-slate-200 bg-white/95">
          <Button disabled={pending} type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={pending} form="stock-in-form" type="submit">
            {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <PackagePlus className="h-4 w-4" />}
            {pending ? "Receiving stock…" : "Receive stock"}
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
  const [reasonPreset, setReasonPreset] = useState<AdjustmentReasonPreset>(
    "Physical count correction"
  );
  const [customReason, setCustomReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const currentQuantity = inventory?.currentQuantity ?? 0;
  const parsedQuantity = Number(quantity);
  const validQuantity = Number.isInteger(parsedQuantity) && parsedQuantity > 0 ? parsedQuantity : 0;
  const previewQuantity =
    movementType === "ADJUSTMENT_IN"
      ? currentQuantity + validQuantity
      : Math.max(0, currentQuantity - validQuantity);

  useEffect(() => {
    if (open) {
      setMovementType("ADJUSTMENT_IN");
      setQuantity("");
      setReasonPreset("Physical count correction");
      setCustomReason("");
      setError(null);
    }
  }, [open]);

  function changeQuantity(delta: number) {
    const next = Math.max(1, validQuantity + delta);
    setQuantity(String(next));
    setError(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1) {
      setError("Quantity must be a positive whole number.");
      return;
    }
    if (movementType === "ADJUSTMENT_OUT" && parsedQuantity > currentQuantity) {
      setError("Removal quantity cannot exceed current stock.");
      return;
    }
    const selectedReason = reasonPreset === "OTHER" ? customReason.trim() : reasonPreset;
    if (!selectedReason) {
      setError("Select or enter a reason.");
      return;
    }
    const succeeded = await onSubmit({
      movementType,
      quantity: parsedQuantity,
      reason: selectedReason
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
      <DialogContent
        aria-describedby="stock-adjustment-description"
        className="flex max-h-[90vh] w-[calc(100vw-32px)] max-w-[680px] flex-col gap-0 p-0"
      >
        <DialogHeader className="border-b border-slate-200 px-6 py-5 pr-14">
          <DialogClose asChild>
            <Button
              aria-label="Close quantity adjustment"
              className="absolute right-4 top-4"
              disabled={pending}
              size="icon"
              type="button"
              variant="ghost"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogClose>
          <DialogTitle>Adjust quantity</DialogTitle>
          <DialogDescription id="stock-adjustment-description">
            Correct the recorded stock count. Supplier deliveries should be recorded through Receiving.
          </DialogDescription>
        </DialogHeader>
        <form
          id="stock-adjustment-form"
          className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5"
          onSubmit={(event) => void submit(event)}
        >
          <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-950">{inventory?.productName}</p>
              <p className="mt-1 text-xs text-slate-500">SKU: {inventory?.sku}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Current stock</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-950">{currentQuantity}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Adjustment direction</Label>
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
              <Button
                aria-pressed={movementType === "ADJUSTMENT_IN"}
                className="w-full"
                type="button"
                variant={movementType === "ADJUSTMENT_IN" ? "default" : "ghost"}
                onClick={() => {
                  setMovementType("ADJUSTMENT_IN");
                  setError(null);
                }}
              >
                <Plus className="h-4 w-4" />
                Add
              </Button>
              <Button
                aria-pressed={movementType === "ADJUSTMENT_OUT"}
                className="w-full"
                disabled={currentQuantity <= 0}
                type="button"
                variant={movementType === "ADJUSTMENT_OUT" ? "default" : "ghost"}
                onClick={() => {
                  setMovementType("ADJUSTMENT_OUT");
                  setError(null);
                }}
              >
                <Minus className="h-4 w-4" />
                Remove
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="adjustment-quantity">Quantity</Label>
            <div className="grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2">
              <Button
                aria-label="Decrease adjustment quantity"
                disabled={pending || validQuantity <= 1}
                size="icon"
                type="button"
                variant="secondary"
                onClick={() => changeQuantity(-1)}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                id="adjustment-quantity"
                aria-label="Adjustment quantity"
                className="h-11 text-center text-lg font-semibold tabular-nums"
                inputMode="numeric"
                value={quantity}
                onChange={(event) => {
                  setQuantity(event.target.value);
                  setError(null);
                }}
              />
              <Button
                aria-label="Increase adjustment quantity"
                disabled={pending}
                size="icon"
                type="button"
                variant="secondary"
                onClick={() => changeQuantity(1)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-center">
            <div>
              <p className="text-xs font-medium text-slate-500">Current</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-slate-950">{currentQuantity}</p>
            </div>
            <span className="text-lg text-slate-400" aria-hidden="true">→</span>
            <div>
              <p className="text-xs font-medium text-slate-500">After adjustment</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-slate-950">{previewQuantity}</p>
            </div>
          </div>

          <div className="space-y-2.5">
            <Label>Reason</Label>
            <div className="flex flex-wrap gap-2">
              {adjustmentReasonOptions.map((option) => {
                const selected = reasonPreset === option.value;
                return (
                  <button
                    aria-pressed={selected}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 ${
                      selected
                        ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setReasonPreset(option.value);
                      setError(null);
                    }}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          {reasonPreset === "OTHER" ? (
            <Field
              label="Custom reason"
              id="adjustment-custom-reason"
              value={customReason}
              onChange={(value) => {
                setCustomReason(value);
                setError(null);
              }}
            />
          ) : null}

          <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            Adjustments are for corrections such as physical counts, damaged items, expiry, or returns—not routine supplier restocking.
          </div>

          {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
        </form>
        <DialogFooter className="border-t border-slate-200 bg-white/95">
          <Button disabled={pending} type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={pending} form="stock-adjustment-form" type="submit">
            {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            {pending ? "Saving adjustment…" : "Save adjustment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  disabled,
  id,
  inputMode,
  label,
  onChange,
  type = "text",
  value
}: {
  disabled?: boolean;
  id: string;
  inputMode?: "numeric" | "text";
  label: string;
  onChange: (value: string) => void;
  type?: "date" | "number" | "text";
  value: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        disabled={disabled}
        id={id}
        inputMode={inputMode}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function StockActivityDialog({
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
  const [dateRange, setDateRange] = useState<MovementDateRange>("ALL_TIME");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const load = async () => {
    if (!inventory) return;
    const dateWindow = buildMovementDateWindow(dateRange, customFrom, customTo);
    if (dateWindow.error) {
      setError(dateWindow.error);
      setItems([]);
      setMeta(null);
      return;
    }

    const id = ++requestRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);

    const baseQuery: Omit<InventoryMovementQuery, "page" | "pageSize"> = {
      movementType: movementType === "ALL" ? undefined : movementType,
      from: dateWindow.from,
      to: dateWindow.to
    };

    try {
      const request =
        sortOrder === "asc"
          ? fetchAscendingMovementPage(
              inventory.productId,
              baseQuery,
              page,
              MOVEMENT_PAGE_SIZE,
              controller.signal
            )
          : fetchMovements(
              inventory.productId,
              { ...baseQuery, page, pageSize: MOVEMENT_PAGE_SIZE },
              { signal: controller.signal }
            );
      const result = await waitForMinimumDuration(request, MOVEMENTS_MINIMUM_MS);

      if (id === requestRef.current) {
        setItems(result.items);
        setMeta(result.meta);
        if (result.meta.totalPages > 0 && page > result.meta.totalPages) {
          setPage(result.meta.totalPages);
        }
      }
    } catch (loadError) {
      if (id === requestRef.current && !isAbortError(loadError)) {
        setError("Unable to load stock activity.");
      }
    } finally {
      if (id === requestRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    if (open) void load();
  }, [
    open,
    inventory?.productId,
    movementType,
    dateRange,
    customFrom,
    customTo,
    sortOrder,
    page,
    refreshVersion
  ]);
  useEffect(() => () => abortRef.current?.abort(), []);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogContent
        aria-describedby="stock-activity-description"
        className="flex max-h-[90vh] w-[calc(100vw-32px)] max-w-[1040px] flex-col gap-0 p-0"
      >
        <DialogHeader className="border-b border-slate-200 px-6 py-5 pr-14">
          <DialogClose asChild>
            <Button
              aria-label="Close stock activity"
              className="absolute right-4 top-4"
              size="icon"
              type="button"
              variant="ghost"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogClose>
          <DialogTitle>Stock activity</DialogTitle>
          <DialogDescription id="stock-activity-description">
            Chronological inventory ledger for {inventory?.productName ?? "this product"}.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="stock-activity-date-range">Date range</Label>
              <div className="relative">
                <CalendarDays
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <Select
                  id="stock-activity-date-range"
                  className="pl-9"
                  value={dateRange}
                  onChange={(event) => {
                    setDateRange(event.target.value as MovementDateRange);
                    setPage(1);
                  }}
                >
                  <option value="ALL_TIME">All time</option>
                  <option value="TODAY">Today</option>
                  <option value="LAST_7_DAYS">Last 7 days</option>
                  <option value="LAST_30_DAYS">Last 30 days</option>
                  <option value="THIS_MONTH">This month</option>
                  <option value="CUSTOM">Custom range</option>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="movement-type">Movement</Label>
              <Select
                id="movement-type"
                value={movementType}
                onChange={(event) => {
                  setMovementType(event.target.value as typeof movementType);
                  setPage(1);
                }}
              >
                <option value="ALL">All movements</option>
                {movementTypes.map((type) => (
                  <option key={type} value={type}>
                    {formatMovementAction(type)}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stock-activity-sort">Order</Label>
              <Select
                id="stock-activity-sort"
                value={sortOrder}
                onChange={(event) => {
                  setSortOrder(event.target.value as SortOrder);
                  setPage(1);
                }}
              >
                <option value="desc">Latest first</option>
                <option value="asc">Oldest first</option>
              </Select>
            </div>
          </div>

          {dateRange === "CUSTOM" ? (
            <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
              <Field
                id="stock-activity-from"
                label="From"
                type="date"
                value={customFrom}
                onChange={(value) => {
                  setCustomFrom(value);
                  setPage(1);
                }}
              />
              <Field
                id="stock-activity-to"
                label="To"
                type="date"
                value={customTo}
                onChange={(value) => {
                  setCustomTo(value);
                  setPage(1);
                }}
              />
            </div>
          ) : null}

          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Unable to load stock activity</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {loading && items.length === 0 ? (
            <DetailsSkeleton />
          ) : items.length === 0 && !loading && !error ? (
            <EmptyState
              description="Try another date range or movement filter. New stock changes will appear here automatically."
              icon={ClipboardList}
              title="No stock activity found"
            />
          ) : (
            <div className={loading ? "opacity-60" : ""}>
              <div className="max-h-[430px] overflow-auto rounded-lg border border-slate-200">
                <Table className="min-w-[820px]">
                  <TableHeader className="sticky top-0 z-10 bg-slate-100">
                    <TableRow>
                      <TableHead className="w-[17%]">Date & time</TableHead>
                      <TableHead className="w-[22%]">Activity</TableHead>
                      <TableHead className="w-[10%] text-center">Change</TableHead>
                      <TableHead className="w-[15%] text-center">Stock</TableHead>
                      <TableHead className="w-[24%]">Reason</TableHead>
                      <TableHead className="w-[12%]">Actor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => {
                      const date = new Date(item.createdAt);
                      const source = formatMovementSource(item);
                      const reduction = isReductionMovement(item.type);

                      return (
                        <TableRow key={item.id}>
                          <TableCell className="align-middle">
                            <div className="font-medium text-slate-900">
                              {date.toLocaleDateString()}
                            </div>
                            <div className="mt-0.5 text-xs text-slate-500">
                              {date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                            </div>
                          </TableCell>
                          <TableCell className="align-middle">
                            <div className="font-medium text-slate-900">
                              {formatMovementAction(item.type)}
                            </div>
                            {source ? <div className="mt-0.5 text-xs text-slate-500">{source}</div> : null}
                          </TableCell>
                          <TableCell className="align-middle text-center">
                            <span
                              className={`inline-flex min-w-12 justify-center rounded-full px-2 py-1 text-sm font-semibold tabular-nums ${
                                reduction
                                  ? "bg-red-50 text-red-700"
                                  : "bg-emerald-50 text-emerald-700"
                              }`}
                            >
                              {formatMovementChange(item)}
                            </span>
                          </TableCell>
                          <TableCell className="align-middle text-center font-medium tabular-nums text-slate-800">
                            {item.quantityBefore} <span className="text-slate-400">→</span> {item.quantityAfter}
                          </TableCell>
                          <TableCell className="align-middle text-sm text-slate-600">
                            {formatMovementReason(item)}
                          </TableCell>
                          <TableCell className="align-middle text-sm text-slate-600">
                            {item.performedBy?.name ?? "System"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {meta && meta.totalItems > 0 ? (
                <AppPagination
                  className="mt-4"
                  isLoading={loading}
                  itemLabel="stock movements"
                  page={meta.page}
                  pageSize={MOVEMENT_PAGE_SIZE}
                  totalItems={meta.totalItems}
                  totalPages={meta.totalPages}
                  onPageChange={setPage}
                />
              ) : null}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
