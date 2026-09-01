import {
  Download,
  FileUp,
  Filter,
  LoaderCircle,
  PencilLine,
  Plus,
  Search,
  ShieldCheck,
  Upload,
  X
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
  type RefObject
} from "react";

import { ProductImageUploadPanel } from "@/components/catalog/ProductImageUploadPanel";
import { useAuth } from "@/context/AuthContext";
import { AppPagination } from "@/components/shared/AppPagination";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useToast } from "@/components/shared/ToastProvider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Tooltip } from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import {
  downloadProductImportTemplate,
  createProduct,
  createCategory,
  fetchCategories,
  fetchProductById,
  fetchProducts,
  importProducts,
  previewProductImport,
  updateProduct,
  updateProductStatus,
  type ProductImportIssue,
  type PaginationMeta,
  type ProductImportPreview,
  type ProductCategorySummary,
  type ProductImportRow,
  type ProductImportSummary,
  type ProductRecord
} from "@/services/catalogApi";
import { rejectProductImage } from "@/services/productImageApi";
import { formatFileSize, getImportFileType } from "@/utils/importFormatting";
import { waitForMinimumDuration } from "@/utils/timing";
import {
  getAvailabilityAction,
  getProductStatusLabel,
  getProductStatusVariant
} from "@/utils/productAvailability";

const MAX_IMPORT_FILE_SIZE_MB = 5;
const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
const SEARCH_DEBOUNCE_MS = 300;
const CATALOG_SEARCH_MINIMUM_MS = 400;
const CATALOG_FILTER_MINIMUM_MS = 450;
const CATALOG_PAGINATION_MINIMUM_MS = 400;
const CATALOG_PAGE_SIZE_MINIMUM_MS = 400;
const CATALOG_REFRESH_MINIMUM_MS = 350;
const TEMPLATE_DOWNLOAD_MINIMUM_MS = 600;
const PREVIEW_LOADING_MINIMUM_MS = 500;
const IMPORT_LOADING_MINIMUM_MS = 700;
const CATEGORY_CREATE_MINIMUM_MS = 450;
const currencyFormatter = new Intl.NumberFormat("en-PH", {
  currency: "PHP",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  style: "currency"
});

