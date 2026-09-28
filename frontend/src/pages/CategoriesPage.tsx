import {
  Filter,
  Image as ImageIcon,
  LoaderCircle,
  Monitor,
  PencilLine,
  Plus,
  Search,
  Smartphone,
  Tags
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode
} from "react";

import { CategoryCoverUploadPanel } from "@/components/catalog/CategoryCoverUploadPanel";
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
import { Textarea } from "@/components/ui/textarea";
import {
  createManagedCategory,
  fetchManagedCategories,
  fetchManagedCategory,
  getPublicCategoryCoverUrl,
  updateManagedCategory,
  type CategoryCoverPosition,
  type CategoryCoverStatus,
  type CategoryCoverStatusFilter,
  type CategorySortBy,
  type CategorySortOrder,
  type CategoryStatusFilter,
  type CategoryVisibilityFilter,
  type ManagedCategoryRecord
} from "@/services/categoryApi";
import type { PaginationMeta } from "@/services/catalogApi";
import {
  calculateCategoryCoverCrop,
  categoryCoverObjectPosition,
  composeCoverPosition,
  splitCoverPosition,
  type CategoryCoverCropState,
  type CategoryCoverHorizontalFocus,
  type CategoryCoverVerticalFocus
} from "@/utils/categoryCoverPosition";

const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
const SEARCH_DEBOUNCE_MS = 300;

type CategoryQueryState = {
  search: string;
  coverStatus: CategoryCoverStatusFilter;
  visibility: CategoryVisibilityFilter;
  status: CategoryStatusFilter;
  page: number;
  pageSize: number;
  sortBy: CategorySortBy;
  sortOrder: CategorySortOrder;
};

type SortOption =
  | "updatedAt:desc"
  | "name:asc"
  | "name:desc"
  | "productCount:desc"
  | "productCount:asc";

const COVER_FILTERS = new Set<CategoryCoverStatusFilter>([
  "ALL",
  "MISSING",
  "PROCESSING",
  "NEEDS_REVIEW",
  "READY",
  "FAILED"
]);
const VISIBILITY_FILTERS = new Set<CategoryVisibilityFilter>(["ALL", "VISIBLE", "HIDDEN"]);
const STATUS_FILTERS = new Set<CategoryStatusFilter>(["ALL", "ACTIVE", "INACTIVE"]);
const SORT_BY_VALUES = new Set<CategorySortBy>(["updatedAt", "name", "productCount"]);
const SORT_ORDER_VALUES = new Set<CategorySortOrder>(["asc", "desc"]);

function readCategoryQueryFromLocation(): CategoryQueryState {
  const params = new URLSearchParams(window.location.search);
  const coverStatus = params.get("coverStatus") as CategoryCoverStatusFilter | null;
  const visibility = params.get("visibility") as CategoryVisibilityFilter | null;
  const status = params.get("status") as CategoryStatusFilter | null;
  const sortBy = params.get("sortBy") as CategorySortBy | null;
  const sortOrder = params.get("sortOrder") as CategorySortOrder | null;
  const pageValue = Number(params.get("page") ?? "1");
  const pageSizeValue = Number(params.get("pageSize") ?? String(DEFAULT_PAGE_SIZE));

  return {
    search: params.get("search")?.trim() ?? "",
    coverStatus: coverStatus && COVER_FILTERS.has(coverStatus) ? coverStatus : "ALL",
    visibility: visibility && VISIBILITY_FILTERS.has(visibility) ? visibility : "ALL",
    status: status && STATUS_FILTERS.has(status) ? status : "ALL",
    page: Number.isInteger(pageValue) && pageValue > 0 ? pageValue : 1,
    pageSize:
      PAGE_SIZE_OPTIONS.includes(pageSizeValue as (typeof PAGE_SIZE_OPTIONS)[number])
        ? pageSizeValue
        : DEFAULT_PAGE_SIZE,
    sortBy: sortBy && SORT_BY_VALUES.has(sortBy) ? sortBy : "updatedAt",
    sortOrder: sortOrder && SORT_ORDER_VALUES.has(sortOrder) ? sortOrder : "desc"
  };
}

