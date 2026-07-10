import {
  Download,
  FileUp,
  Filter,
  LoaderCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type DragEvent, type RefObject } from "react";

import { AppPagination } from "@/components/shared/AppPagination";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useToast } from "@/components/shared/ToastProvider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  downloadProductImportTemplate,
  fetchMovements,
  fetchProducts,
  importProducts,
  previewProductImport,
  updateProductStatus,
  type ProductImportIssue,
  type MovementRecord,
  type PaginationMeta,
  type ProductImportPreview,
  type ProductImportRow,
  type ProductImportSummary,
  type ProductRecord
} from "@/services/catalogApi";

const MAX_IMPORT_FILE_SIZE_MB = 5;
const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
const SEARCH_DEBOUNCE_MS = 300;
const PREVIEW_LOADING_MINIMUM_MS = 500;
const IMPORT_LOADING_MINIMUM_MS = 700;

type ImportPhase =
  | "idle"
  | "processing-file"
  | "file-ready"
  | "previewing"
  | "preview-ready"
  | "importing"
  | "success"
  | "error";

type ImportState = {
  file: File | null;
  preview: ProductImportPreview | null;
  summary: ProductImportSummary | null;
  phase: ImportPhase;
  error: string | null;
};

export function ProductsPage() {
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [movements, setMovements] = useState<MovementRecord[]>([]);
  const [movementLoading, setMovementLoading] = useState(false);
  const [movementError, setMovementError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE" | "DISCONTINUED">(
    "ALL"
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [paginationMeta, setPaginationMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [importState, setImportState] = useState<ImportState>({
    file: null,
    preview: null,
    summary: null,
    phase: "idle",
    error: null
  });
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const importTriggerRef = useRef<HTMLButtonElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const importSessionRef = useRef(0);
  const { pushToast } = useToast();

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) ?? null,
    [products, selectedProductId]
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [searchInput]);

  async function loadCatalog(nextPage = page, nextPageSize = pageSize) {
    setLoading(true);
    setLoadError(null);

    try {
      const response = await fetchProducts({
        page: nextPage,
        pageSize: nextPageSize,
        search: debouncedSearch.trim() || undefined,
        status: statusFilter === "ALL" ? undefined : statusFilter
      });

      if (!response.meta) {
        throw new Error("Product pagination metadata is unavailable.");
      }

      if (response.meta.totalPages > 0 && nextPage > response.meta.totalPages) {
        setPage(response.meta.totalPages);
        return;
      }

      setProducts(response.items);
      setPaginationMeta(response.meta);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load products.");
      setPaginationMeta(null);
      setProducts([]);
      setSelectedProductId(null);
      setMovements([]);
      setMovementError(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCatalog();
  }, [debouncedSearch, statusFilter, page, pageSize]);

  useEffect(() => {
    if (!selectedProductId) {
      setMovements([]);
      setMovementError(null);
      setMovementLoading(false);
      return;
    }

    const productId = selectedProductId;
    let active = true;

    async function loadMovements() {
      setMovementLoading(true);
      setMovementError(null);

      try {
        const result = await fetchMovements(productId, { pageSize: 20 });

        if (!active) {
          return;
        }

        setMovements(result.items);
      } catch (error) {
        if (!active) {
          return;
        }

        setMovements([]);
        setMovementError(error instanceof Error ? error.message : "Unable to load movements.");
      } finally {
        if (active) {
          setMovementLoading(false);
        }
      }
    }

    void loadMovements();

    return () => {
      active = false;
    };
  }, [selectedProductId]);

  useEffect(() => {
    if (!selectedProductId) {
      return;
    }

    const selectedProductStillVisible = products.some(
      (product) => product.id === selectedProductId
    );

    if (!selectedProductStillVisible) {
      setSelectedProductId(null);
      setMovements([]);
      setMovementError(null);
      setMovementLoading(false);
    }
  }, [products, selectedProductId]);

  async function refreshCatalog() {
    await loadCatalog(page, pageSize);
  }

  function resetImportFlow() {
    importSessionRef.current += 1;
    setImportState({
      file: null,
      preview: null,
      summary: null,
      phase: "idle",
      error: null
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function closeImportDialog() {
    setIsImportDialogOpen(false);
    resetImportFlow();
  }

  function openImportDialog() {
    resetImportFlow();
    setIsImportDialogOpen(true);
  }

  async function handleTemplateDownload() {
    try {
      const csv = await downloadProductImportTemplate();
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = url;
      anchor.download = "product-import-template.csv";
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch {
      pushToast({
        message: "Unable to download the template right now.",
        title: "Template unavailable",
        variant: "error"
      });
    }
  }

  async function waitForMinimumDuration<T>(promise: Promise<T>, minimumDurationMs: number) {
    const [result] = await Promise.all([
      promise.then(
        (value) => ({ status: "fulfilled" as const, value }),
        (error) => ({ status: "rejected" as const, error })
      ),
      new Promise((resolve) => window.setTimeout(resolve, minimumDurationMs))
    ]);

    if (result.status === "rejected") {
      throw result.error;
    }

    return result.value;
  }

  function getImportFileValidationError(file: File) {
    if (!file.name.trim()) {
      return "File name is invalid.";
    }

    const extension = file.name.split(".").pop()?.toLowerCase();

    if (extension !== "csv" && extension !== "xlsx") {
      return "Unsupported file type. Use a CSV or XLSX file.";
    }

    if (file.size > MAX_IMPORT_FILE_SIZE_MB * 1024 * 1024) {
      return `File exceeds ${MAX_IMPORT_FILE_SIZE_MB} MB.`;
    }

    return null;
  }

  async function handleFileSelection(file: File | null) {
    if (!file) {
      resetImportFlow();
      return;
    }

    const sessionId = ++importSessionRef.current;
    const validationError = getImportFileValidationError(file);

    setImportState((current) => ({
      ...current,
      file: null,
      preview: null,
      summary: null,
      phase: "processing-file",
      error: null
    }));

    try {
      await waitForMinimumDuration(Promise.resolve(validationError), 600);

      if (sessionId !== importSessionRef.current) {
        return;
      }

      if (validationError) {
        setImportState({
          file: null,
          preview: null,
          summary: null,
          phase: "error",
          error: validationError
        });

        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }

        return;
      }

      setImportState({
        file,
        preview: null,
        summary: null,
        phase: "file-ready",
        error: null
      });
    } catch (error) {
      if (sessionId !== importSessionRef.current) {
        return;
      }

      setImportState({
        file: null,
        preview: null,
        summary: null,
        phase: "error",
        error: error instanceof Error ? error.message : "Unable to prepare file."
      });
    }
  }

  async function handlePreviewImport() {
    if (!importState.file || importState.phase !== "file-ready") {
      return;
    }

    const sessionId = importSessionRef.current;
    setImportState((current) => ({
      ...current,
      phase: "previewing",
      error: null,
      preview: null,
      summary: null
    }));

    try {
      const response = await waitForMinimumDuration(
        previewProductImport(importState.file),
        PREVIEW_LOADING_MINIMUM_MS
      );

      if (sessionId !== importSessionRef.current) {
        return;
      }

      if (!response.success) {
        setImportState((current) => ({
          ...current,
          phase: "file-ready",
          error: response.message
        }));
        return;
      }

      if (!response.data) {
        setImportState((current) => ({
          ...current,
          phase: "file-ready",
          error: "Preview failed."
        }));
        return;
      }

      const preview = response.data;

      setImportState((current) => ({
        ...current,
        phase: "preview-ready",
        preview,
        error: null
      }));
    } catch (error) {
      if (sessionId !== importSessionRef.current) {
        return;
      }

      setImportState((current) => ({
        ...current,
        phase: "file-ready",
        error: error instanceof Error ? error.message : "Preview failed."
      }));
    }
  }

  async function handleConfirmImport() {
    if (
      !importState.file ||
      importState.phase === "importing" ||
      importState.phase !== "preview-ready" ||
      !importState.preview ||
      importState.preview.invalidRows > 0
    ) {
      return;
    }

    const sessionId = importSessionRef.current;
    setImportState((current) => ({ ...current, phase: "importing", error: null }));

    try {
      const response = await waitForMinimumDuration(
        importProducts(importState.file),
        IMPORT_LOADING_MINIMUM_MS
      );

      if (sessionId !== importSessionRef.current) {
        return;
      }

      if (!response.success) {
        const details =
          response.error && typeof response.error === "object" ? response.error : null;
        const errorMessage =
          details && "code" in details ? response.message : "Product import failed.";
        setImportState((current) => ({
          ...current,
          phase: "preview-ready",
          error: errorMessage
        }));
        return;
      }

      if (!response.data) {
        setImportState((current) => ({
          ...current,
          phase: "preview-ready",
          error: "Product import failed."
        }));
        return;
      }

      setImportState({
        file: importState.file,
        preview: importState.preview,
        summary: response.data,
        phase: "success",
        error: null
      });

      await refreshCatalog();
      pushToast({
        message: "Imported products are now available in Products and Inventory.",
        title: "Import completed",
        variant: "success"
      });
    } catch (error) {
      if (sessionId !== importSessionRef.current) {
        return;
      }

      setImportState((current) => ({
        ...current,
        phase: "preview-ready",
        error: error instanceof Error ? error.message : "Import failed."
      }));
    }
  }

  async function handleDeactivate(productId: string) {
    const response = await updateProductStatus(productId, "INACTIVE");

    if (!response.success) {
      pushToast({
        message: response.message,
        title: "Deactivation failed",
        variant: "error"
      });
      return;
    }

    await refreshCatalog();
    pushToast({
      message: "The product remains in the database but is inactive for POS use.",
      title: "Product deactivated",
      variant: "warning"
    });
  }

  function toggleSelection(productId: string) {
    setSelectedProductId((current) => (current === productId ? null : productId));
  }

  function clearSelection() {
    setSelectedProductId(null);
    setMovements([]);
    setMovementError(null);
    setMovementLoading(false);
  }

  function handleSearchChange(value: string) {
    setSearchInput(value);
    setPage(1);
    clearSelection();
  }

  function handleStatusFilterChange(value: typeof statusFilter) {
    setStatusFilter(value);
    setPage(1);
    clearSelection();
  }

  function handlePageSizeChange(value: number) {
    setPageSize(value);
    setPage(1);
    clearSelection();
  }

  function handlePageChange(nextPage: number) {
    if (nextPage === page) {
      return;
    }

    setPage(nextPage);
    clearSelection();
  }

  return (
    <>
      <ImportProductsDialog
        fileInputRef={fileInputRef}
        importState={importState}
        isOpen={isImportDialogOpen}
        onCancel={closeImportDialog}
        onPreviewImport={() => void handlePreviewImport()}
        onConfirmImport={() => void handleConfirmImport()}
        onFileSelection={(file) => void handleFileSelection(file)}
        triggerRef={importTriggerRef}
      />

      <PageHeader
        eyebrow="Owner workspace"
        title="Products"
        description="Import products, verify catalog state, and keep current stock aligned with inventory and POS."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={handleTemplateDownload} type="button">
              <Download className="h-4 w-4" aria-hidden="true" />
              Template
            </Button>
            <Button
              onClick={openImportDialog}
              ref={importTriggerRef}
              type="button"
              variant="default"
            >
              <FileUp className="h-4 w-4" aria-hidden="true" />
              Import Products
            </Button>
          </div>
        }
      />

      <section className="space-y-6">
        <Card className="w-full">
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <CardTitle>Catalog overview</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-[1fr_180px]">
                <label className="flex h-11 items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-3">
                  <Search className="h-4 w-4 text-slate-500" aria-hidden="true" />
                  <input
                    className="w-full bg-transparent text-sm outline-none"
                    placeholder="Search name, SKU, barcode"
                    value={searchInput}
                    onChange={(event) => handleSearchChange(event.target.value)}
                  />
                </label>
                <label className="flex h-11 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm">
                  <Filter className="h-4 w-4 text-slate-500" aria-hidden="true" />
                  <select
                    className="w-full bg-transparent outline-none"
                    value={statusFilter}
                    onChange={(event) =>
                      handleStatusFilterChange(event.target.value as typeof statusFilter)
                    }
                  >
                    <option value="ALL">All statuses</option>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="DISCONTINUED">Discontinued</option>
                  </select>
                </label>
              </div>

              {loading ? (
                <LoadingState
                  badge="Loading"
                  helper="Refreshing the current page while keeping the catalog layout stable."
                  label="Loading product page"
                />
              ) : null}

              {loadError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {loadError}
                </div>
              ) : null}

              {!loading && !loadError && paginationMeta?.totalItems === 0 ? (
                <EmptyState
                  description="Import a CSV or Excel file to populate the catalog."
                  icon={ShieldCheck}
                  title="No products yet"
                />
              ) : null}

              {products.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="min-w-[1080px] border-collapse text-left text-sm">
                    <thead className="bg-slate-100 text-slate-700">
                      <tr>
                        <th className="w-[28%] px-3 py-2">Product</th>
                        <th className="w-[14%] px-3 py-2">SKU</th>
                        <th className="w-[14%] px-3 py-2">Barcode</th>
                        <th className="w-[14%] px-3 py-2">Category</th>
                        <th className="w-[11%] px-3 py-2">Status</th>
                        <th className="w-[11%] px-3 py-2">Selling price</th>
                        <th className="w-[8%] px-3 py-2">Stock</th>
                        <th className="w-[10%] px-3 py-2">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((product) => {
                        const isSelected = selectedProductId === product.id;

                        return (
                          <tr
                            aria-selected={isSelected}
                            className={[
                              "border-t border-slate-200 transition-colors",
                              "cursor-pointer focus-within:bg-emerald-50/70",
                              isSelected
                                ? "bg-emerald-50/70 ring-1 ring-inset ring-emerald-200"
                                : "bg-white hover:bg-emerald-50/40",
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500"
                            ].join(" ")}
                            key={product.id}
                            onClick={() => toggleSelection(product.id)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                toggleSelection(product.id);
                              }
                            }}
                            tabIndex={0}
                          >
                            <td className="px-3 py-2 align-top">
                              <div className="font-medium text-slate-950">{product.name}</div>
                              <div className="text-xs text-slate-500">
                                {product.description ?? "No description"}
                              </div>
                            </td>
                            <td className="px-3 py-2 align-top">{product.sku}</td>
                            <td className="px-3 py-2 align-top">{product.barcode ?? "-"}</td>
                            <td className="px-3 py-2 align-top">{product.category.name}</td>
                            <td className="px-3 py-2 align-top">
                              <StatusBadge variant={product.isActive ? "success" : "warning"}>
                                {product.status}
                              </StatusBadge>
                            </td>
                            <td className="px-3 py-2 align-top">
                              PHP {Number(product.sellingPrice).toFixed(2)}
                            </td>
                            <td className="px-3 py-2 align-top">
                              {product.inventory.currentQuantity}
                            </td>
                            <td className="px-3 py-2 align-top">
                              {product.isActive ? (
                                <Button
                                  size="sm"
                                  type="button"
                                  variant="secondary"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void handleDeactivate(product.id);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                                  Deactivate
                                </Button>
                              ) : (
                                <StatusBadge variant="warning">Inactive</StatusBadge>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {paginationMeta ? (
                <AppPagination
                  className={loading ? "pointer-events-none opacity-60" : undefined}
                  isLoading={loading}
                  itemLabel="products"
                  onPageChange={handlePageChange}
                  onPageSizeChange={handlePageSizeChange}
                  page={paginationMeta.page}
                  pageSize={paginationMeta.pageSize}
                  pageSizeOptions={PAGE_SIZE_OPTIONS}
                  siblingCount={1}
                  totalItems={paginationMeta.totalItems}
                  totalPages={paginationMeta.totalPages}
                />
              ) : null}
            </div>
          </CardContent>
        </Card>

        {selectedProduct ? (
          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="border-slate-200 bg-slate-50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-base">Selected product stock</CardTitle>
                  <Button onClick={clearSelection} size="sm" type="button" variant="secondary">
                    <X className="h-4 w-4" aria-hidden="true" />
                    Clear selection
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2">
                  <DetailLine label="Product" value={selectedProduct.name} />
                  <DetailLine label="SKU" value={selectedProduct.sku} />
                  <DetailLine
                    label="Stock"
                    value={String(selectedProduct.inventory.currentQuantity)}
                  />
                  <DetailLine label="Reorder level" value={String(selectedProduct.reorderLevel)} />
                  <DetailLine label="Current status" value={selectedProduct.status} />
                  <DetailLine
                    label="Availability"
                    value={selectedProduct.isActive ? "Available" : "Inactive"}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-slate-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Movement history</CardTitle>
              </CardHeader>
              <CardContent>
                {movementLoading ? (
                  <LoadingState
                    badge="Loading"
                    helper="Fetching movement history for the selected product."
                    label="Loading movements"
                  />
                ) : movementError ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                    {movementError}
                  </div>
                ) : movements.length > 0 ? (
                  <div className="space-y-3">
                    {movements.map((movement) => (
                      <div
                        className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm"
                        key={movement.id}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium text-slate-950">{movement.type}</span>
                          <StatusBadge variant="info">{String(movement.quantity)}</StatusBadge>
                        </div>
                        <p className="mt-1 text-slate-600">
                          {movement.quantityBefore} {"->"} {movement.quantityAfter}
                          {movement.referenceType ? ` - ${movement.referenceType}` : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    description="Initial stock and future stock changes will appear here."
                    icon={RefreshCw}
                    title="No movements yet"
                  />
                )}
              </CardContent>
            </Card>
          </div>
        ) : null}
      </section>
    </>
  );
}

function ImportProductsDialog({
  fileInputRef,
  importState,
  isOpen,
  onCancel,
  onConfirmImport,
  onFileSelection,
  onPreviewImport,
  triggerRef
}: {
  fileInputRef: RefObject<HTMLInputElement | null>;
  importState: ImportState;
  isOpen: boolean;
  onCancel: () => void;
  onConfirmImport: () => void;
  onFileSelection: (file: File | null) => void;
  onPreviewImport: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [showAllInvalidRows, setShowAllInvalidRows] = useState(false);
  const preview = importState.preview;
  const isProcessingFile = importState.phase === "processing-file";
  const isPreviewing = importState.phase === "previewing";
  const isImporting = importState.phase === "importing";
  const isBusy = isProcessingFile || isPreviewing || isImporting;
  const hasFile = Boolean(importState.file);
  const hasPreview = importState.phase === "preview-ready" && preview !== null;
  const canPreview = importState.phase === "file-ready" && hasFile && !isBusy;
  const canConfirm = Boolean(hasPreview && preview.invalidRows === 0 && !importState.error);
  const invalidRows = useMemo(() => preview?.rows.filter((row) => !row.valid) ?? [], [preview]);
  const issueEntries = useMemo(() => collectImportIssueEntries(preview), [preview]);
  const issueGroups = useMemo(() => groupImportIssueEntries(issueEntries), [issueEntries]);
  const visibleInvalidRowLimit = showAllInvalidRows ? 20 : 10;
  const visibleInvalidRows = invalidRows.slice(0, visibleInvalidRowLimit);
  const canDownloadErrorReport = issueEntries.length > 0;
  const fileStatusLabel =
    importState.phase === "preview-ready"
      ? "Preview ready"
      : importState.phase === "success"
        ? "Imported"
        : "Ready to preview";
  const dropZoneTitle = "Drop a CSV or Excel file here";
  const dropZoneDescription = "or choose a file from your computer";
  const previewSummaryText = hasPreview
    ? `${preview.validRows} valid rows, ${preview.invalidRows} invalid rows, ${preview.warnings.length} warnings.`
    : "";
  const liveAnnouncement =
    importState.phase === "processing-file"
      ? "Preparing your file. Reading and validating the selected product file."
      : importState.phase === "previewing"
        ? "Preparing preview. Reading product rows and checking validation issues."
        : importState.phase === "importing"
          ? "Importing products. Saving validated products and refreshing the catalog."
          : importState.phase === "success" && importState.summary
            ? `Import completed. ${importState.summary.importedRows} rows imported and the catalog refreshed.`
            : (importState.error ?? "");

  useEffect(() => {
    setShowAllInvalidRows(false);
  }, [preview?.fileName, preview?.totalRows, preview?.invalidRows]);

  function getImportFileType(file: File) {
    const extension = file.name.split(".").pop()?.toLowerCase();

    if (extension === "csv") {
      return "CSV";
    }

    if (extension === "xlsx") {
      return "XLSX";
    }

    return "File";
  }

  function formatFileSize(fileSize: number) {
    if (fileSize < 1024) {
      return `${fileSize} B`;
    }

    const sizeInKb = fileSize / 1024;

    if (sizeInKb < 1024) {
      return `${sizeInKb.toFixed(1)} KB`;
    }

    return `${(sizeInKb / 1024).toFixed(1)} MB`;
  }

  function handleDownloadErrorReport() {
    if (!preview || !issueEntries.length) {
      return;
    }

    const csvRows = [
      [
        "rowNumber",
        "productName",
        "sku",
        "field",
        "currentValue",
        "severity",
        "code",
        "message",
        "suggestedFix"
      ],
      ...issueEntries.map((issue) => [
        issue.rowNumber ?? "",
        issue.productName,
        issue.sku,
        issue.field,
        issue.currentValue,
        issue.severity,
        issue.code,
        issue.message,
        issue.suggestedFix
      ])
    ];

    const csv = csvRows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = `${preview.fileName.replace(/\.[^.]+$/, "") || "product-import"}-error-report.csv`;
    anchor.click();
    window.URL.revokeObjectURL(url);
  }

  function openFilePicker() {
    if (isBusy) {
      return;
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    fileInputRef.current?.click();
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();

    if (isBusy) {
      setIsDragging(false);
      return;
    }

    setIsDragging(false);
    onFileSelection(event.dataTransfer.files?.[0] ?? null);
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onCancel();
        }
      }}
    >
      <DialogContent
        aria-describedby="import-products-description"
        className="flex h-[88vh] w-[calc(100vw-40px)] max-w-[700px] flex-col overflow-hidden p-0"
        onEscapeKeyDown={(event) => {
          if (isImporting) {
            event.preventDefault();
          }
        }}
        onPointerDownOutside={(event) => {
          if (isImporting) {
            event.preventDefault();
          }
        }}
        onInteractOutside={(event) => {
          if (isImporting) {
            event.preventDefault();
          }
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          triggerRef.current?.focus();
        }}
      >
        <DialogHeader className="relative border-b border-slate-200 px-6 py-6 pr-14">
          <DialogClose asChild>
            <Button
              aria-label="Close import dialog"
              className="absolute right-4 top-4"
              disabled={isImporting}
              size="icon"
              type="button"
              variant="ghost"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </DialogClose>
          <div className="space-y-2">
            <DialogTitle>Import products</DialogTitle>
            <DialogDescription id="import-products-description" className="max-w-prose">
              Upload a product file and review it before importing.
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
          <div className="space-y-4">
            <p className="sr-only" aria-live="polite" aria-atomic="true">
              {liveAnnouncement}
            </p>

            {importState.error ? (
              <Alert variant="destructive">
                <AlertTitle>Import error</AlertTitle>
                <AlertDescription>{importState.error}</AlertDescription>
              </Alert>
            ) : null}

            <div
              aria-label="Upload product file"
              className={[
                "cursor-pointer rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/70 p-6 transition-colors hover:border-emerald-300 hover:bg-emerald-50 focus-visible:border-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200",
                isDragging ? "border-emerald-500 bg-emerald-100 ring-2 ring-emerald-100" : ""
              ].join(" ")}
              onClick={openFilePicker}
              onDragLeave={() => setIsDragging(false)}
              onDragOver={(event) => {
                event.preventDefault();
                if (!isBusy) {
                  setIsDragging(true);
                }
              }}
              onDrop={handleDrop}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openFilePicker();
                }
              }}
              role="button"
              tabIndex={0}
            >
              <div className="mx-auto flex max-w-[520px] flex-col items-center text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-emerald-200 bg-white text-emerald-700 shadow-sm">
                  <Upload className="h-5 w-5" aria-hidden="true" />
                </div>
                <p className="mt-4 text-base font-semibold text-slate-950">{dropZoneTitle}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">{dropZoneDescription}</p>
                <Button
                  className="mt-4"
                  disabled={isBusy}
                  onClick={(event) => {
                    event.stopPropagation();
                    openFilePicker();
                  }}
                  type="button"
                  variant="secondary"
                >
                  Browse files
                </Button>
                <p className="mt-4 text-xs font-medium text-slate-500">
                  CSV or XLSX, up to {MAX_IMPORT_FILE_SIZE_MB} MB
                </p>
              </div>

              <input
                accept=".csv,.xlsx"
                className="hidden"
                onChange={(event) => onFileSelection(event.target.files?.[0] ?? null)}
                ref={fileInputRef}
                type="file"
              />
            </div>

            {isProcessingFile ? (
              <LoadingState
                badge="File"
                helper="Validating the selected product file."
                label="Reading file..."
              />
            ) : hasFile && importState.file ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm font-semibold text-slate-950">
                      {importState.file.name}
                    </p>
                    <p className="text-sm text-slate-600">
                      {getImportFileType(importState.file)} ·{" "}
                      {formatFileSize(importState.file.size)}
                    </p>
                    <p className="text-sm font-medium text-emerald-700">{fileStatusLabel}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={isBusy}
                      onClick={openFilePicker}
                      type="button"
                      variant="secondary"
                    >
                      Replace
                    </Button>
                    <Button
                      disabled={isBusy}
                      onClick={() => onFileSelection(null)}
                      type="button"
                      variant="ghost"
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}

            {isPreviewing ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <LoadingState
                  badge="Preview"
                  helper="This may take a moment for larger files."
                  label="Validating rows..."
                />
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Reading rows, validating columns, and checking for duplicates.
                </p>
              </div>
            ) : hasPreview && preview ? (
              <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Preview ready</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{previewSummaryText}</p>
                  </div>

                  <Button
                    disabled={!canDownloadErrorReport}
                    onClick={handleDownloadErrorReport}
                    type="button"
                    variant="secondary"
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                    Download error report CSV
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Total rows
                    </p>
                    <p className="mt-1 text-lg font-semibold text-slate-950">{preview.totalRows}</p>
                  </div>
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                      Valid rows
                    </p>
                    <p className="mt-1 text-lg font-semibold text-emerald-900">
                      {preview.validRows}
                    </p>
                  </div>
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
                      Invalid rows
                    </p>
                    <p className="mt-1 text-lg font-semibold text-red-900">{preview.invalidRows}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Warnings
                    </p>
                    <p className="mt-1 text-lg font-semibold text-slate-950">
                      {preview.warnings.length}
                    </p>
                  </div>
                </div>

                {issueGroups.length > 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">Validation issues</p>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          Grouped by issue type so the problems are easier to scan.
                        </p>
                      </div>
                      <p className="text-xs font-medium text-slate-500">
                        {issueEntries.length} issue{issueEntries.length === 1 ? "" : "s"} across{" "}
                        {issueGroups.length} group{issueGroups.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {issueGroups.map((group) => (
                        <div
                          className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
                          key={group.code}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-950">{group.label}</p>
                              <p className="mt-1 text-xs text-slate-500">{group.code}</p>
                            </div>
                            <StatusBadge
                              variant={group.severity === "warning" ? "warning" : "error"}
                            >
                              {String(group.count)}
                            </StatusBadge>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-slate-600">
                            {group.fields.length > 0
                              ? `Fields: ${group.fields.slice(0, 3).join(", ")}${
                                  group.fields.length > 3 ? ` +${group.fields.length - 3} more` : ""
                                }`
                              : "File-level validation issue"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {invalidRows.length > 0 ? (
                  <div className="rounded-2xl border border-slate-200">
                    <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">Invalid row preview</p>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          Showing {visibleInvalidRows.length} of {invalidRows.length} invalid row
                          {invalidRows.length === 1 ? "" : "s"}. The CSV report contains all issues.
                        </p>
                      </div>
                      {invalidRows.length > 10 ? (
                        <Button
                          onClick={() => setShowAllInvalidRows((current) => !current)}
                          type="button"
                          variant="ghost"
                        >
                          {showAllInvalidRows ? "Show 10 rows" : "Show 20 rows"}
                        </Button>
                      ) : null}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full border-collapse text-left text-sm">
                        <thead className="bg-slate-100 text-slate-700">
                          <tr>
                            <th className="px-4 py-3 font-semibold">Row</th>
                            <th className="px-4 py-3 font-semibold">Product</th>
                            <th className="px-4 py-3 font-semibold">Field</th>
                            <th className="px-4 py-3 font-semibold">Current value</th>
                            <th className="px-4 py-3 font-semibold">Issue</th>
                            <th className="px-4 py-3 font-semibold">Result</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                          {visibleInvalidRows.map((row) => {
                            const rowIssues = row.errors.length > 0 ? row.errors : row.warnings;
                            const primaryIssue = rowIssues[0] ?? null;
                            const extraIssueCount = Math.max(rowIssues.length - 1, 0);

                            return (
                              <tr className="align-top" key={row.rowNumber}>
                                <td className="px-4 py-3 font-medium text-slate-950">
                                  {row.rowNumber}
                                </td>
                                <td className="px-4 py-3 text-slate-700">
                                  {row.normalizedData?.name ?? "-"}
                                </td>
                                <td className="px-4 py-3 text-slate-700">
                                  {getReadableIssueField(primaryIssue?.field) ?? "Unknown"}
                                </td>
                                <td className="px-4 py-3 text-slate-700">
                                  {getReadableIssueValue(primaryIssue, row)}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="space-y-1">
                                    <p className="font-medium text-slate-950">
                                      {primaryIssue
                                        ? getReadableIssueLabel(primaryIssue)
                                        : "Invalid row"}
                                    </p>
                                    <p className="text-xs leading-5 text-slate-600">
                                      {primaryIssue?.message ?? "Review the row values."}
                                    </p>
                                    {extraIssueCount > 0 ? (
                                      <p className="text-xs font-medium text-slate-500">
                                        +{extraIssueCount} more issue
                                        {extraIssueCount === 1 ? "" : "s"}
                                      </p>
                                    ) : null}
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="space-y-2">
                                    <StatusBadge variant="error">Invalid</StatusBadge>
                                    <p className="text-xs leading-5 text-red-700">
                                      {primaryIssue
                                        ? getSuggestedFix(primaryIssue)
                                        : "Review required."}
                                    </p>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                    <p className="text-sm font-medium text-emerald-900">No invalid rows found.</p>
                    <p className="mt-1 text-sm leading-6 text-emerald-800">
                      The file is ready to import.
                    </p>
                  </div>
                )}

                {preview.invalidRows > 0 ? (
                  <p className="text-sm text-slate-600">
                    Fix the invalid rows before importing, or download the full CSV report for the
                    complete list of issues.
                  </p>
                ) : null}
              </div>
            ) : importState.phase === "success" && importState.summary ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
                <p className="text-sm font-semibold text-emerald-950">Import complete</p>
                <p className="mt-1 text-sm leading-6 text-emerald-800">
                  Imported {importState.summary.importedRows} rows, skipped{" "}
                  {importState.summary.skippedRows}, failed {importState.summary.failedRows}, and
                  refreshed the catalog.
                </p>
              </div>
            ) : null}
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t border-slate-200 bg-slate-50/90 px-6 py-4 backdrop-blur">
          {importState.phase === "success" ? (
            <Button onClick={onCancel} type="button">
              Close
            </Button>
          ) : isImporting ? (
            <>
              <Button disabled type="button" variant="secondary">
                Cancel
              </Button>
              <Button disabled type="button">
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                Importing products...
              </Button>
            </>
          ) : isPreviewing ? (
            <>
              <Button onClick={onCancel} type="button" variant="secondary">
                Cancel
              </Button>
              <Button disabled type="button">
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                Validating rows...
              </Button>
            </>
          ) : isProcessingFile ? (
            <>
              <Button onClick={onCancel} type="button" variant="secondary">
                Cancel
              </Button>
              <Button disabled type="button">
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                Reading file...
              </Button>
            </>
          ) : hasPreview ? (
            <>
              <Button disabled={isBusy} onClick={openFilePicker} type="button" variant="secondary">
                Replace file
              </Button>
              <Button disabled={!canConfirm} onClick={onConfirmImport} type="button">
                Confirm import
              </Button>
            </>
          ) : (
            <>
              <Button onClick={onCancel} type="button" variant="secondary">
                Cancel
              </Button>
              <Button disabled={!canPreview} onClick={onPreviewImport} type="button">
                Preview import
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type ImportIssueEntry = {
  rowNumber: number | null;
  productName: string;
  sku: string;
  field: string;
  currentValue: string;
  severity: "error" | "warning";
  code: string;
  message: string;
  suggestedFix: string;
};

type ImportIssueGroup = {
  code: string;
  label: string;
  count: number;
  fields: string[];
  severity: "error" | "warning";
};

function collectImportIssueEntries(preview: ProductImportPreview | null) {
  if (!preview) {
    return [];
  }

  const entries = [
    ...preview.errors.map((issue) => buildImportIssueEntry(issue, null, "error")),
    ...preview.warnings.map((issue) => buildImportIssueEntry(issue, null, "warning")),
    ...preview.rows.flatMap((row) => [
      ...row.errors.map((issue) => buildImportIssueEntry(issue, row, "error")),
      ...row.warnings.map((issue) => buildImportIssueEntry(issue, row, "warning"))
    ])
  ];
  const seen = new Set<string>();

  return entries.filter((entry) => {
    const key = [
      entry.rowNumber ?? "",
      entry.field,
      entry.code,
      entry.message,
      entry.currentValue,
      entry.severity
    ].join("|");

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function groupImportIssueEntries(entries: ImportIssueEntry[]) {
  const groups = new Map<string, ImportIssueGroup>();

  for (const entry of entries) {
    const existing = groups.get(entry.code);

    if (!existing) {
      groups.set(entry.code, {
        code: entry.code,
        label: getReadableIssueLabel({ code: entry.code, message: entry.message }),
        count: 1,
        fields: entry.field ? [entry.field] : [],
        severity: entry.severity
      });
      continue;
    }

    existing.count += 1;
    if (entry.field && !existing.fields.includes(entry.field)) {
      existing.fields.push(entry.field);
    }
    if (entry.severity === "error") {
      existing.severity = "error";
    }
  }

  return [...groups.values()].sort((left, right) => {
    if (left.severity !== right.severity) {
      return left.severity === "error" ? -1 : 1;
    }

    return right.count - left.count;
  });
}

function buildImportIssueEntry(
  issue: ProductImportIssue,
  row: ProductImportRow | null,
  severity: "error" | "warning"
): ImportIssueEntry {
  const field = getReadableIssueField(issue.field);
  const currentValue = getReadableIssueValue(issue, row);

  return {
    rowNumber: row?.rowNumber ?? issue.rowNumber ?? null,
    productName: row?.normalizedData?.name ?? "",
    sku: row?.normalizedData?.sku ?? "",
    field,
    currentValue,
    severity,
    code: issue.code,
    message: issue.message,
    suggestedFix: getSuggestedFix(issue)
  };
}

function getReadableIssueField(field?: string) {
  if (!field) {
    return "File";
  }

  const fieldLabels: Record<string, string> = {
    barcode: "Barcode",
    category: "Category",
    categoryId: "Category",
    costPrice: "Cost price",
    description: "Description",
    initialStock: "Initial stock",
    name: "Product name",
    reorderLevel: "Reorder level",
    sellingPrice: "Selling price",
    sku: "SKU",
    status: "Status",
    targetStockLevel: "Target stock level",
    unit: "Unit"
  };

  const label = fieldLabels[field as keyof typeof fieldLabels];

  if (label) {
    return label;
  }

  return field
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (character) => character.toUpperCase());
}

function getReadableIssueValue(issue: ProductImportIssue | null, row: ProductImportRow | null) {
  if (!issue) {
    return "-";
  }

  const rawValue =
    issue.value ??
    (row?.normalizedData && issue.field
      ? getRowValueByField(row.normalizedData, issue.field)
      : null);

  if (rawValue === null || rawValue === undefined) {
    return "Empty";
  }

  const normalizedValue = String(rawValue).trim();

  return normalizedValue.length > 0 ? normalizedValue : "Empty";
}

function getRowValueByField(
  rowData: NonNullable<ProductImportRow["normalizedData"]>,
  field?: string
) {
  if (!field) {
    return null;
  }

  switch (field) {
    case "barcode":
      return rowData.barcode;
    case "category":
      return rowData.category;
    case "categoryId":
      return rowData.categoryId;
    case "costPrice":
      return rowData.costPrice;
    case "description":
      return rowData.description;
    case "initialStock":
      return rowData.initialStock;
    case "name":
      return rowData.name;
    case "reorderLevel":
      return rowData.reorderLevel;
    case "sellingPrice":
      return rowData.sellingPrice;
    case "sku":
      return rowData.sku;
    case "status":
      return rowData.status;
    case "targetStockLevel":
      return rowData.targetStockLevel;
    case "unit":
      return rowData.unit;
    default:
      return null;
  }
}

function getReadableIssueLabel(issue: Pick<ProductImportIssue, "code" | "message">) {
  const labels: Record<string, string> = {
    DUPLICATE_BARCODE_IN_FILE: "Duplicate barcode",
    DUPLICATE_HEADER: "Duplicate header",
    DUPLICATE_SKU_IN_FILE: "Duplicate SKU",
    EMPTY_IMPORT_WORKBOOK: "Empty workbook",
    EMPTY_IMPORT_WORKSHEET: "Empty worksheet",
    INVALID_IMPORT_CSV: "Invalid CSV format",
    INVALID_IMPORT_WORKBOOK: "Invalid workbook",
    INVALID_INTEGER_VALUE: "Invalid whole number",
    INVALID_MONEY_VALUE: "Invalid money value",
    INVALID_STATUS: "Invalid status",
    INVALID_UNIT: "Invalid unit",
    MISSING_REQUIRED_FIELD: "Missing required field",
    PRODUCT_IMPORT_INVALID: "Import rejected",
    UNSUPPORTED_IMPORT_FILE_MIME: "Unsupported file type",
    UNSUPPORTED_IMPORT_FILE_TYPE: "Unsupported file type"
  };

  const label = labels[issue.code as keyof typeof labels];

  if (label) {
    return label;
  }

  return issue.code
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getSuggestedFix(issue: ProductImportIssue) {
  const issueCode = issue.code;

  switch (issueCode) {
    case "MISSING_REQUIRED_FIELD":
      return "Add the missing value and try again.";
    case "INVALID_MONEY_VALUE":
      return "Use a valid amount such as 12.50.";
    case "INVALID_INTEGER_VALUE":
      return "Use a whole number with no decimals.";
    case "INVALID_STATUS":
      return "Use ACTIVE, INACTIVE, or DISCONTINUED.";
    case "INVALID_UNIT":
      return "Use one of the accepted unit values.";
    case "DUPLICATE_SKU_IN_FILE":
      return "Change the SKU so each row is unique.";
    case "DUPLICATE_BARCODE_IN_FILE":
      return "Change the barcode or leave it blank.";
    case "DUPLICATE_HEADER":
      return "Rename repeated column headers in the source file.";
    case "INVALID_IMPORT_CSV":
    case "INVALID_IMPORT_WORKBOOK":
      return "Re-save the file from Excel or export it again.";
    case "EMPTY_IMPORT_WORKBOOK":
    case "EMPTY_IMPORT_WORKSHEET":
      return "Add product rows before uploading again.";
    case "UNSUPPORTED_IMPORT_FILE_MIME":
    case "UNSUPPORTED_IMPORT_FILE_TYPE":
      return "Upload a CSV or XLSX file.";
    case "PRODUCT_IMPORT_INVALID":
      return "Review the row values and correct the file.";
    default:
      return "Review the source row and correct the value.";
  }
}

function escapeCsvCell(value: string | number | null | undefined) {
  const normalizedValue = value === null || value === undefined ? "" : String(value);

  if (!/[",\n\r]/.test(normalizedValue)) {
    return normalizedValue;
  }

  return `"${normalizedValue.replace(/"/g, '""')}"`;
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-950">{value}</p>
    </div>
  );
}
