import { LoaderCircle, PackagePlus } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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

type ProductQuickAddForm = {
  barcode: string;
  categoryId: string;
  costPrice: string;
  name: string;
  reorderLevel: string;
  sellingPrice: string;
  sku: string;
  targetStockLevel: string;
  unit: ProductUnit;
};

const EMPTY_FORM: ProductQuickAddForm = {
  barcode: "",
  categoryId: "",
  costPrice: "",
  name: "",
  reorderLevel: "0",
  sellingPrice: "",
  sku: "",
  targetStockLevel: "0",
  unit: "PIECE"
};

export function ProductQuickAddDialog({
  open,
  initialIdentifier = "",
  onOpenChange,
  onCreated
}: {
  open: boolean;
  initialIdentifier?: string;
  onOpenChange: (open: boolean) => void;
  onCreated: (product: ProductRecord) => void;
}) {
  const [form, setForm] = useState<ProductQuickAddForm>(EMPTY_FORM);
  const [categories, setCategories] = useState<ProductCategorySummary[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm((current) => ({
      ...EMPTY_FORM,
      categoryId: current.categoryId || categories[0]?.id || "",
      sku: initialIdentifier.trim()
    }));
  }, [categories, initialIdentifier, open]);

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
        if (active)
          setError("Categories could not be loaded. Add the Product from Products instead.");
      })
      .finally(() => {
        if (active) setCategoriesLoading(false);
      });

    return () => {
      active = false;
    };
  }, [categories.length, categoriesLoading, open]);

  function update<K extends keyof ProductQuickAddForm>(key: K, value: ProductQuickAddForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setError(null);
  }

  function close() {
    if (saving) return;
    onOpenChange(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    if (!form.name.trim() || !form.sku.trim() || !form.categoryId) {
      setError("Product name, SKU, and category are required.");
      return;
    }
    if (!form.costPrice.trim() || !form.sellingPrice.trim()) {
      setError("Cost price and selling price are required by the Product pipeline.");
      return;
    }

    setSaving(true);
    setError(null);

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

      onCreated(response.data);
      onOpenChange(false);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "The Product could not be created."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && close()}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100vw-32px)] max-w-[720px] flex-col overflow-hidden p-0">
        <DialogHeader className="border-b border-slate-200 px-6 py-5">
          <DialogTitle>Quick add Product</DialogTitle>
          <DialogDescription>
            Create the canonical Product first. It starts with zero physical stock; this delivery
            session remains responsible for the actual stock receipt.
          </DialogDescription>
        </DialogHeader>

        <form className="flex-1 overflow-y-auto px-6 py-5" onSubmit={submit}>
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
              Quick-added Products are marked <strong>Needs review</strong> and hidden from the
              storefront. No physical Inventory is created until the delivery session completes.
            </div>
          </div>

          <DialogFooter className="mt-6 px-0 pb-0">
            <Button disabled={saving} onClick={close} type="button" variant="secondary">
              Cancel
            </Button>
            <Button disabled={saving || categoriesLoading} type="submit">
              {saving ? (
                <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
              ) : (
                <PackagePlus aria-hidden="true" className="h-4 w-4" />
              )}
              {saving ? "Creating..." : "Create Product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