function writeCategoryQueryToLocation(
  query: CategoryQueryState,
  mode: "push" | "replace" = "push"
) {
  const url = new URL(window.location.href);
  const params = url.searchParams;

  if (query.search) params.set("search", query.search);
  else params.delete("search");

  if (query.coverStatus !== "ALL") params.set("coverStatus", query.coverStatus);
  else params.delete("coverStatus");

  if (query.visibility !== "ALL") params.set("visibility", query.visibility);
  else params.delete("visibility");

  if (query.status !== "ALL") params.set("status", query.status);
  else params.delete("status");

  if (query.page !== 1) params.set("page", String(query.page));
  else params.delete("page");

  if (query.pageSize !== DEFAULT_PAGE_SIZE) params.set("pageSize", String(query.pageSize));
  else params.delete("pageSize");

  if (query.sortBy !== "updatedAt") params.set("sortBy", query.sortBy);
  else params.delete("sortBy");

  if (query.sortOrder !== "desc") params.set("sortOrder", query.sortOrder);
  else params.delete("sortOrder");

  const queryString = params.toString();
  const nextLocation = `${url.pathname}${queryString ? `?${queryString}` : ""}${url.hash}`;
  window.history[mode === "push" ? "pushState" : "replaceState"]({}, "", nextLocation);
}

function sortOptionFromQuery(query: CategoryQueryState): SortOption {
  return `${query.sortBy}:${query.sortOrder}` as SortOption;
}

function coverStatusLabel(status: CategoryCoverStatus) {
  if (status === "NEEDS_REVIEW") return "Needs review";
  if (status === "PROCESSING") return "Processing";
  if (status === "MISSING") return "Missing";
  if (status === "FAILED") return "Failed";
  return "Ready";
}

function coverStatusVariant(status: CategoryCoverStatus) {
  if (status === "READY") return "success" as const;
  if (status === "FAILED") return "error" as const;
  if (status === "NEEDS_REVIEW") return "warning" as const;
  return "info" as const;
}