type CatalogLoadingReason =
  | "initial"
  | "search"
  | "filter"
  | "pagination"
  | "page-size"
  | "refresh"
  | null;

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
  const { user } = useAuth();
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [categories, setCategories] = useState<ProductCategorySummary[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [pendingAvailabilityProductIds, setPendingAvailabilityProductIds] = useState<Set<string>>(
    () => new Set()
  );
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [qualityFilter, setQualityFilter] = useState<"ALL" | ProductRecord["dataQualityStatus"]>(
    "ALL"
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [paginationMeta, setPaginationMeta] = useState<PaginationMeta | null>(null);
  const [catalogLoadingReason, setCatalogLoadingReason] = useState<CatalogLoadingReason>("initial");
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
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
  const catalogRequestIdRef = useRef(0);
  const catalogAbortControllerRef = useRef<AbortController | null>(null);
  const availabilityRequestIdsRef = useRef(new Map<string, number>());
  const currentCatalogViewRef = useRef({
    debouncedSearch: "",
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    qualityFilter: "ALL" as typeof qualityFilter,
    statusFilter: "ALL" as typeof statusFilter
  });
  const previousCatalogParamsRef = useRef<{
    debouncedSearch: string;
    page: number;
    pageSize: number;
    qualityFilter: typeof qualityFilter;
    statusFilter: typeof statusFilter;
    initialized: boolean;
  }>({
    debouncedSearch: "",
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    qualityFilter: "ALL",
    statusFilter: "ALL",
    initialized: false
  });
  const { pushToast } = useToast();
  const isOwner = user?.role === "OWNER";

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) ?? null,
    [products, selectedProductId]
  );

  useEffect(() => {
    let active = true;

    async function loadCategories() {
      setCategoriesLoading(true);

      try {
        const result = await fetchCategories();

        if (!active) {
          return;
        }

        setCategories(result);
      } catch {
        if (!active) {
          return;
        }

        setCategories([]);
      } finally {
        if (active) {
          setCategoriesLoading(false);
        }
      }
    }

    void loadCategories();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setPage(1);
      setDebouncedSearch(searchInput);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [searchInput]);

  useEffect(() => {
    currentCatalogViewRef.current = {
      debouncedSearch,
      page,
      pageSize,
      qualityFilter,
      statusFilter
    };
  }, [debouncedSearch, page, pageSize, qualityFilter, statusFilter]);

  useEffect(() => {
    return () => {
      catalogAbortControllerRef.current?.abort();
    };
  }, []);

  async function loadCatalog(options: {
    reason: Exclude<CatalogLoadingReason, null>;
    page: number;
    pageSize: number;
    quality: typeof qualityFilter;
    search: string;
    status: typeof statusFilter;
  }) {
    const requestId = ++catalogRequestIdRef.current;
    catalogAbortControllerRef.current?.abort();

    const controller = new AbortController();
    catalogAbortControllerRef.current = controller;
    setCatalogLoadingReason(options.reason);
    setCatalogError(null);

    try {
      const response = await waitForMinimumDuration(
        fetchProducts(
          {
            page: options.page,
            pageSize: options.pageSize,
            dataQualityStatus: options.quality === "ALL" ? undefined : options.quality,
            search: options.search.trim() || undefined,
            status: options.status === "ALL" ? undefined : options.status
          },
          {
            signal: controller.signal
          }
        ),
        getCatalogMinimumDuration(options.reason)
      );

      if (requestId !== catalogRequestIdRef.current) {
        return;
      }

      if (!response.meta) {
        throw new Error("Product pagination metadata is unavailable.");
      }

      if (response.meta.totalPages > 0 && options.page > response.meta.totalPages) {
        setPage(response.meta.totalPages);
        return;
      }

      setProducts(response.items);
      setPaginationMeta(response.meta);
    } catch (error) {
      if (requestId !== catalogRequestIdRef.current) {
        return;
      }

      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setCatalogError(
        error instanceof Error ? error.message : getCatalogErrorMessage(options.reason)
      );
    } finally {
      if (requestId === catalogRequestIdRef.current) {
        setCatalogLoadingReason(null);
      }
    }
  }

  useEffect(() => {
    const previous = previousCatalogParamsRef.current;
    let reason: Exclude<CatalogLoadingReason, null> = previous.initialized ? "refresh" : "initial";

    if (previous.initialized) {
      if (debouncedSearch !== previous.debouncedSearch) {
        reason = "search";
      } else if (
        statusFilter !== previous.statusFilter ||
        qualityFilter !== previous.qualityFilter
      ) {
        reason = "filter";
      } else if (pageSize !== previous.pageSize) {
        reason = "page-size";
      } else if (page !== previous.page) {
        reason = "pagination";
      }
    }

    previousCatalogParamsRef.current = {
      debouncedSearch,
      page,
      pageSize,
      qualityFilter,
      statusFilter,
      initialized: true
    };

    void loadCatalog({
      reason,
      page,
      pageSize,
      quality: qualityFilter,
      search: debouncedSearch,
      status: statusFilter
    });
  }, [debouncedSearch, page, pageSize, qualityFilter, statusFilter]);

  useEffect(() => {
    if (!selectedProductId) {
      return;
    }

    const selectedProductStillVisible = products.some(
      (product) => product.id === selectedProductId
    );

    if (!selectedProductStillVisible) {
      setSelectedProductId(null);
    }
  }, [products, selectedProductId]);

  async function refreshCatalog() {
    await loadCatalog({
      reason: "refresh",
      page,
      pageSize,
      quality: qualityFilter,
      search: debouncedSearch,
      status: statusFilter
    });
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
    if (isDownloadingTemplate) {
      return;
    }

    setIsDownloadingTemplate(true);

    try {
      const csv = await waitForMinimumDuration(
        downloadProductImportTemplate(),
        TEMPLATE_DOWNLOAD_MINIMUM_MS
      );
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = url;
      anchor.download = "product-import-template.csv";
      anchor.click();
      window.URL.revokeObjectURL(url);
      pushToast({
        message: "The product import template is ready.",
        title: "Template downloaded",
        variant: "success"
      });
    } catch {
      pushToast({
        message: "The product import template could not be downloaded. Please try again.",
        title: "Download failed",
        variant: "error"
      });
    } finally {
      setIsDownloadingTemplate(false);
    }
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
      importState.preview.invalidRows > 0 ||
      importState.preview.errors.length > 0 ||
      Boolean(importState.error)
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

  function getAvailabilityFailureMessage(response: {
    error?: { code?: string };
    message: string;
    success: boolean;
  }) {
    if (response.success) {
      return response.message;
    }

    switch (response.error?.code) {
      case "PRODUCT_NOT_FOUND":
        return "Product was not found.";
      case "INSUFFICIENT_ROLE":
        return "Only an owner can change product availability.";
      case "INVALID_PRODUCT_STATUS_TRANSITION":
        return "The server did not confirm the product status change.";
      case "INVALID_PRODUCT_AVAILABILITY_REQUEST":
        return "Unable to update product availability.";
      default:
        return response.message || "The server did not confirm the update.";
    }
  }

  function applyProductToCatalog(updatedProduct: ProductRecord) {
    const {
      qualityFilter: visibleQualityFilter,
      statusFilter: visibleStatusFilter,
      page: visiblePage
    } = currentCatalogViewRef.current;
    const statusMatchesFilter =
      visibleStatusFilter === "ALL" || updatedProduct.status === visibleStatusFilter;
    const qualityMatchesFilter =
      visibleQualityFilter === "ALL" || updatedProduct.dataQualityStatus === visibleQualityFilter;
    const productMatchesFilters = statusMatchesFilter && qualityMatchesFilter;

    setProducts((current) => {
      const index = current.findIndex((product) => product.id === updatedProduct.id);

      if (index === -1) {
        return current;
      }

      if (!productMatchesFilters) {
        return current.filter((product) => product.id !== updatedProduct.id);
      }

      const next = [...current];
      next[index] = updatedProduct;
      return next;
    });

    setPaginationMeta((current) => {
      if (!current) {
        return current;
      }

      if (productMatchesFilters) {
        return current;
      }

      const nextTotalItems = Math.max(0, current.totalItems - 1);
      const nextTotalPages = Math.max(1, Math.ceil(nextTotalItems / current.pageSize));
      const nextPage = Math.min(visiblePage, nextTotalPages);

      if (nextPage !== current.page) {
        setPage(nextPage);
      }

      return {
        ...current,
        page: nextPage,
        totalItems: nextTotalItems,
        totalPages: nextTotalPages
      };
    });
  }

  async function refreshProductFromServer(productId: string) {
    try {
      const updatedProduct = await fetchProductById(productId);
      applyProductToCatalog(updatedProduct);
      pushToast({
        message: "The latest product status has been loaded. Try the action again.",
        title: "Product status refreshed",
        variant: "success"
      });
    } catch {
      pushToast({
        message: "The latest server status could not be loaded.",
        title: "Product status refreshed",
        variant: "error"
      });
    }
  }

  async function handleAvailabilityToggle(product: ProductRecord) {
    const action = getAvailabilityAction(product.status);

    if (!action || availabilityRequestIdsRef.current.has(product.id)) {
      return;
    }

    const requestId = (availabilityRequestIdsRef.current.get(product.id) ?? 0) + 1;
    availabilityRequestIdsRef.current.set(product.id, requestId);
    setPendingAvailabilityProductIds((current) => {
      const next = new Set(current);
      next.add(product.id);
      return next;
    });

    try {
      const response = await waitForMinimumDuration(
        updateProductStatus(product.id, action.nextStatus),
        500
      );

      if (availabilityRequestIdsRef.current.get(product.id) !== requestId) {
        return;
      }

      if (!response.success) {
        if (response.error?.code === "INVALID_PRODUCT_STATUS_TRANSITION") {
          await refreshProductFromServer(product.id);
          return;
        }

        pushToast({
          message: getAvailabilityFailureMessage(response),
          title: "Availability update failed",
          variant: "error"
        });
        return;
      }

      if (!response.data) {
        pushToast({
          message: "The server did not confirm the product status change.",
          title: "Availability update failed",
          variant: "error"
        });
        return;
      }

      const updatedProduct = response.data;
      applyProductToCatalog(updatedProduct);

      pushToast({
        message: action.successMessage,
        title: action.successTitle,
        variant: "success"
      });
    } catch (error) {
      if (availabilityRequestIdsRef.current.get(product.id) !== requestId) {
        return;
      }

      pushToast({
        message: error instanceof Error ? error.message : "Unable to update product availability.",
        title: "Availability update failed",
        variant: "error"
      });
    } finally {
      if (availabilityRequestIdsRef.current.get(product.id) === requestId) {
        availabilityRequestIdsRef.current.delete(product.id);
        setPendingAvailabilityProductIds((current) => {
          const next = new Set(current);
          next.delete(product.id);
          return next;
        });
      }
    }
  }

  function toggleSelection(productId: string) {
    setSelectedProductId((current) => (current === productId ? null : productId));
  }

  function clearSelection() {
    setSelectedProductId(null);
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

  function handleQualityFilterChange(value: typeof qualityFilter) {
    setQualityFilter(value);
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

  const isCatalogLoading = catalogLoadingReason !== null;
  const hasCatalogRows = products.length > 0;
  const showCatalogSkeleton = isCatalogLoading && !hasCatalogRows;
  const showCatalogOverlay = isCatalogLoading && hasCatalogRows;
  const searchIsLoading = catalogLoadingReason === "search";
  const filterIsLoading = catalogLoadingReason === "filter";
  const catalogLoadingLabel = getCatalogLoadingLabel(catalogLoadingReason, page);

  return (
    <>
      <CreateProductDialog
        categories={categories}
        categoryLoading={categoriesLoading}
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onCategoryCreated={(category) => {
          setCategories((current) => {
            const next = current.filter((entry) => entry.id !== category.id);
            next.push(category);
            next.sort((left, right) => left.name.localeCompare(right.name));
            return next;
          });
        }}
        onCreated={() => void refreshCatalog()}
        isOwner={isOwner}
      />

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
            <Button
              disabled={isDownloadingTemplate}
              variant="secondary"
              onClick={handleTemplateDownload}
              type="button"
            >
              {isDownloadingTemplate ? (
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="h-4 w-4" aria-hidden="true" />
              )}
              {isDownloadingTemplate ? "Downloading..." : "Template"}
            </Button>
            <Button onClick={() => setIsCreateDialogOpen(true)} type="button" variant="secondary">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add Product
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
          <CardContent className="px-4 pb-4 pt-2 lg:px-5">
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_180px]">
                <label className="relative flex h-11 items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-3">
                  <Search className="h-4 w-4 text-slate-500" aria-hidden="true" />
                  <input
                    aria-busy={searchIsLoading}
                    className={[
                      "w-full bg-transparent text-sm outline-none",
                      searchIsLoading ? "pr-8" : ""
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    placeholder="Search name, SKU, barcode"
                    value={searchInput}
                    onChange={(event) => handleSearchChange(event.target.value)}
                  />
                  {searchIsLoading ? (
                    <LoaderCircle className="absolute right-3 h-4 w-4 animate-spin text-emerald-700" />
                  ) : null}
                </label>
                <label className="relative flex h-11 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm">
                  <Filter className="h-4 w-4 text-slate-500" aria-hidden="true" />
                  <select
                    aria-busy={filterIsLoading}
                    className={["w-full bg-transparent outline-none", filterIsLoading ? "pr-6" : ""]
                      .filter(Boolean)
                      .join(" ")}
                    value={statusFilter}
                    onChange={(event) =>
                      handleStatusFilterChange(event.target.value as typeof statusFilter)
                    }
                  >
                    <option value="ALL">All statuses</option>
                    <option value="ACTIVE">Available</option>
                    <option value="INACTIVE">Unavailable</option>
                  </select>
                  {filterIsLoading ? (
                    <LoaderCircle className="pointer-events-none absolute right-3 h-4 w-4 animate-spin text-emerald-700" />
                  ) : null}
                </label>
                <label className="relative flex h-11 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm">
                  <Filter className="h-4 w-4 text-slate-500" aria-hidden="true" />
                  <select
                    aria-busy={filterIsLoading}
                    aria-label="Catalog quality"
                    className={["w-full bg-transparent outline-none", filterIsLoading ? "pr-6" : ""]
                      .filter(Boolean)
                      .join(" ")}
                    value={qualityFilter}
                    onChange={(event) =>
                      handleQualityFilterChange(event.target.value as typeof qualityFilter)
                    }
                  >
                    <option value="ALL">All quality</option>
                    <option value="NEEDS_REVIEW">Needs review</option>
                    <option value="APPROVED">Approved</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                  {filterIsLoading ? (
                    <LoaderCircle className="pointer-events-none absolute right-3 h-4 w-4 animate-spin text-emerald-700" />
                  ) : null}
                </label>
              </div>
              {catalogError ? (
                <div
                  aria-live="polite"
                  className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p>{catalogError}</p>
                    <Button
                      disabled={isCatalogLoading}
                      onClick={() => {
                        void refreshCatalog();
                      }}
                      type="button"
                      variant="secondary"
                    >
                      Retry
                    </Button>
                  </div>
                </div>
              ) : null}

              {paginationMeta?.totalItems === 0 && !isCatalogLoading && !catalogError ? (
                <EmptyState
                  description="Import a CSV or Excel file to populate the catalog."
                  icon={ShieldCheck}
                  title="No products yet"
                />
              ) : null}

              <div aria-busy={isCatalogLoading} aria-live="polite" className="relative">
                {showCatalogSkeleton ? (
                  <CatalogTableSkeleton rowCount={pageSize} />
                ) : hasCatalogRows ? (
                  <div className={showCatalogOverlay ? "pointer-events-none opacity-70" : ""}>
                    <div className="overflow-hidden">
                      <table className="w-full table-fixed border-collapse text-left text-sm">
                        <thead className="bg-slate-100 text-slate-700">
                          <tr>
                            <th className="w-[48%] px-2 py-2.5 lg:w-[32%] xl:w-[28%]">Product</th>
                            <th className="hidden w-[12%] px-2 py-2.5 lg:table-cell">SKU</th>
                            <th className="hidden w-[14%] px-2 py-2.5 xl:table-cell">Barcode</th>
                            <th className="hidden w-[13%] px-2 py-2.5 lg:table-cell">Category</th>
                            <th className="w-[12%] px-2 py-2.5 lg:w-[11%]">Status</th>
                            <th className="hidden w-[10%] px-2 py-2.5 lg:table-cell">
                              Selling price
                            </th>
                            <th className="w-[15rem] px-2 py-2.5 text-center lg:w-[15rem]">
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {products.map((product) => {
                            const isSelected = selectedProductId === product.id;
                            const isStatusPending = pendingAvailabilityProductIds.has(product.id);
                            const availabilityAction = getAvailabilityAction(product.status);

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
                                <td className="px-2 py-2 align-top lg:py-2.5">
                                  <div className="font-medium text-slate-950 xl:truncate">
                                    {product.name}
                                  </div>
                                  <div className="mt-0.5 max-h-10 overflow-hidden text-xs leading-5 text-slate-500">
                                    {product.description ?? "No description"}
                                  </div>
                                  <div className="mt-1.5">
                                    <StatusBadge
                                      variant={
                                        product.dataQualityStatus === "APPROVED"
                                          ? "success"
                                          : product.dataQualityStatus === "REJECTED"
                                            ? "error"
                                            : "warning"
                                      }
                                    >
                                      {product.dataQualityStatus === "APPROVED"
                                        ? product.isStorefrontVisible
                                          ? "Approved · Storefront"
                                          : "Approved · Internal"
                                        : product.dataQualityStatus === "REJECTED"
                                          ? "Rejected"
                                          : "Needs review"}
                                    </StatusBadge>
                                  </div>
                                  <div className="mt-2 grid gap-1 text-xs text-slate-500 lg:hidden">
                                    <div className="flex items-start justify-between gap-3">
                                      <span className="font-medium text-slate-700">SKU</span>
                                      <span className="text-right break-words text-slate-600">
                                        {product.sku}
                                      </span>
                                    </div>
                                    <div className="flex items-start justify-between gap-3">
                                      <span className="font-medium text-slate-700">Barcode</span>
                                      <span className="text-right break-words text-slate-600">
                                        {product.barcode ?? "-"}
                                      </span>
                                    </div>
                                    <div className="flex items-start justify-between gap-3">
                                      <span className="font-medium text-slate-700">Category</span>
                                      <span className="text-right break-words text-slate-600">
                                        {product.category.name}
                                      </span>
                                    </div>
                                    <div className="flex items-start justify-between gap-3">
                                      <span className="font-medium text-slate-700">
                                        Selling price
                                      </span>
                                      <span className="text-right tabular-nums text-slate-600">
                                        PHP {Number(product.sellingPrice).toFixed(2)}
                                      </span>
                                    </div>
                                  </div>
                                </td>
                                <td className="hidden px-2 py-2 align-top break-words lg:table-cell">
                                  {product.sku}
                                </td>
                                <td className="hidden px-2 py-2 align-top break-words xl:table-cell">
                                  {product.barcode ?? "-"}
                                </td>
                                <td className="hidden px-2 py-2 align-top break-words lg:table-cell">
                                  {product.category.name}
                                </td>
                                <td className="px-2 py-2 align-top lg:py-2.5">
                                  <StatusBadge variant={getProductStatusVariant(product.status)}>
                                    {getProductStatusLabel(product.status)}
                                  </StatusBadge>
                                </td>
                                <td className="hidden px-2 py-2 align-top tabular-nums lg:table-cell">
                                  PHP {Number(product.sellingPrice).toFixed(2)}
                                </td>
                                <td className="px-2 py-2 align-top text-center lg:py-2.5">
                                  <div className="mx-auto inline-flex max-w-full flex-row flex-nowrap items-center justify-center gap-2 whitespace-nowrap">
                                    <Tooltip content="Edit product">
                                      <Button
                                        size="icon"
                                        type="button"
                                        variant="secondary"
                                        className="h-9 w-9 shrink-0"
                                        disabled={isStatusPending}
                                        aria-label={`Edit ${product.name}`}
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          setSelectedProductId(product.id);
                                        }}
                                      >
                                        <PencilLine className="h-4 w-4" aria-hidden="true" />
                                      </Button>
                                    </Tooltip>
                                    {availabilityAction ? (
                                      <Tooltip content={availabilityAction.tooltip}>
                                        <Button
                                          aria-busy={isStatusPending}
                                          aria-label={`Set ${product.name} to ${
                                            availabilityAction.nextStatus === "ACTIVE"
                                              ? "available"
                                              : "unavailable"
                                          }`}
                                          className="h-9 shrink-0 min-w-[11rem] justify-center px-3 whitespace-nowrap"
                                          disabled={isStatusPending}
                                          size="sm"
                                          type="button"
                                          variant="secondary"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            void handleAvailabilityToggle(product);
                                          }}
                                        >
                                          {isStatusPending ? (
                                            <LoaderCircle
                                              className="h-4 w-4 animate-spin"
                                              aria-hidden="true"
                                            />
                                          ) : null}
                                          {isStatusPending
                                            ? availabilityAction.compactLoadingLabel
                                            : availabilityAction.buttonLabel}
                                        </Button>
                                      </Tooltip>
                                    ) : null}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}

                {showCatalogOverlay ? (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/55 px-4 py-6 backdrop-blur-[1px]">
                    <div className="w-full max-w-md">
                      <LoadingState
                        badge="Catalog"
                        helper="Updating the table while keeping the current results visible."
                        label={catalogLoadingLabel}
                      />
                    </div>
                  </div>
                ) : null}
              </div>

              {paginationMeta ? (
                <AppPagination
                  isLoading={isCatalogLoading}
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

        <ProductDetailsDialog
          categories={categories}
          categoryLoading={categoriesLoading}
          isOpen={Boolean(selectedProduct)}
          onClose={clearSelection}
          onSaved={() => void refreshCatalog()}
          product={selectedProduct}
        />
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
  const preview = importState.preview;
  const isProcessingFile = importState.phase === "processing-file";
  const isPreviewing = importState.phase === "previewing";
  const isImporting = importState.phase === "importing";
  const isBusy = isProcessingFile || isPreviewing || isImporting;
  const hasFile = Boolean(importState.file);
  const hasPreview = importState.phase === "preview-ready" && preview !== null;
  const canPreview = importState.phase === "file-ready" && hasFile && !isBusy;
  const confirmBlockReason =
    !hasPreview || !preview
      ? "Preview the file first."
      : preview.errors.length > 0
        ? "Resolve blocking preview errors before importing."
        : preview.invalidRows > 0
          ? "Fix invalid rows before importing."
          : importState.error
            ? "Resolve the current import error before importing."
            : null;
  const canConfirm = Boolean(
    hasPreview && preview.invalidRows === 0 && preview.errors.length === 0 && !importState.error
  );
  const invalidRows = useMemo(() => preview?.rows.filter((row) => !row.valid) ?? [], [preview]);
  const issueEntries = useMemo(() => collectImportIssueEntries(preview), [preview]);
  const visibleInvalidRows = invalidRows.slice(0, 10);
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
        className="flex max-h-[88vh] w-[calc(100vw-40px)] max-w-[700px] flex-col overflow-hidden p-0"
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

        <div
          className={[
            "px-6 py-5",
            hasPreview && preview ? "max-h-[calc(88vh-10rem)] overflow-y-auto" : ""
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <div className="space-y-4">
            <p className="sr-only" aria-live="polite" aria-atomic="true">
              {liveAnnouncement}
            </p>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <p className="font-medium text-slate-900">Template tips</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 leading-6">
                <li>Download the template first, then fill in at least one product row.</li>
                <li>Keep the headers unchanged.</li>
                <li>Use unique SKU and barcode values.</li>
                <li>Barcode is optional.</li>
                <li>Categories and units must use supported values.</li>
              </ul>
            </div>

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

                {!canConfirm && confirmBlockReason ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    {confirmBlockReason}
                  </div>
                ) : null}

                {invalidRows.length > 0 ? (
                  <div className="space-y-3 rounded-2xl border border-slate-200">
                    <div className="flex flex-col gap-1 border-b border-slate-200 bg-slate-50 px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-600">
                          <span className="font-semibold text-slate-950">
                            {preview.invalidRows}
                          </span>{" "}
                          invalid rows · {issueEntries.length} issues found
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          Showing the first 10 invalid rows
                        </p>
                      </div>
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
                                    {extraIssueCount > 0 ? (
                                      <p className="text-xs font-medium text-slate-500">
                                        +{extraIssueCount} more issue
                                        {extraIssueCount === 1 ? "" : "s"}
                                      </p>
                                    ) : null}
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <StatusBadge variant="error">Invalid</StatusBadge>
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

        <DialogFooter className="sticky bottom-0 shrink-0 border-t border-slate-200 bg-slate-50/90 px-6 py-4 backdrop-blur">
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
    imageUrl: "Product image",
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
    case "imageUrl":
      return rowData.imageUrl;
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
    POSSIBLE_DUPLICATE_IDENTITY: "Possible catalog duplicate",
    POSSIBLE_DUPLICATE_IDENTITY_IN_FILE: "Possible duplicate in file",
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
      return "Use ACTIVE or INACTIVE.";
    case "INVALID_UNIT":
      return "Use one of the accepted unit values.";
    case "DUPLICATE_SKU_IN_FILE":
      return "Change the SKU so each row is unique.";
    case "DUPLICATE_BARCODE_IN_FILE":
      return "Change the barcode or leave it blank.";
    case "DUPLICATE_HEADER":
      return "Rename repeated column headers in the source file.";
    case "POSSIBLE_DUPLICATE_IDENTITY":
    case "POSSIBLE_DUPLICATE_IDENTITY_IN_FILE":
      return "Compare brand, variant, size, SKU, and barcode before approving either record.";
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

function getCatalogMinimumDuration(reason: Exclude<CatalogLoadingReason, null>) {
  switch (reason) {
    case "search":
      return CATALOG_SEARCH_MINIMUM_MS;
    case "filter":
      return CATALOG_FILTER_MINIMUM_MS;
    case "pagination":
      return CATALOG_PAGINATION_MINIMUM_MS;
    case "page-size":
      return CATALOG_PAGE_SIZE_MINIMUM_MS;
    case "refresh":
      return CATALOG_REFRESH_MINIMUM_MS;
    case "initial":
      return CATALOG_SEARCH_MINIMUM_MS;
  }
}

function getCatalogErrorMessage(reason: Exclude<CatalogLoadingReason, null>) {
  switch (reason) {
    case "search":
      return "Unable to search products.";
    case "filter":
      return "Unable to apply the selected filter.";
    case "pagination":
      return "Unable to load the requested page.";
    case "page-size":
      return "Unable to update the page size.";
    case "refresh":
      return "Unable to refresh products.";
    case "initial":
      return "Unable to load products.";
  }
}

function getCatalogLoadingLabel(reason: CatalogLoadingReason, page: number) {
  switch (reason) {
    case "search":
      return "Searching products...";
    case "filter":
      return "Applying status filter...";
    case "pagination":
      return `Loading page ${page}...`;
    case "page-size":
      return "Updating page size...";
    case "refresh":
      return "Updating results...";
    case "initial":
      return "Loading products...";
    default:
      return "Updating...";
  }
}

function CatalogTableSkeleton({ rowCount }: { rowCount: number }) {
  const skeletonRows = Array.from(
    { length: Math.min(Math.max(rowCount, 1), 8) },
    (_, index) => index
  );

  return (
    <div className="relative">
      <div className="overflow-visible">
        <table className="w-full table-fixed border-collapse text-left text-sm">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="w-[48%] px-2 py-2.5 lg:w-[32%] xl:w-[28%]">Product</th>
              <th className="hidden w-[12%] px-2 py-2.5 lg:table-cell">SKU</th>
              <th className="hidden w-[14%] px-2 py-2.5 xl:table-cell">Barcode</th>
              <th className="hidden w-[13%] px-2 py-2.5 lg:table-cell">Category</th>
              <th className="w-[12%] px-2 py-2.5 lg:w-[11%]">Status</th>
              <th className="hidden w-[10%] px-2 py-2.5 lg:table-cell">Selling price</th>
              <th className="w-[15rem] px-2 py-2.5 text-center lg:w-[15rem]">Action</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {skeletonRows.map((rowIndex) => (
              <tr className="border-t border-slate-200" key={rowIndex}>
                <td className="px-2 py-3 lg:py-3">
                  <div className="space-y-2">
                    <div className="loading-shimmer h-4 w-44 rounded-full bg-slate-100" />
                    <div className="loading-shimmer h-3 w-56 rounded-full bg-slate-100" />
                    <div className="grid gap-1 pt-1 lg:hidden">
                      <div className="loading-shimmer h-3 w-full rounded-full bg-slate-100" />
                      <div className="loading-shimmer h-3 w-5/6 rounded-full bg-slate-100" />
                      <div className="loading-shimmer h-3 w-11/12 rounded-full bg-slate-100" />
                    </div>
                  </div>
                </td>
                <td className="hidden px-2 py-3 lg:table-cell">
                  <div className="loading-shimmer h-4 w-24 rounded-full bg-slate-100" />
                </td>
                <td className="hidden px-2 py-3 xl:table-cell">
                  <div className="loading-shimmer h-4 w-28 rounded-full bg-slate-100" />
                </td>
                <td className="hidden px-2 py-3 lg:table-cell">
                  <div className="loading-shimmer h-4 w-32 rounded-full bg-slate-100" />
                </td>
                <td className="px-2 py-3 lg:py-3">
                  <div className="loading-shimmer h-6 w-20 rounded-full bg-slate-100" />
                </td>
                <td className="hidden px-2 py-3 lg:table-cell">
                  <div className="loading-shimmer h-4 w-20 rounded-full bg-slate-100" />
                </td>
                <td className="px-2 py-3 text-center lg:py-3">
                  <div className="mx-auto inline-flex max-w-full flex-row flex-nowrap items-center justify-center gap-2 whitespace-nowrap">
                    <div className="loading-shimmer h-9 w-9 shrink-0 rounded-md bg-slate-100" />
                    <div className="loading-shimmer h-9 min-w-[11rem] rounded-md bg-slate-100" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-[1px]">
        <div className="max-w-md px-4">
          <LoadingState
            badge="Catalog"
            helper="Preparing the table without collapsing the layout."
            label="Loading products..."
          />
        </div>
      </div>
    </div>
  );
}

function CreateProductDialog({
  categories,
  categoryLoading,
  isOwner,
  isOpen,
  onClose,
  onCategoryCreated,
  onCreated
}: {
  categories: ProductCategorySummary[];
  categoryLoading: boolean;
  isOwner: boolean;
  isOpen: boolean;
  onClose: () => void;
  onCategoryCreated: (category: ProductCategorySummary) => void;
  onCreated: () => void;
}) {
  const { pushToast } = useToast();
  const [form, setForm] = useState({
    barcode: "",
    brand: "",
    categoryId: "",
    costPrice: "",
    description: "",
    name: "",
    dataQualityStatus: "NEEDS_REVIEW" as ProductRecord["dataQualityStatus"],
    isStorefrontVisible: false,
    reorderLevel: "0",
    sellingPrice: "",
    sku: "",
    status: "ACTIVE" as ProductRecord["status"],
    targetStockLevel: "0",
    unit: "PIECE" as ProductRecord["unit"],
    variant: "",
    sizeValue: "",
    sizeUnit: "" as NonNullable<ProductRecord["sizeUnit"]> | ""
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [createdProductId, setCreatedProductId] = useState<string | null>(null);
  const [hasSelectedImage, setHasSelectedImage] = useState(false);
  const [imageSession, setImageSession] = useState(0);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState({
    description: "",
    name: ""
  });
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [creatingCategory, setCreatingCategory] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setCreatedProductId(null);
    setHasSelectedImage(false);
    setImageSession((current) => current + 1);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setError(null);
    setForm((current) => ({
      ...current,
      categoryId: current.categoryId || categories[0]?.id || ""
    }));
  }, [categories, isOpen]);

  useEffect(() => {
    if (!isCategoryDialogOpen) {
      return;
    }

    setCategoryError(null);
  }, [isCategoryDialogOpen]);

  async function handleCreateCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (creatingCategory || createdProductId) {
      return;
    }

    const name = categoryForm.name.trim();

    if (!name) {
      setCategoryError("Category name is required.");
      return;
    }

    setCreatingCategory(true);
    setCategoryError(null);

    try {
      const response = await waitForMinimumDuration(
        createCategory({
          description: categoryForm.description.trim() || null,
          name
        }),
        CATEGORY_CREATE_MINIMUM_MS
      );

      if (!response.success || !response.data) {
        setCategoryError(response.message || "Unable to create category.");
        return;
      }

      const createdCategory = response.data;
      onCategoryCreated(createdCategory);
      setForm((current) => ({ ...current, categoryId: createdCategory.id }));
      setCategoryForm({
        description: "",
        name: ""
      });
      setIsCategoryDialogOpen(false);
      pushToast({
        message: "The new category is ready to use.",
        title: "Category created",
        variant: "success"
      });
    } catch (creationError) {
      setCategoryError(
        creationError instanceof Error ? creationError.message : "Unable to create category."
      );
    } finally {
      setCreatingCategory(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving || createdProductId) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await createProduct({
        barcode: form.barcode.trim() || null,
        brand: form.brand.trim() || null,
        categoryId: form.categoryId,
        costPrice: form.costPrice.trim(),
        description: form.description.trim() || null,
        name: form.name.trim(),
        reorderLevel: Number(form.reorderLevel),
        sellingPrice: form.sellingPrice.trim(),
        sizeUnit: form.sizeUnit || undefined,
        sizeValue: form.sizeValue ? Number(form.sizeValue) : undefined,
        sku: form.sku.trim(),
        status: form.status,
        targetStockLevel: Number(form.targetStockLevel),
        unit: form.unit,
        variant: form.variant.trim() || null
      });

      if (!response.success || !response.data) {
        setError(response.message || "Product creation failed.");
        return;
      }

      onCreated();

      if (hasSelectedImage) {
        setCreatedProductId(response.data.id);
        pushToast({
          message: "Product created; image needs attention while optimization finishes.",
          title: "Product created",
          variant: "success"
        });
        return;
      }

      pushToast({
        message: `${response.data.name} was created successfully.`,
        title: "Product created",
        variant: "success"
      });
      onClose();
    } catch {
      setError("The product creation service is unavailable.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
    >
      <DialogContent className="flex max-h-[90vh] w-[calc(100vw-32px)] max-w-[760px] flex-col overflow-hidden p-0">
        <DialogHeader className="border-b border-slate-200 px-6 py-5">
          <DialogTitle>Add Product</DialogTitle>
          <DialogDescription>Create a catalog record for the product.</DialogDescription>
          <p className="text-xs leading-5 text-slate-500">
            New records start hidden for catalog review. Stock is managed separately in Inventory.
          </p>
        </DialogHeader>

        <form
          className="flex-1 overflow-y-auto px-6 py-5"
          onSubmit={(event) => void handleSubmit(event)}
        >
          <div className="space-y-4">
            {error ? (
              <Alert variant="destructive">
                <AlertTitle>Creation failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            {createdProductId ? (
              <Alert>
                <AlertTitle>Product saved</AlertTitle>
                <AlertDescription>
                  The catalog record already exists. Finish the image review below or close this
                  dialog; a failed image will not remove the product.
                </AlertDescription>
              </Alert>
            ) : null}

            <fieldset className="space-y-4" disabled={Boolean(createdProductId)}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="product-name">Product name</Label>
                  <Input
                    id="product-name"
                    value={form.name}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, name: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-sku">SKU</Label>
                  <Input
                    id="product-sku"
                    value={form.sku}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, sku: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-brand">Brand</Label>
                  <Input
                    id="product-brand"
                    placeholder="Unknown"
                    value={form.brand}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, brand: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-variant">Variant or flavor</Label>
                  <Input
                    id="product-variant"
                    placeholder="Leave blank when not specified"
                    value={form.variant}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, variant: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-size-value">Pack size</Label>
                  <Input
                    id="product-size-value"
                    inputMode="decimal"
                    placeholder="Unknown"
                    value={form.sizeValue}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, sizeValue: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-size-unit">Pack size unit</Label>
                  <Select
                    id="product-size-unit"
                    value={form.sizeUnit}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        sizeUnit: event.target.value as NonNullable<ProductRecord["sizeUnit"]> | ""
                      }))
                    }
                  >
                    <option value="">Unknown</option>
                    {["MILLILITER", "LITER", "GRAM", "KILOGRAM", "PIECE"].map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-barcode">Barcode</Label>
                  <Input
                    id="product-barcode"
                    value={form.barcode}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, barcode: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-category">Category</Label>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                    <div className="min-w-0 flex-1">
                      <Select
                        id="product-category"
                        disabled={categoryLoading || categories.length === 0}
                        value={form.categoryId}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, categoryId: event.target.value }))
                        }
                      >
                        {categoryLoading ? (
                          <option value="">Loading categories...</option>
                        ) : categories.length === 0 ? (
                          <option value="">No categories found</option>
                        ) : (
                          <>
                            <option value="">Select a category</option>
                            {categories.map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.name}
                              </option>
                            ))}
                          </>
                        )}
                      </Select>
                      {!categoryLoading && categories.length === 0 ? (
                        <p className="mt-2 text-xs leading-5 text-slate-500">No categories found</p>
                      ) : null}
                    </div>
                    {isOwner ? (
                      <Button
                        className="shrink-0 whitespace-nowrap"
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          setCategoryError(null);
                          setIsCategoryDialogOpen(true);
                        }}
                      >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        Add category
                      </Button>
                    ) : null}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-unit">Unit</Label>
                  <Select
                    id="product-unit"
                    value={form.unit}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        unit: event.target.value as ProductRecord["unit"]
                      }))
                    }
                  >
                    {[
                      "PIECE",
                      "PACK",
                      "BOX",
                      "BOTTLE",
                      "SACHET",
                      "KILOGRAM",
                      "GRAM",
                      "LITER",
                      "MILLILITER"
                    ].map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-status">Status</Label>
                  <Select
                    id="product-status"
                    value={form.status}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        status: event.target.value as ProductRecord["status"]
                      }))
                    }
                  >
                    {["ACTIVE", "INACTIVE"].map((status) => (
                      <option key={status} value={status}>
                        {status === "ACTIVE" ? "Available" : "Unavailable"}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-cost">Cost price</Label>
                  <Input
                    id="product-cost"
                    inputMode="decimal"
                    value={form.costPrice}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, costPrice: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-sell">Selling price</Label>
                  <Input
                    id="product-sell"
                    inputMode="decimal"
                    value={form.sellingPrice}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, sellingPrice: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-reorder">Reorder level</Label>
                  <Input
                    id="product-reorder"
                    inputMode="numeric"
                    value={form.reorderLevel}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, reorderLevel: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-target">Target stock level</Label>
                  <Input
                    id="product-target"
                    inputMode="numeric"
                    value={form.targetStockLevel}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, targetStockLevel: event.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="product-description">Description</Label>
                <Textarea
                  id="product-description"
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, description: event.target.value }))
                  }
                />
              </div>
            </fieldset>

            <ProductImageUploadPanel
              disabled={saving}
              onApproved={() => {
                pushToast({
                  message: "The optimized product image is now active for the storefront.",
                  title: "Product image approved",
                  variant: "success"
                });
                onCreated();
                onClose();
              }}
              onSelectionChange={setHasSelectedImage}
              productId={createdProductId}
              resetKey={imageSession}
            />
          </div>
          <DialogFooter className="mt-6 px-0 pb-0">
            {createdProductId ? (
              <Button type="button" onClick={onClose}>
                Close
              </Button>
            ) : (
              <>
                <Button disabled={saving} type="button" variant="secondary" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  disabled={saving || !form.name || !form.sku || !form.categoryId}
                  type="submit"
                >
                  {saving ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : null}
                  Create product
                </Button>
              </>
            )}
          </DialogFooter>
        </form>

        <Dialog
          open={isCategoryDialogOpen}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              setIsCategoryDialogOpen(false);
            }
          }}
        >
          <DialogContent className="flex max-h-[90vh] w-[calc(100vw-32px)] max-w-[460px] flex-col overflow-hidden p-0">
            <DialogHeader className="border-b border-slate-200 px-6 py-5">
              <DialogTitle>Create category</DialogTitle>
              <DialogDescription>
                Add a new category without closing the Add Product form.
              </DialogDescription>
            </DialogHeader>

            <form
              className="flex-1 space-y-4 overflow-y-auto px-6 py-5"
              onSubmit={handleCreateCategory}
            >
              {categoryError ? (
                <Alert variant="destructive">
                  <AlertTitle>Category creation failed</AlertTitle>
                  <AlertDescription>{categoryError}</AlertDescription>
                </Alert>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="category-name">Category name</Label>
                <Input
                  id="category-name"
                  autoFocus
                  value={categoryForm.name}
                  onChange={(event) =>
                    setCategoryForm((current) => ({ ...current, name: event.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category-description">Description</Label>
                <Textarea
                  id="category-description"
                  value={categoryForm.description}
                  onChange={(event) =>
                    setCategoryForm((current) => ({
                      ...current,
                      description: event.target.value
                    }))
                  }
                />
                <p className="text-xs leading-5 text-slate-500">
                  Slug will be generated automatically from the category name.
                </p>
              </div>

              <DialogFooter className="px-0 pb-0 pt-2">
                <Button
                  disabled={creatingCategory}
                  type="button"
                  variant="secondary"
                  onClick={() => setIsCategoryDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button disabled={creatingCategory || !categoryForm.name.trim()} type="submit">
                  {creatingCategory ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : null}
                  {creatingCategory ? "Creating category…" : "Create category"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}

function ProductDetailsDialog({
  categories,
  categoryLoading,
  isOpen,
  onClose,
  onSaved,
  product
}: {
  categories: ProductCategorySummary[];
  categoryLoading: boolean;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  product: ProductRecord | null;
}) {
  const { pushToast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [discardingImageDrafts, setDiscardingImageDrafts] = useState(false);
  const [draftImageCandidateIds, setDraftImageCandidateIds] = useState<string[]>([]);
  const [form, setForm] = useState({
    barcode: "",
    brand: "",
    categoryId: "",
    costPrice: "",
    dataQualityStatus: "NEEDS_REVIEW" as ProductRecord["dataQualityStatus"],
    description: "",
    isStorefrontVisible: false,
    name: "",
    reorderLevel: "0",
    sellingPrice: "",
    sizeUnit: "" as NonNullable<ProductRecord["sizeUnit"]> | "",
    sizeValue: "",
    targetStockLevel: "0",
    unit: "PIECE" as ProductRecord["unit"],
    variant: ""
  });

  useEffect(() => {
    if (!product) {
      setIsEditing(false);
      return;
    }

    setForm({
      barcode: product.barcode ?? "",
      brand: product.brand ?? "",
      categoryId: product.category.id,
      costPrice: product.costPrice ?? "",
      description: product.description ?? "",
      name: product.name,
      dataQualityStatus: product.dataQualityStatus,
      isStorefrontVisible: product.isStorefrontVisible,
      reorderLevel: String(product.reorderLevel),
      sellingPrice: product.sellingPrice,
      targetStockLevel: String(product.targetStockLevel),
      unit: product.unit,
      variant: product.variant ?? "",
      sizeValue: product.sizeValue ?? "",
      sizeUnit: product.sizeUnit ?? ""
    });
    setIsEditing(false);
  }, [product]);

  useEffect(() => {
    setDraftImageCandidateIds([]);
  }, [product?.id]);

  async function discardDraftImageCandidates() {
    if (!product || draftImageCandidateIds.length === 0) {
      return true;
    }
    if (discardingImageDrafts) {
      return false;
    }

    setDiscardingImageDrafts(true);
    try {
      for (const candidateId of draftImageCandidateIds) {
        const response = await rejectProductImage(product.id, candidateId);
        if (!response.success) {
          throw new Error(response.message || "Image draft discard failed.");
        }
      }
      setDraftImageCandidateIds([]);
      return true;
    } catch (discardError) {
      pushToast({
        message:
          discardError instanceof Error
            ? discardError.message
            : "The uploaded image draft could not be discarded.",
        title: "Image draft not discarded",
        variant: "error"
      });
      return false;
    } finally {
      setDiscardingImageDrafts(false);
    }
  }

  async function handleCancelEditing() {
    if (!(await discardDraftImageCandidates())) {
      return;
    }
    setIsEditing(false);
  }

  async function handleCloseRequest() {
    if (isEditing && !(await discardDraftImageCandidates())) {
      return;
    }
    onClose();
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!product || saving || discardingImageDrafts) {
      return;
    }

    setSaving(true);

    try {
      const response = await updateProduct(product.id, {
        barcode: form.barcode.trim() || null,
        brand: form.brand.trim() || null,
        categoryId: form.categoryId,
        costPrice: form.costPrice.trim() || undefined,
        description: form.description.trim() || null,
        name: form.name.trim(),
        dataQualityStatus: form.dataQualityStatus,
        isStorefrontVisible: form.isStorefrontVisible,
        reorderLevel: Number(form.reorderLevel),
        sellingPrice: form.sellingPrice.trim(),
        targetStockLevel: Number(form.targetStockLevel),
        unit: form.unit,
        variant: form.variant.trim() || null,
        sizeValue: form.sizeValue ? Number(form.sizeValue) : null,
        sizeUnit: form.sizeUnit || null
      });

      if (!response.success) {
        pushToast({
          message: response.message,
          title: "Edit failed",
          variant: "error"
        });
        return;
      }

      pushToast({
        message: `${response.data?.name ?? product.name} was updated successfully.`,
        title: "Product updated",
        variant: "success"
      });
      setDraftImageCandidateIds([]);
      setIsEditing(false);
      onSaved();
    } catch {
      pushToast({
        message: "The product update service is unavailable.",
        title: "Edit failed",
        variant: "error"
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          void handleCloseRequest();
        }
      }}
    >
      <DialogContent
        aria-describedby="product-details-dialog"
        className="flex max-h-[90vh] w-[calc(100vw-32px)] max-w-[820px] flex-col overflow-hidden p-0"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
        }}
      >
        <DialogHeader className="relative border-b border-slate-200 px-6 py-5 pr-14">
          <DialogClose asChild>
            <Button
              aria-label="Close product details dialog"
              className="absolute right-4 top-4"
              size="icon"
              type="button"
              variant="ghost"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </DialogClose>
          <DialogTitle>{product ? product.name : "Product details"}</DialogTitle>
          <DialogDescription id="product-details-dialog">
            Review the selected product and edit catalog fields when needed.
          </DialogDescription>
          <p className="text-xs leading-5 text-slate-500">
            Stock quantities and movement history are available in Inventory.
          </p>
        </DialogHeader>

        {product ? (
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {isEditing ? (
              <form
                id="product-edit-form"
                className="space-y-4"
                onSubmit={(event) => void handleSave(event)}
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="edit-name">Product name</Label>
                    <Input
                      id="edit-name"
                      value={form.name}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, name: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-barcode">Barcode</Label>
                    <Input
                      id="edit-barcode"
                      value={form.barcode}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, barcode: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-brand">Brand</Label>
                    <Input
                      id="edit-brand"
                      placeholder="Leave blank when unknown"
                      value={form.brand}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, brand: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-variant">Variant or flavor</Label>
                    <Input
                      id="edit-variant"
                      placeholder="Leave blank when not specified"
                      value={form.variant}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, variant: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-size-value">Pack size</Label>
                    <Input
                      id="edit-size-value"
                      inputMode="decimal"
                      placeholder="Unknown"
                      value={form.sizeValue}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, sizeValue: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-size-unit">Pack size unit</Label>
                    <Select
                      id="edit-size-unit"
                      value={form.sizeUnit}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          sizeUnit: event.target.value as
                            | NonNullable<ProductRecord["sizeUnit"]>
                            | ""
                        }))
                      }
                    >
                      <option value="">Unknown</option>
                      {["MILLILITER", "LITER", "GRAM", "KILOGRAM", "PIECE"].map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-category">Category</Label>
                    <Select
                      id="edit-category"
                      disabled={categoryLoading || categories.length === 0}
                      value={form.categoryId}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, categoryId: event.target.value }))
                      }
                    >
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-unit">Unit</Label>
                    <Select
                      id="edit-unit"
                      value={form.unit}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          unit: event.target.value as ProductRecord["unit"]
                        }))
                      }
                    >
                      {[
                        "PIECE",
                        "PACK",
                        "BOX",
                        "BOTTLE",
                        "SACHET",
                        "KILOGRAM",
                        "GRAM",
                        "LITER",
                        "MILLILITER"
                      ].map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <ProductImageUploadPanel
                      disabled={saving || discardingImageDrafts}
                      onApproved={(candidate) => {
                        setDraftImageCandidateIds((current) =>
                          current.filter((candidateId) => candidateId !== candidate.id)
                        );
                        pushToast({
                          message: "The optimized replacement is now active for the storefront.",
                          title: "Product image approved",
                          variant: "success"
                        });
                        onSaved();
                      }}
                      onCandidateCreated={(candidate) => {
                        setDraftImageCandidateIds((current) =>
                          current.includes(candidate.id) ? current : [...current, candidate.id]
                        );
                      }}
                      onCandidateDiscarded={(candidate) => {
                        setDraftImageCandidateIds((current) =>
                          current.filter((candidateId) => candidateId !== candidate.id)
                        );
                      }}
                      productId={product.id}
                      resetKey={`${product.id}-${isEditing ? "edit" : "view"}`}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="edit-description">Description</Label>
                    <Textarea
                      id="edit-description"
                      value={form.description}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, description: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-cost">Cost price</Label>
                    <Input
                      id="edit-cost"
                      inputMode="decimal"
                      value={form.costPrice}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, costPrice: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-selling">Selling price</Label>
                    <Input
                      id="edit-selling"
                      inputMode="decimal"
                      value={form.sellingPrice}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, sellingPrice: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-reorder">Reorder level</Label>
                    <Input
                      id="edit-reorder"
                      inputMode="numeric"
                      value={form.reorderLevel}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, reorderLevel: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-target">Target stock level</Label>
                    <Input
                      id="edit-target"
                      inputMode="numeric"
                      value={form.targetStockLevel}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, targetStockLevel: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-quality-status">Catalog quality</Label>
                    <Select
                      id="edit-quality-status"
                      value={form.dataQualityStatus}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          dataQualityStatus: event.target
                            .value as ProductRecord["dataQualityStatus"],
                          isStorefrontVisible:
                            event.target.value === "APPROVED" ? current.isStorefrontVisible : false
                        }))
                      }
                    >
                      <option value="NEEDS_REVIEW">Needs review</option>
                      <option value="APPROVED">Approved</option>
                      <option value="REJECTED">Rejected</option>
                    </Select>
                  </div>
                  <label className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700">
                    <input
                      checked={form.isStorefrontVisible}
                      disabled={form.dataQualityStatus !== "APPROVED"}
                      type="checkbox"
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          isStorefrontVisible: event.target.checked
                        }))
                      }
                    />
                    Approved for customer storefront
                  </label>
                </div>
              </form>
            ) : (
              <div className="space-y-5">
                <div className="grid gap-3 md:grid-cols-2">
                  <DetailLine label="SKU" value={product.sku} />
                  <DetailLine label="Barcode" value={product.barcode ?? "Not set"} />
                  <DetailLine
                    label="Product image"
                    value={product.imageUrl ? "Catalog image set" : "Not set"}
                  />
                  <DetailLine label="Category" value={product.category.name} />
                  <DetailLine label="Brand" value={product.brand ?? "Unknown"} />
                  <DetailLine label="Variant" value={product.variant ?? "Not specified"} />
                  <DetailLine
                    label="Pack size"
                    value={
                      product.sizeValue && product.sizeUnit
                        ? `${product.sizeValue} ${product.sizeUnit}`
                        : "Unresolved"
                    }
                  />
                  <DetailLine label="Unit" value={product.unit} />
                  <DetailLine
                    label="Cost price"
                    value={
                      product.costPrice === null
                        ? "Not set"
                        : currencyFormatter.format(Number(product.costPrice))
                    }
                  />
                  <DetailLine
                    label="Selling price"
                    value={currencyFormatter.format(Number(product.sellingPrice))}
                  />
                  <DetailLine label="Reorder level" value={String(product.reorderLevel)} />
                  <DetailLine label="Target stock level" value={String(product.targetStockLevel)} />
                  <DetailLine
                    label="Status"
                    value={product.status === "ACTIVE" ? "Available" : "Unavailable"}
                  />
                  <DetailLine label="Record source" value={product.recordSource} />
                  <DetailLine label="Catalog quality" value={product.dataQualityStatus} />
                  <DetailLine
                    label="Quality warnings"
                    value={
                      product.qualityWarnings.length > 0
                        ? product.qualityWarnings.join(", ")
                        : "None"
                    }
                  />
                  <DetailLine
                    label="Customer storefront"
                    value={product.isStorefrontVisible ? "Approved" : "Hidden"}
                  />
                  <DetailLine
                    label="Created"
                    value={new Date(product.createdAt).toLocaleString()}
                  />
                  <DetailLine
                    label="Updated"
                    value={new Date(product.updatedAt).toLocaleString()}
                  />
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  <p className="font-medium text-slate-950">Description</p>
                  <p className="mt-2 leading-6">
                    {product.description ?? "No description provided."}
                  </p>
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs leading-5 text-emerald-800">
                  Stock quantities and movement history are available in Inventory.
                </div>
              </div>
            )}
          </div>
        ) : null}

        <DialogFooter className="border-t border-slate-200 bg-white/90 px-6 py-4">
          {isEditing ? (
            <>
              <Button
                disabled={saving || discardingImageDrafts}
                type="button"
                variant="secondary"
                onClick={() => void handleCancelEditing()}
              >
                {discardingImageDrafts ? "Discarding image..." : "Cancel"}
              </Button>
              <Button
                disabled={saving || !product || !form.name || !form.categoryId}
                key="product-edit-save"
                form="product-edit-form"
                type="submit"
              >
                {saving ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : null}
                Save changes
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="secondary" onClick={onClose}>
                Close
              </Button>
              <Button
                key="product-edit-enter"
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  setIsEditing(true);
                }}
              >
                Edit product
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
