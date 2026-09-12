import { LoaderCircle, PackagePlus, Plus } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";

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
  createProduct,
  fetchCategories,
  type ProductCategorySummary,
  type ProductRecord
} from "@/services/catalogApi";
import { createRestockOrder } from "@/services/restockApi";

const PRODUCT_UNITS = [
  "PIECE",
  "PACK",
  "BOX",
  "BOTTLE",
  "SACHET",
  "KILOGRAM",
  "GRAM",
  "LITER",
  "MILLILITER"
] as const;

type ProductUnit = (typeof PRODUCT_UNITS)[number];

type NewProductForm = {
  barcode: string;
  categoryId: string;
  costPrice: string;
  name: string;
  reorderLevel: string;
  requestedQuantity: string;
  sellingPrice: string;
  sku: string;
  targetStockLevel: string;
  unit: ProductUnit;
};

const EMPTY_FORM: NewProductForm = {
  barcode: "",
  categoryId: "",
  costPrice: "",
  name: "",
  reorderLevel: "0",
  requestedQuantity: "1",
  sellingPrice: "",
  sku: "",
  targetStockLevel: "0",
  unit: "PIECE"
};

export function RestockNewProductCard({
  onOpenOrders,
  onOrderCreated
}: {
  onOpenOrders: () => void;
  onOrderCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<NewProductForm>(EMPTY_FORM);
  const [categories, setCategories] = useState<ProductCategorySummary[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!open || categories.length > 0 || categoriesLoading) return;

    let active = true;
    setCategoriesLoading(true);
    void fetchCategories()
      .then((result) => {
        if (!active) return;
        setCategories(result);
        setForm((current) => ({
          ...current,
          categoryId: current.categoryId || result[0]?.id || ""
        }));
      })
      .catch(() => {
        if (active) {
          setError("Categories could not be loaded. Add the product from Products and try again.");
        }
      })
      .finally(() => {
        if (active) setCategoriesLoading(false);
      });

    return () => {
      active = false;
    };
  }, [categories.length, categoriesLoading, open]);

  function closeDialog() {
    if (saving) return;
    setOpen(false);
    setError(null);
    setForm((current) => ({
      ...EMPTY_FORM,
      categoryId: current.categoryId || categories[0]?.id || ""
    }));
  }

  function update<K extends keyof NewProductForm>(key: K, value: NewProductForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    const requestedQuantity = Math.trunc(Number(form.requestedQuantity));
    if (!form.name.trim() || !form.sku.trim() || !form.categoryId) {
      setError("Product name, SKU, and category are required.");
      return;
    }
    if (!form.costPrice.trim() || !form.sellingPrice.trim()) {
      setError("Cost price and selling price are required by the Product pipeline.");
      return;
    }
    if (!Number.isFinite(requestedQuantity) || requestedQuantity < 1) {
      setError("Restock quantity must be at least 1.");
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);

    let createdProduct: ProductRecord | null = null;
    try {
      const response = await createProduct({
        barcode: form.barcode.trim() || null,
        categoryId: form.categoryId,
        costPrice: form.costPrice.trim(),
        dataQualityStatus: "NEEDS_REVIEW",
        isStorefrontVisible: false,
        name: form.name.trim(),
        reorderLevel: Math.max(0, Math.trunc(Number(form.reorderLevel) || 0)),
        sellingPrice: form.sellingPrice.trim(),
        sku: form.sku.trim(),
        status: "ACTIVE",
        targetStockLevel: Math.max(0, Math.trunc(Number(form.targetStockLevel) || 0)),
        unit: form.unit
      });

      if (!response.success || !response.data) {
        setError(response.message || "Product creation failed.");
        return;
      }
      createdProduct = response.data;

      const order = await createRestockOrder({
        notes: `New product restock created from Reports for ${createdProduct.name}.`,
        lines: [
          {
            isSelected: true,
            notes: "New canonical product created from Reports quick add.",
            productId: createdProduct.id,
            recommendationId: null,
            recommendationSource: "MANUAL",
            recommendedQuantity: 0,
            requestedQuantity
          }
        ]
      });

      setNotice(
        `${createdProduct.name} was created with zero stock and added to ${order.orderNumber}. Inventory is unchanged until receiving.`
      );
      onOrderCreated();
      setOpen(false);
      setForm((current) => ({
        ...EMPTY_FORM,
        categoryId: current.categoryId || categories[0]?.id || ""
      }));
    } catch (requestError) {
      if (createdProduct) {
        setError(
          `${createdProduct.name} was created successfully, but the restock draft could not be created. Add the product as an existing item in the restock planner. ${
            requestError instanceof Error ? requestError.message : ""
          }`.trim()
        );
      } else {
        setError(
          requestError instanceof Error ? requestError.message : "The product could not be created."
        );
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>New product restock</CardTitle>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Use the canonical Product pipeline, create a zero-stock inventory shell, then save a
                manual restock draft. Product quality and storefront review are never bypassed.
              </p>
            </div>
            <Button onClick={() => setOpen(true)} size="sm" type="button" variant="secondary">
              <Plus aria-hidden="true" className="h-4 w-4" />
              Add new product
            </Button>
          </div>
        </CardHeader>
        {notice ? (
          <CardContent className="pt-2">
            <Alert>
              <AlertTitle>Product and draft ready</AlertTitle>
              <AlertDescription>
                <div className="space-y-2">
                  <p>{notice}</p>
                  <Button onClick={onOpenOrders} size="sm" type="button" variant="secondary">
                    Open restock orders
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          </CardContent>
        ) : null}
      </Card>

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) closeDialog();
        }}
      >
        <DialogContent className="flex max-h-[90vh] w-[calc(100vw-32px)] max-w-[720px] flex-col overflow-hidden p-0">
          <DialogHeader className="border-b border-slate-200 px-6 py-5">
            <DialogTitle>Add new product to restock</DialogTitle>
            <DialogDescription>
              This uses the same catalog creation endpoint as Products. Physical stock remains zero
              until an accepted delivery is received.
            </DialogDescription>
          </DialogHeader>

          <form className="flex-1 overflow-y-auto px-6 py-5" onSubmit={handleSubmit}>
            <div className="space-y-4">
              {error ? (
                <Alert variant="destructive">
                  <AlertTitle>Quick add needs attention</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Product name">
                  <Input value={form.name} onChange={(event) => update("name", event.target.value)} />
                </Field>
                <Field label="SKU">
                  <Input value={form.sku} onChange={(event) => update("sku", event.target.value)} />
                </Field>
                <Field label="Manufacturer barcode (optional)">
                  <Input
                    value={form.barcode}
                    onChange={(event) => update("barcode", event.target.value)}
                  />
                </Field>
                <Field label="Category">
                  <Select
                    disabled={categoriesLoading || categories.length === 0}
                    value={form.categoryId}
                    onChange={(event) => update("categoryId", event.target.value)}
                  >
                    {categoriesLoading ? <option value="">Loading categories...</option> : null}
                    {!categoriesLoading && categories.length === 0 ? (
                      <option value="">No categories available</option>
                    ) : null}
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Unit">
                  <Select
                    value={form.unit}
                    onChange={(event) => update("unit", event.target.value as ProductUnit)}
                  >
                    {PRODUCT_UNITS.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Requested restock quantity">
                  <Input
                    inputMode="numeric"
                    min="1"
                    type="number"
                    value={form.requestedQuantity}
                    onChange={(event) => update("requestedQuantity", event.target.value)}
                  />
                </Field>
                <Field label="Cost price">
                  <Input
                    inputMode="decimal"
                    value={form.costPrice}
                    onChange={(event) => update("costPrice", event.target.value)}
                  />
                </Field>
                <Field label="Selling price">
                  <Input
                    inputMode="decimal"
                    value={form.sellingPrice}
                    onChange={(event) => update("sellingPrice", event.target.value)}
                  />
                </Field>
                <Field label="Reorder level">
                  <Input
                    inputMode="numeric"
                    min="0"
                    type="number"
                    value={form.reorderLevel}
                    onChange={(event) => update("reorderLevel", event.target.value)}
                  />
                </Field>
                <Field label="Target stock level">
                  <Input
                    inputMode="numeric"
                    min="0"
                    type="number"
                    value={form.targetStockLevel}
                    onChange={(event) => update("targetStockLevel", event.target.value)}
                  />
                </Field>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
                New products start as <strong>Needs review</strong> and hidden from the storefront.
                Complete image/quality review in Products when needed; the restock draft keeps the
                canonical product ID.
              </div>
            </div>

            <DialogFooter className="mt-6 px-0 pb-0">
              <Button disabled={saving} onClick={closeDialog} type="button" variant="secondary">
                Cancel
              </Button>
              <Button disabled={saving || categoriesLoading} type="submit">
                {saving ? (
                  <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
                ) : (
                  <PackagePlus aria-hidden="true" className="h-4 w-4" />
                )}
                {saving ? "Creating..." : "Create product & draft"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