export function CategoriesPage() {
  const [query, setQuery] = useState<CategoryQueryState>(() => readCategoryQueryFromLocation());
  const queryRef = useRef(query);
  const [searchInput, setSearchInput] = useState(query.search);
  const [categories, setCategories] = useState<ManagedCategoryRecord[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshRevision, setRefreshRevision] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ManagedCategoryRecord | null>(null);
  const requestIdRef = useRef(0);
  const { pushToast } = useToast();

  const applyQuery = useCallback(
    (
      patch: Partial<CategoryQueryState>,
      options: { history?: "push" | "replace" } = {}
    ) => {
      const next = { ...queryRef.current, ...patch };
      queryRef.current = next;
      setQuery(next);
      writeCategoryQueryToLocation(next, options.history ?? "push");
    },
    []
  );

  useEffect(() => {
    const handlePopState = () => {
      const next = readCategoryQueryFromLocation();
      queryRef.current = next;
      setQuery(next);
      setSearchInput(next.search);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const nextSearch = searchInput.trim();
      if (nextSearch !== queryRef.current.search) {
        applyQuery({ page: 1, search: nextSearch }, { history: "replace" });
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [applyQuery, searchInput]);

  useEffect(() => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const controller = new AbortController();

    setLoading(true);
    setLoadError(null);

    fetchManagedCategories(
      {
        search: query.search || undefined,
        coverStatus: query.coverStatus,
        visibility: query.visibility,
        status: query.status,
        page: query.page,
        pageSize: query.pageSize,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder
      },
      { signal: controller.signal }
    )
      .then((result) => {
        if (controller.signal.aborted || requestIdRef.current !== requestId) return;

        setCategories(result.items);
        setMeta(result.meta);
        setHasLoaded(true);

        if (result.meta.page !== queryRef.current.page) {
          applyQuery({ page: result.meta.page }, { history: "replace" });
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || requestIdRef.current !== requestId) return;
        setLoadError(error instanceof Error ? error.message : "Categories could not be loaded.");
        setHasLoaded(true);
      })
      .finally(() => {
        if (!controller.signal.aborted && requestIdRef.current === requestId) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [applyQuery, query, refreshRevision]);

  function refreshCategories() {
    setRefreshRevision((current) => current + 1);
  }

  const hasFilters =
    Boolean(query.search) ||
    query.coverStatus !== "ALL" ||
    query.visibility !== "ALL" ||
    query.status !== "ALL";

  return (
    <>
      <PageHeader
        eyebrow="Owner workspace"
        title="Categories"
        description="Manage catalog taxonomy and storefront presentation. Category artwork is owner-controlled and never borrowed from product images."
        actions={
          <Button type="button" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add Category
          </Button>
        }
      />

      <section className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Category directory</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 px-4 pb-4 pt-2 lg:px-5">
            <div className="grid gap-3 xl:grid-cols-[minmax(240px,1fr)_180px_180px_170px_210px]">
              <label className="relative flex h-11 items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-3">
                <Search className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                <input
                  aria-label="Search categories"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                  placeholder="Search name, slug, description"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                />
                {loading && query.search ? (
                  <LoaderCircle
                    className="pointer-events-none absolute right-3 h-4 w-4 animate-spin text-emerald-700"
                    aria-hidden="true"
                  />
                ) : null}
              </label>

              <FilterSelect label="Cover status">
                <Select
                  aria-label="Cover status"
                  value={query.coverStatus}
                  onChange={(event) =>
                    applyQuery({
                      coverStatus: event.target.value as CategoryCoverStatusFilter,
                      page: 1
                    })
                  }
                >
                  <option value="ALL">All covers</option>
                  <option value="READY">Ready</option>
                  <option value="MISSING">Missing</option>
                  <option value="PROCESSING">Processing</option>
                  <option value="NEEDS_REVIEW">Needs review</option>
                  <option value="FAILED">Failed</option>
                </Select>
              </FilterSelect>

              <FilterSelect label="Storefront">
                <Select
                  aria-label="Storefront visibility"
                  value={query.visibility}
                  onChange={(event) =>
                    applyQuery({
                      visibility: event.target.value as CategoryVisibilityFilter,
                      page: 1
                    })
                  }
                >
                  <option value="ALL">All storefront</option>
                  <option value="VISIBLE">Visible</option>
                  <option value="HIDDEN">Hidden</option>
                </Select>
              </FilterSelect>

              <FilterSelect label="Status">
                <Select
                  aria-label="Category status"
                  value={query.status}
                  onChange={(event) =>
                    applyQuery({
                      status: event.target.value as CategoryStatusFilter,
                      page: 1
                    })
                  }
                >
                  <option value="ALL">All statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </Select>
              </FilterSelect>

              <FilterSelect label="Sort">
                <Select
                  aria-label="Sort categories"
                  value={sortOptionFromQuery(query)}
                  onChange={(event) => {
                    const [sortBy, sortOrder] = event.target.value.split(":") as [
                      CategorySortBy,
                      CategorySortOrder
                    ];
                    applyQuery({ page: 1, sortBy, sortOrder });
                  }}
                >
                  <option value="updatedAt:desc">Recently updated</option>
                  <option value="name:asc">Name A-Z</option>
                  <option value="name:desc">Name Z-A</option>
                  <option value="productCount:desc">Most products</option>
                  <option value="productCount:asc">Fewest products</option>
                </Select>
              </FilterSelect>
            </div>

            {loadError ? (
              <Alert variant="destructive">
                <AlertTitle>Categories could not be loaded</AlertTitle>
                <AlertDescription>{loadError}</AlertDescription>
              </Alert>
            ) : null}

            <div className="relative min-h-64 overflow-hidden rounded-xl border border-slate-200 bg-white">
              {!hasLoaded && loading ? (
                <div className="p-6">
                  <LoadingState
                    badge="Categories"
                    helper="Loading taxonomy, cover status, and storefront state."
                    label="Loading categories..."
                  />
                </div>
              ) : categories.length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    icon={Tags}
                    title={hasFilters ? "No categories match these filters" : "No categories yet"}
                    description={
                      hasFilters
                        ? "Adjust the search or filters to widen the category list."
                        : "Create the first category, then assign products and a premium storefront cover."
                    }
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/80">
                        <TableHead className="min-w-64">Category</TableHead>
                        <TableHead className="w-28">Products</TableHead>
                        <TableHead className="min-w-52">Cover</TableHead>
                        <TableHead className="min-w-36">Storefront</TableHead>
                        <TableHead className="min-w-36">Updated</TableHead>
                        <TableHead className="w-24 text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {categories.map((category) => (
                        <TableRow className="hover:bg-slate-50/70" key={category.id}>
                          <TableCell>
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-950">{category.name}</p>
                              <p className="mt-0.5 truncate text-xs text-slate-500">
                                {category.slug}
                              </p>
                              {category.description ? (
                                <p className="mt-1 max-w-md truncate text-xs text-slate-500">
                                  {category.description}
                                </p>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-semibold tabular-nums text-slate-800">
                              {category.productCount}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <CategoryCoverThumbnail category={category} />
                              <StatusBadge variant={coverStatusVariant(category.coverStatus)}>
                                {coverStatusLabel(category.coverStatus)}
                              </StatusBadge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col items-start gap-1.5">
                              <StatusBadge
                                variant={category.isStorefrontVisible ? "success" : "info"}
                              >
                                {category.isStorefrontVisible ? "Visible" : "Hidden"}
                              </StatusBadge>
                              {!category.isActive ? (
                                <span className="text-xs font-medium text-slate-500">Inactive</span>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="text-slate-600">
                            {new Date(category.updatedAt).toLocaleDateString("en-PH", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric"
                            })}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              aria-label={`Edit ${category.name}`}
                              size="sm"
                              type="button"
                              variant="secondary"
                              onClick={() => setSelectedCategory(category)}
                            >
                              <PencilLine className="h-4 w-4" aria-hidden="true" />
                              Edit
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {hasLoaded && loading && categories.length > 0 ? (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/55 p-6 backdrop-blur-[1px]">
                  <div className="w-full max-w-md">
                    <LoadingState
                      badge="Categories"
                      helper="Keeping the current rows visible while the filtered view updates."
                      label="Updating categories..."
                    />
                  </div>
                </div>
              ) : null}
            </div>

            {meta ? (
              <AppPagination
                isLoading={loading}
                itemLabel="categories"
                onPageChange={(page) => applyQuery({ page })}
                onPageSizeChange={(pageSize) => applyQuery({ page: 1, pageSize })}
                page={meta.page}
                pageSize={meta.pageSize}
                pageSizeOptions={PAGE_SIZE_OPTIONS}
                siblingCount={1}
                totalItems={meta.totalItems}
                totalPages={meta.totalItems === 0 ? 0 : meta.totalPages}
              />
            ) : null}
          </CardContent>
        </Card>
      </section>

      <CreateCategoryDialog
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          refreshCategories();
          pushToast({
            title: "Category created",
            message: "The category is ready. Its storefront cover starts as Missing.",
            variant: "success"
          });
        }}
      />

      <EditCategoryDialog
        category={selectedCategory}
        isOpen={Boolean(selectedCategory)}
        onClose={() => setSelectedCategory(null)}
        onCategoryChanged={(category) => {
          setSelectedCategory(category);
          refreshCategories();
        }}
        onSaved={(category) => {
          setSelectedCategory(category);
          refreshCategories();
          pushToast({
            title: "Category updated",
            message: "Category settings were saved successfully.",
            variant: "success"
          });
        }}
      />
    </>
  );
}

function FilterSelect({
  children,
  label
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <label className="relative block h-11">
      <Filter
        className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-500"
        aria-hidden="true"
      />
      <span className="sr-only">{label}</span>
      <div className="h-full [&_select]:h-11 [&_select]:pl-9">{children}</div>
    </label>
  );
}

function CategoryCoverThumbnail({ category }: { category: ManagedCategoryRecord }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [category.activeCoverAssetId]);

  if (!category.activeCoverAssetId || failed) {
    return (
      <div className="grid h-12 w-20 shrink-0 place-items-center rounded-md border border-dashed border-slate-300 bg-slate-50 text-slate-400">
        <ImageIcon className="h-4 w-4" aria-hidden="true" />
      </div>
    );
  }

  return (
    <img
      alt=""
      className="h-12 w-20 shrink-0 rounded-md border border-slate-200 bg-slate-50 object-cover"
      loading="lazy"
      src={getPublicCategoryCoverUrl(category.activeCoverAssetId, "thumbnail")}
      style={{ objectPosition: categoryCoverObjectPosition(category.coverPosition) }}
      onError={() => setFailed(true)}
    />
  );
}

function CreateCategoryDialog({
  isOpen,
  onClose,
  onCreated
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setName("");
      setDescription("");
      setSaving(false);
      setError(null);
    }
  }, [isOpen]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || saving) return;

    setSaving(true);
    setError(null);

    try {
      const response = await createManagedCategory({
        name: name.trim(),
        description: description.trim() || null
      });

      if (!response.success || !response.data) {
        throw new Error(response.message || "Category could not be created.");
      }

      onCreated();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Category could not be created."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="flex max-h-[90vh] max-w-[560px] flex-col gap-0 p-0">
        <DialogHeader className="border-b border-slate-200 px-6 py-5">
          <DialogTitle>Add Category</DialogTitle>
          <DialogDescription>
            Create a catalog category. Storefront artwork starts empty until the owner assigns a
            category cover.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-5 overflow-y-auto px-6 py-5" onSubmit={handleSubmit}>
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Category creation failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="category-create-name">Category name</Label>
            <Input
              autoFocus
              id="category-create-name"
              maxLength={120}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <p className="text-xs leading-5 text-slate-500">
              A stable URL slug is generated automatically.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category-create-description">Description</Label>
            <Textarea
              id="category-create-description"
              maxLength={255}
              placeholder="Short customer-facing description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3">
            <div className="flex items-start gap-3">
              <ImageIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-slate-800">Cover starts as Missing</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Product images are never used as automatic category artwork.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="-mx-6 -mb-5 px-6">
            <Button disabled={saving} type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={saving || !name.trim()} type="submit">
              {saving ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              {saving ? "Creating..." : "Create Category"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditCategoryDialog({
  category,
  isOpen,
  onClose,
  onCategoryChanged,
  onSaved
}: {
  category: ManagedCategoryRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onCategoryChanged: (category: ManagedCategoryRecord) => void;
  onSaved: (category: ManagedCategoryRecord) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isStorefrontVisible, setIsStorefrontVisible] = useState(true);
  const [coverPosition, setCoverPosition] = useState<CategoryCoverPosition>("CENTER");
  const [coverCropState, setCoverCropState] = useState<
    CategoryCoverCropState & { mode: "DESKTOP" | "MOBILE" }
  >({
    horizontalActive: false,
    horizontalPx: 0,
    mode: "DESKTOP",
    verticalActive: false,
    verticalPx: 0
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!category) return;
    setName(category.name);
    setDescription(category.description ?? "");
    setIsActive(category.isActive);
    setIsStorefrontVisible(category.isStorefrontVisible);
    setCoverPosition(category.coverPosition);
    setCoverCropState({
      horizontalActive: false,
      horizontalPx: 0,
      mode: "DESKTOP",
      verticalActive: false,
      verticalPx: 0
    });
    setSaving(false);
    setError(null);
  }, [category]);

  if (!category) return null;

  const coverFocus = splitCoverPosition(coverPosition);

  async function handleCoverChanged() {
    try {
      const refreshed = await fetchManagedCategory(category.id);
      onCategoryChanged(refreshed);
    } catch {
      // Cover mutations already succeeded server-side; list refresh remains best-effort.
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || saving) return;

    setSaving(true);
    setError(null);

    try {
      const response = await updateManagedCategory(category.id, {
        name: name.trim(),
        description: description.trim() || null,
        isActive,
        isStorefrontVisible,
        coverPosition
      });

      if (!response.success || !response.data) {
        throw new Error(response.message || "Category could not be updated.");
      }

      onSaved(response.data);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Category could not be updated."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="flex max-h-[92vh] max-w-[900px] flex-col gap-0 p-0">
        <DialogHeader className="border-b border-slate-200 px-6 py-5">
          <DialogTitle>Edit Category</DialogTitle>
          <DialogDescription>
            Manage taxonomy, storefront visibility, and category presentation.
          </DialogDescription>
        </DialogHeader>

        <form className="overflow-y-auto" onSubmit={handleSubmit}>
          <div className="grid gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.9fr)]">
            <div className="space-y-5">
              {error ? (
                <Alert variant="destructive">
                  <AlertTitle>Category update failed</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="category-edit-name">Category name</Label>
                <Input
                  id="category-edit-name"
                  maxLength={120}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
                <p className="text-xs text-slate-500">Slug: {category.slug}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category-edit-description">Description</Label>
                <Textarea
                  id="category-edit-description"
                  maxLength={255}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4">
                  <input
                    checked={isActive}
                    className="mt-0.5"
                    type="checkbox"
                    onChange={(event) => setIsActive(event.target.checked)}
                  />
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">Active category</span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">
                      Available for normal catalog operations.
                    </span>
                  </span>
                </label>

                <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4">
                  <input
                    checked={isStorefrontVisible}
                    className="mt-0.5"
                    type="checkbox"
                    onChange={(event) => setIsStorefrontVisible(event.target.checked)}
                  />
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">
                      Storefront visible
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">
                      Allows this category to appear in customer category navigation.
                    </span>
                  </span>
                </label>
              </div>
            </div>

            <aside className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950">Storefront presentation</p>
                  <p className="mt-1 text-xs text-slate-500">Actual cover framing preview</p>
                </div>
                <StatusBadge variant={coverStatusVariant(category.coverStatus)}>
                  {coverStatusLabel(category.coverStatus)}
                </StatusBadge>
              </div>

              <CategoryCoverPreview
                category={{ ...category, coverPosition }}
                onCropStateChange={setCoverCropState}
              />

              <div className="space-y-3">
                <div>
                  <Label>Image focus</Label>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Anchor the subject on both crop axes. The preview updates immediately.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="category-cover-horizontal-focus">Horizontal</Label>
                    <Select
                      disabled={!category.activeCoverAssetId}
                      id="category-cover-horizontal-focus"
                      value={coverFocus.horizontal}
                      onChange={(event) =>
                        setCoverPosition(
                          composeCoverPosition(
                            event.target.value as CategoryCoverHorizontalFocus,
                            coverFocus.vertical
                          )
                        )
                      }
                    >
                      <option value="LEFT">Left</option>
                      <option value="CENTER">Center</option>
                      <option value="RIGHT">Right</option>
                    </Select>
                    <CropAxisStatus
                      active={coverCropState.horizontalActive}
                      axis="horizontal"
                      croppedPixels={coverCropState.horizontalPx}
                      mode={coverCropState.mode}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category-cover-vertical-focus">Vertical</Label>
                    <Select
                      disabled={!category.activeCoverAssetId}
                      id="category-cover-vertical-focus"
                      value={coverFocus.vertical}
                      onChange={(event) =>
                        setCoverPosition(
                          composeCoverPosition(
                            coverFocus.horizontal,
                            event.target.value as CategoryCoverVerticalFocus
                          )
                        )
                      }
                    >
                      <option value="TOP">Top</option>
                      <option value="CENTER">Center</option>
                      <option value="BOTTOM">Bottom</option>
                    </Select>
                    <CropAxisStatus
                      active={coverCropState.verticalActive}
                      axis="vertical"
                      croppedPixels={coverCropState.verticalPx}
                      mode={coverCropState.mode}
                    />
                  </div>
                </div>
                <p className="text-xs leading-5 text-slate-500">
                  Focus is always saved. An axis only moves visibly when that preview size crops it.
                </p>
              </div>
            </aside>
          </div>

          <div className="border-t border-slate-200 px-6 py-6">
            <CategoryCoverUploadPanel
              activeCoverAssetId={category.activeCoverAssetId}
              categoryId={category.id}
              onChanged={handleCoverChanged}
            />
          </div>

          <DialogFooter>
            <Button disabled={saving} type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={saving || !name.trim()} type="submit">
              {saving ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              {saving ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CropAxisStatus({
  active,
  axis,
  croppedPixels,
  mode
}: {
  active: boolean;
  axis: "horizontal" | "vertical";
  croppedPixels: number;
  mode: "DESKTOP" | "MOBILE";
}) {
  const modeLabel = mode === "DESKTOP" ? "Desktop" : "Mobile";

  return (
    <p className="flex items-start gap-2 text-[11px] leading-4 text-slate-500">
      <span
        aria-hidden="true"
        className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
          active ? "bg-emerald-500" : "bg-slate-300"
        }`}
      />
      <span>
        {active
          ? `${modeLabel}: ~${Math.round(croppedPixels)}px total ${axis} crop. Focus is active.`
          : `${modeLabel}: no ${axis} crop at this preview size. Selection still applies at other responsive widths.`}
      </span>
    </p>
  );
}

function CategoryCoverPreview({
  category,
  onCropStateChange
}: {
  category: ManagedCategoryRecord;
  onCropStateChange: (
    state: CategoryCoverCropState & { mode: "DESKTOP" | "MOBILE" }
  ) => void;
}) {
  const [failed, setFailed] = useState(false);
  const [previewMode, setPreviewMode] = useState<"DESKTOP" | "MOBILE">("DESKTOP");
  const [sourceSize, setSourceSize] = useState({ height: 0, width: 0 });
  const [frameSize, setFrameSize] = useState({ height: 0, width: 0 });
  const frameRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setFailed(false);
    setSourceSize({ height: 0, width: 0 });
  }, [category.activeCoverAssetId]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const measure = () => {
      const rect = frame.getBoundingClientRect();
      setFrameSize((current) => {
        if (
          Math.abs(current.width - rect.width) < 0.5 &&
          Math.abs(current.height - rect.height) < 0.5
        ) {
          return current;
        }
        return { height: rect.height, width: rect.width };
      });
    };

    measure();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(measure);
      observer.observe(frame);
      return () => observer.disconnect();
    }

    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [previewMode]);

  const cropState = calculateCategoryCoverCrop(
    sourceSize.width,
    sourceSize.height,
    frameSize.width,
    frameSize.height
  );

  useEffect(() => {
    onCropStateChange({
      ...cropState,
      mode: previewMode
    });
  }, [
    cropState.horizontalActive,
    cropState.horizontalPx,
    cropState.verticalActive,
    cropState.verticalPx,
    onCropStateChange,
    previewMode
  ]);

  const productLabel = `${category.productCount} ${category.productCount === 1 ? "product" : "products"}`;

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Live crop preview
        </p>
        <div
          aria-label="Storefront preview size"
          className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1"
          role="group"
        >
          <Button
            aria-pressed={previewMode === "DESKTOP"}
            className="h-7 gap-1.5 px-2.5 text-xs"
            size="sm"
            type="button"
            variant={previewMode === "DESKTOP" ? "secondary" : "ghost"}
            onClick={() => setPreviewMode("DESKTOP")}
          >
            <Monitor className="h-3.5 w-3.5" aria-hidden="true" />
            Desktop
          </Button>
          <Button
            aria-pressed={previewMode === "MOBILE"}
            className="h-7 gap-1.5 px-2.5 text-xs"
            size="sm"
            type="button"
            variant={previewMode === "MOBILE" ? "secondary" : "ghost"}
            onClick={() => setPreviewMode("MOBILE")}
          >
            <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
            Mobile
          </Button>
        </div>
      </div>

      <div
        className={
          previewMode === "MOBILE"
            ? "mx-auto w-full max-w-[18rem]"
            : "w-full"
        }
      >
        <div className="overflow-hidden rounded-[1.15rem] border border-slate-200 bg-white shadow-sm">
          <div
            className={
              previewMode === "MOBILE"
                ? "relative h-[175px] overflow-hidden bg-slate-100"
                : "relative h-[170px] overflow-hidden bg-slate-100"
            }
            ref={frameRef}
          >
            {category.activeCoverAssetId && !failed ? (
              <img
                alt=""
                className="h-full w-full object-cover transition-[object-position] duration-200 motion-reduce:transition-none"
                src={getPublicCategoryCoverUrl(category.activeCoverAssetId, "cover")}
                style={{ objectPosition: categoryCoverObjectPosition(category.coverPosition) }}
                onError={() => {
                  setFailed(true);
                  setSourceSize({ height: 0, width: 0 });
                }}
                onLoad={(event) => {
                  setSourceSize({
                    height: event.currentTarget.naturalHeight,
                    width: event.currentTarget.naturalWidth
                  });
                }}
              />
            ) : (
              <div className="grid h-full place-items-center px-6 text-center">
                <div>
                  <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-white text-slate-400 shadow-sm">
                    <ImageIcon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <p className="mt-3 text-sm font-semibold text-slate-700">No category cover</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Assign a premium cover to preview storefront framing.
                  </p>
                </div>
              </div>
            )}

            <span className="absolute bottom-3 right-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-slate-700 shadow-sm backdrop-blur-sm">
              {productLabel}
            </span>
          </div>

          <div className="min-h-[92px] px-4 py-3.5">
            <p className="truncate text-sm font-semibold text-slate-950">{category.name}</p>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
              {category.description || "Explore this aisle"}
            </p>
          </div>
        </div>
      </div>

      <p className="text-xs leading-5 text-slate-500">
        Crop detection uses the loaded cover dimensions and the live preview frame, matching
        object-fit: cover behavior.
      </p>
    </div>
  );
}
