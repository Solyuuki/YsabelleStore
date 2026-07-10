import { Download, FileUp, Filter, RefreshCw, Search, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingState } from "@/components/shared/LoadingState";
import {
  downloadProductImportTemplate,
  fetchInventory,
  fetchMovements,
  fetchProducts,
  importProducts,
  previewProductImport,
  updateProductStatus,
  type InventoryRecord,
  type MovementRecord,
  type ProductImportPreview,
  type ProductImportSummary,
  type ProductRecord
} from "@/services/catalogApi";
import { useToast } from "@/components/shared/ToastProvider";

const MAX_IMPORT_FILE_SIZE_MB = 5;

type ImportState = {
  file: File | null;
  preview: ProductImportPreview | null;
  summary: ProductImportSummary | null;
  loading: boolean;
  error: string | null;
};

export function ProductsPage() {
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [inventoryRows, setInventoryRows] = useState<InventoryRecord[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [movements, setMovements] = useState<MovementRecord[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE" | "DISCONTINUED">(
    "ALL"
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [importState, setImportState] = useState<ImportState>({
    file: null,
    preview: null,
    summary: null,
    loading: false,
    error: null
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { pushToast } = useToast();

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) ?? null,
    [products, selectedProductId]
  );

  const selectedInventory = useMemo(
    () => inventoryRows.find((row) => row.productId === selectedProductId) ?? null,
    [inventoryRows, selectedProductId]
  );

  useEffect(() => {
    let active = true;

    async function loadCatalog() {
      setLoading(true);
      setLoadError(null);

      try {
        const [productResult, inventoryResult] = await Promise.all([
          fetchProducts({
            search: search.trim() || undefined,
            status: statusFilter === "ALL" ? undefined : statusFilter,
            pageSize: 100
          }),
          fetchInventory({
            search: search.trim() || undefined,
            pageSize: 100
          })
        ]);

        if (!active) {
          return;
        }

        setProducts(productResult.items);
        setInventoryRows(inventoryResult.items);

        const firstProduct = productResult.items[0];

        if (!selectedProductId && firstProduct) {
          setSelectedProductId(firstProduct.id);
        }
      } catch (error) {
        if (!active) {
          return;
        }

        setLoadError(error instanceof Error ? error.message : "Unable to load products.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadCatalog();

    return () => {
      active = false;
    };
  }, [search, statusFilter]);

  useEffect(() => {
    let active = true;

    async function loadMovements() {
      if (!selectedProductId) {
        setMovements([]);
        return;
      }

      try {
        const result = await fetchMovements(selectedProductId, {
          pageSize: 20
        });

        if (!active) {
          return;
        }

        setMovements(result.items);
      } catch {
        if (active) {
          setMovements([]);
        }
      }
    }

    void loadMovements();

    return () => {
      active = false;
    };
  }, [selectedProductId]);

  async function refreshCatalog() {
    const [productResult, inventoryResult] = await Promise.all([
      fetchProducts({
        search: search.trim() || undefined,
        status: statusFilter === "ALL" ? undefined : statusFilter,
        pageSize: 100
      }),
      fetchInventory({
        search: search.trim() || undefined,
        pageSize: 100
      })
    ]);

    setProducts(productResult.items);
    setInventoryRows(inventoryResult.items);

    const firstProduct = productResult.items[0];

    if (!selectedProductId && firstProduct) {
      setSelectedProductId(firstProduct.id);
    }
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

  async function handleFileSelection(file: File | null) {
    setImportState((current) => ({
      ...current,
      file,
      preview: null,
      summary: null,
      error: null
    }));

    if (!file) {
      return;
    }

    setImportState((current) => ({ ...current, loading: true }));

    try {
      const response = await previewProductImport(file);

      if (!response.success) {
        setImportState((current) => ({
          ...current,
          loading: false,
          error: response.message
        }));
        return;
      }

      if (!response.data) {
        setImportState((current) => ({
          ...current,
          loading: false,
          error: "Preview failed."
        }));
        return;
      }

      const preview = response.data;

      setImportState((current) => ({
        ...current,
        loading: false,
        preview,
        error: null
      }));
    } catch (error) {
      setImportState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : "Preview failed."
      }));
    }
  }

  async function handleConfirmImport() {
    if (!importState.file) {
      return;
    }

    setImportState((current) => ({ ...current, loading: true, error: null }));

    try {
      const response = await importProducts(importState.file);

      if (!response.success) {
        const details =
          response.error && typeof response.error === "object" ? response.error : null;
        const errorMessage =
          details && "code" in details ? response.message : "Product import failed.";
        setImportState((current) => ({
          ...current,
          loading: false,
          error: errorMessage
        }));
        return;
      }

      if (!response.data) {
        setImportState((current) => ({
          ...current,
          loading: false,
          error: "Product import failed."
        }));
        return;
      }

      setImportState({
        file: null,
        preview: null,
        summary: response.data,
        loading: false,
        error: null
      });

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      await refreshCatalog();
      pushToast({
        message: "Imported products are now available in Products and Inventory.",
        title: "Import completed",
        variant: "success"
      });
    } catch (error) {
      setImportState((current) => ({
        ...current,
        loading: false,
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

  return (
    <>
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
            <Button onClick={() => fileInputRef.current?.click()} type="button" variant="default">
              <FileUp className="h-4 w-4" aria-hidden="true" />
              Import Products
            </Button>
          </div>
        }
      />

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <CardTitle>Import products</CardTitle>
              <StatusBadge variant="info">CSV and Excel</StatusBadge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50/70 p-4">
                <p className="text-sm font-semibold text-emerald-900">Accepted files</p>
                <p className="mt-1 text-sm leading-6 text-emerald-800">
                  `.csv`, `.xlsx`, and `.xls` up to {MAX_IMPORT_FILE_SIZE_MB} MB. The import is
                  previewed first, then confirmed by the owner.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Choose file
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setImportState({
                        file: null,
                        preview: null,
                        summary: null,
                        loading: false,
                        error: null
                      });

                      if (fileInputRef.current) {
                        fileInputRef.current.value = "";
                      }
                    }}
                  >
                    Cancel
                  </Button>
                  <input
                    accept=".csv,.xlsx,.xls"
                    className="hidden"
                    onChange={(event) => void handleFileSelection(event.target.files?.[0] ?? null)}
                    ref={fileInputRef}
                    type="file"
                  />
                </div>
                <p className="mt-3 text-xs text-emerald-700">
                  Required columns: name, sku, category, unit, costPrice, sellingPrice,
                  reorderLevel, and initialStock.
                </p>
              </div>

              {importState.loading ? <LoadingState label="Processing import file..." /> : null}

              {importState.file ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  Selected file:{" "}
                  <span className="font-medium text-slate-950">{importState.file.name}</span>
                </div>
              ) : null}

              {importState.error ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {importState.error}
                </div>
              ) : null}

              {importState.preview ? (
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-4">
                    <SummaryPill label="Rows" value={String(importState.preview.totalRows)} />
                    <SummaryPill
                      label="Valid"
                      value={String(importState.preview.validRows)}
                      tone="success"
                    />
                    <SummaryPill
                      label="Invalid"
                      value={String(importState.preview.invalidRows)}
                      tone="danger"
                    />
                    <SummaryPill
                      label="Ignored columns"
                      value={String(importState.preview.ignoredColumns.length)}
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {importState.preview.detectedColumns.map((column) => (
                      <span
                        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700"
                        key={column}
                      >
                        {column}
                      </span>
                    ))}
                  </div>

                  {importState.preview.errors.length > 0 ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                      <p className="text-sm font-semibold text-amber-900">Validation issues</p>
                      <ul className="mt-3 space-y-2 text-sm text-amber-800">
                        {importState.preview.errors.slice(0, 12).map((issue, index) => (
                          <li key={`${issue.code}-${issue.rowNumber ?? 0}-${index}`}>
                            Row {issue.rowNumber ?? 0}: {issue.message}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div className="overflow-hidden rounded-xl border border-slate-200">
                    <table className="w-full border-collapse text-left text-sm">
                      <thead className="bg-slate-100 text-slate-700">
                        <tr>
                          <th className="px-3 py-2">Row</th>
                          <th className="px-3 py-2">Name</th>
                          <th className="px-3 py-2">SKU</th>
                          <th className="px-3 py-2">Barcode</th>
                          <th className="px-3 py-2">Category</th>
                          <th className="px-3 py-2">Unit</th>
                          <th className="px-3 py-2">Selling price</th>
                          <th className="px-3 py-2">Initial stock</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2">Result</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importState.preview.rows.map((row) => (
                          <tr
                            className={row.valid ? "bg-white" : "bg-red-50/80"}
                            key={row.rowNumber}
                          >
                            <td className="border-t border-slate-200 px-3 py-2">{row.rowNumber}</td>
                            <td className="border-t border-slate-200 px-3 py-2">
                              {row.normalizedData?.name ?? "-"}
                            </td>
                            <td className="border-t border-slate-200 px-3 py-2">
                              {row.normalizedData?.sku ?? "-"}
                            </td>
                            <td className="border-t border-slate-200 px-3 py-2">
                              {row.normalizedData?.barcode ?? "-"}
                            </td>
                            <td className="border-t border-slate-200 px-3 py-2">
                              {row.normalizedData?.category ?? "-"}
                            </td>
                            <td className="border-t border-slate-200 px-3 py-2">
                              {row.normalizedData?.unit ?? "-"}
                            </td>
                            <td className="border-t border-slate-200 px-3 py-2">
                              {row.normalizedData?.sellingPrice ?? "-"}
                            </td>
                            <td className="border-t border-slate-200 px-3 py-2">
                              {row.normalizedData?.initialStock ?? "-"}
                            </td>
                            <td className="border-t border-slate-200 px-3 py-2">
                              {row.normalizedData?.status ?? "-"}
                            </td>
                            <td className="border-t border-slate-200 px-3 py-2">
                              {row.valid ? (
                                <StatusBadge variant="success">Valid</StatusBadge>
                              ) : (
                                <StatusBadge variant="error">Invalid</StatusBadge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      disabled={
                        !importState.preview ||
                        importState.preview.invalidRows > 0 ||
                        importState.loading
                      }
                      onClick={() => void handleConfirmImport()}
                    >
                      Confirm import
                    </Button>
                    {importState.preview?.invalidRows ? (
                      <span className="text-sm text-slate-500">
                        Fix the invalid rows before confirming.
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {importState.summary ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-sm font-semibold text-emerald-900">Import summary</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <SummaryPill
                      label="Imported"
                      value={String(importState.summary.importedRows)}
                      tone="success"
                    />
                    <SummaryPill
                      label="Inventory rows"
                      value={String(importState.summary.inventoryRowsCreated)}
                      tone="success"
                    />
                    <SummaryPill
                      label="Initial movements"
                      value={String(importState.summary.initialMovementsCreated)}
                      tone="success"
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <CardTitle>Catalog overview</CardTitle>
              <StatusBadge variant="info">MySQL-backed</StatusBadge>
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
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </label>
                <label className="flex h-11 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm">
                  <Filter className="h-4 w-4 text-slate-500" aria-hidden="true" />
                  <select
                    className="w-full bg-transparent outline-none"
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
                  >
                    <option value="ALL">All statuses</option>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="DISCONTINUED">Discontinued</option>
                  </select>
                </label>
              </div>

              {loading ? <LoadingState label="Loading products..." /> : null}
              {loadError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {loadError}
                </div>
              ) : null}

              {!loading && !loadError && products.length === 0 ? (
                <EmptyState
                  description="Import a CSV or Excel file to populate the catalog."
                  icon={ShieldCheck}
                  title="No products yet"
                />
              ) : null}

              {products.length > 0 ? (
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead className="bg-slate-100 text-slate-700">
                      <tr>
                        <th className="px-3 py-2">Product</th>
                        <th className="px-3 py-2">SKU</th>
                        <th className="px-3 py-2">Barcode</th>
                        <th className="px-3 py-2">Category</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Selling price</th>
                        <th className="px-3 py-2">Stock</th>
                        <th className="px-3 py-2">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((product) => (
                        <tr
                          className={
                            selectedProductId === product.id ? "bg-emerald-50/70" : "bg-white"
                          }
                          key={product.id}
                        >
                          <td className="border-t border-slate-200 px-3 py-2">
                            <button
                              className="text-left font-medium text-slate-950 hover:text-emerald-700"
                              onClick={() => setSelectedProductId(product.id)}
                              type="button"
                            >
                              {product.name}
                            </button>
                            <div className="text-xs text-slate-500">
                              {product.description ?? "No description"}
                            </div>
                          </td>
                          <td className="border-t border-slate-200 px-3 py-2">{product.sku}</td>
                          <td className="border-t border-slate-200 px-3 py-2">
                            {product.barcode ?? "-"}
                          </td>
                          <td className="border-t border-slate-200 px-3 py-2">
                            {product.category.name}
                          </td>
                          <td className="border-t border-slate-200 px-3 py-2">
                            <StatusBadge variant={product.isActive ? "success" : "warning"}>
                              {product.status}
                            </StatusBadge>
                          </td>
                          <td className="border-t border-slate-200 px-3 py-2">
                            PHP {Number(product.sellingPrice).toFixed(2)}
                          </td>
                          <td className="border-t border-slate-200 px-3 py-2">
                            {product.inventory.currentQuantity}
                          </td>
                          <td className="border-t border-slate-200 px-3 py-2">
                            {product.isActive ? (
                              <Button
                                size="sm"
                                type="button"
                                variant="secondary"
                                onClick={() => void handleDeactivate(product.id)}
                              >
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                                Deactivate
                              </Button>
                            ) : (
                              <StatusBadge variant="warning">Inactive</StatusBadge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              <Card className="border-slate-200 bg-slate-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Selected product stock</CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedProduct ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      <DetailLine label="Product" value={selectedProduct.name} />
                      <DetailLine label="SKU" value={selectedProduct.sku} />
                      <DetailLine
                        label="Stock"
                        value={String(
                          selectedInventory?.currentQuantity ??
                            selectedProduct.inventory.currentQuantity
                        )}
                      />
                      <DetailLine
                        label="Reorder level"
                        value={String(selectedProduct.reorderLevel)}
                      />
                      <DetailLine label="Current status" value={selectedProduct.status} />
                      <DetailLine
                        label="Availability"
                        value={selectedProduct.isActive ? "Available" : "Inactive"}
                      />
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">
                      Choose a product to review its stock and movement history.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card className="border-slate-200 bg-slate-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Movement history</CardTitle>
                </CardHeader>
                <CardContent>
                  {movements.length > 0 ? (
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
          </CardContent>
        </Card>
      </section>
    </>
  );
}

function SummaryPill({
  label,
  tone = "default",
  value
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "danger";
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : tone === "danger"
        ? "border-red-200 bg-red-50 text-red-900"
        : "border-slate-200 bg-white text-slate-900";

  return (
    <div className={`rounded-xl border px-4 py-3 ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-950">{value}</p>
    </div>
  );
}
