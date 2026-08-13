import type {
  Category,
  Inventory,
  InventoryBatch,
  InventoryMovement,
  Product,
  User
} from "@prisma/client";

export type ProductWithRelations = Product & {
  category: Category;
  inventory: Inventory | null;
  duplicateCandidatesLeft?: Array<{ status: string }>;
  duplicateCandidatesRight?: Array<{ status: string }>;
};

export type InventoryWithRelations = Inventory & {
  product: Product & {
    category: Category;
    inventory?: Inventory | null;
    inventoryBatches?: InventoryBatch[];
  };
};

export type MovementWithRelations = InventoryMovement & {
  product: Product & {
    category: Category;
    inventory?: Inventory | null;
  };
  inventory: Inventory;
  performedBy: User | null;
};

export type ProductStatusView = "ACTIVE" | "INACTIVE" | "DISCONTINUED";
export type StockStatusView = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";

export type CategorySummary = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  recordSource: Category["recordSource"];
  dataQualityStatus: Category["dataQualityStatus"];
  isStorefrontVisible: boolean;
};

export type InventorySummary = {
  inventoryId: string;
  currentQuantity: number;
  availableQuantity: number;
  stockStatus: StockStatusView;
  lastStockUpdatedAt: Date | null;
  version: number;
  batchCount: number;
  nearestExpiry: Date | null;
};

export type ProductSummary = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  description: string | null;
  imageUrl: string | null;
  brand: string | null;
  variant: string | null;
  sizeValue: string | null;
  sizeUnit: Product["sizeUnit"];
  unit: Product["unit"];
  costPrice: string | null;
  sellingPrice: string;
  reorderLevel: number;
  targetStockLevel: number;
  status: ProductStatusView;
  isActive: boolean;
  recordSource: Product["recordSource"];
  dataQualityStatus: Product["dataQualityStatus"];
  isStorefrontVisible: boolean;
  qualityWarnings: string[];
  category: CategorySummary;
  inventory: InventorySummary;
  createdAt: Date;
  updatedAt: Date;
};

export type InventorySummaryRow = InventorySummary & {
  productId: string;
  productName: string;
  sku: string;
  barcode: string | null;
  description: string | null;
  unit: Product["unit"];
  costPrice: string | null;
  sellingPrice: string;
  reorderLevel: number;
  targetStockLevel: number;
  status: ProductStatusView;
  isActive: boolean;
  category: CategorySummary;
  createdAt: Date;
  updatedAt: Date;
  availability: boolean;
};

export type MovementSummary = {
  id: string;
  productId: string;
  inventoryId: string;
  type: string;
  quantity: number;
  quantityBefore: number;
  quantityAfter: number;
  reason: string | null;
  referenceType: string | null;
  referenceId: string | null;
  performedBy: {
    id: string;
    name: string;
    email: string;
  } | null;
  createdAt: Date;
};

export type PosLookupSummary = {
  productId: string;
  productName: string;
  sku: string;
  barcode: string | null;
  sellingPrice: string;
  currentStock: number;
  available: boolean;
  isActive: boolean;
  stockStatus: StockStatusView;
  category: CategorySummary;
};

export function computeStockStatus(quantityOnHand: number, reorderLevel: number): StockStatusView {
  if (quantityOnHand <= 0) {
    return "OUT_OF_STOCK";
  }

  if (quantityOnHand <= reorderLevel) {
    return "LOW_STOCK";
  }

  return "IN_STOCK";
}

export function serializeCategory(category: Category): CategorySummary {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description ?? null,
    isActive: category.isActive,
    recordSource: category.recordSource,
    dataQualityStatus: category.dataQualityStatus,
    isStorefrontVisible: category.isStorefrontVisible
  };
}

export function serializeProduct(product: ProductWithRelations): ProductSummary {
  const inventory = product.inventory ?? null;
  const quantityOnHand = inventory?.quantityOnHand ?? 0;
  const stockStatus = computeStockStatus(quantityOnHand, product.reorderLevel);
  const hasUnresolvedDuplicate = [
    ...(product.duplicateCandidatesLeft ?? []),
    ...(product.duplicateCandidatesRight ?? [])
  ].some((candidate) => ["PENDING", "CONFIRMED"].includes(candidate.status));
  const qualityWarnings = [
    ...(product.recordSource === "TEST_FIXTURE" ? ["TEST_FIXTURE"] : []),
    ...(product.dataQualityStatus === "NEEDS_REVIEW" ? ["CATALOG_REVIEW_REQUIRED"] : []),
    ...(product.dataQualityStatus === "REJECTED" ? ["CATALOG_REJECTED"] : []),
    ...(hasUnresolvedDuplicate ? ["UNRESOLVED_DUPLICATE"] : []),
    ...(!product.isStorefrontVisible ? ["STOREFRONT_HIDDEN"] : [])
  ];

  return {
    id: product.id,
    name: product.name,
    sku: product.sku,
    barcode: product.barcode ?? null,
    description: product.description ?? null,
    imageUrl: product.imageUrl ?? null,
    brand: product.brand ?? null,
    variant: product.variant ?? null,
    sizeValue: product.sizeValue?.toString() ?? null,
    sizeUnit: product.sizeUnit ?? null,
    unit: product.unit,
    costPrice: product.costPrice?.toString() ?? null,
    sellingPrice: product.sellingPrice.toString(),
    reorderLevel: product.reorderLevel,
    targetStockLevel: product.targetStockLevel,
    status: product.status,
    isActive: product.status === "ACTIVE",
    recordSource: product.recordSource,
    dataQualityStatus: product.dataQualityStatus,
    isStorefrontVisible: product.isStorefrontVisible,
    qualityWarnings,
    category: serializeCategory(product.category),
    inventory: {
      inventoryId: inventory?.id ?? "",
      currentQuantity: quantityOnHand,
      availableQuantity: quantityOnHand,
      stockStatus,
      lastStockUpdatedAt: inventory?.lastStockUpdatedAt ?? null,
      version: inventory?.version ?? 0,
      batchCount: 0,
      nearestExpiry: null
    },
    createdAt: product.createdAt,
    updatedAt: product.updatedAt
  };
}

export function serializeInventory(inventory: InventoryWithRelations): InventorySummaryRow {
  const product = inventory.product;
  const stockStatus = computeStockStatus(inventory.quantityOnHand, product.reorderLevel);
  const activeBatches = product.inventoryBatches ?? [];
  const expiries = activeBatches
    .map((batch) => batch.expiresAt)
    .filter((expiry): expiry is Date => expiry !== null)
    .sort((left, right) => left.getTime() - right.getTime());

  return {
    inventoryId: inventory.id,
    currentQuantity: inventory.quantityOnHand,
    availableQuantity: inventory.quantityOnHand,
    stockStatus,
    lastStockUpdatedAt: inventory.lastStockUpdatedAt ?? null,
    version: inventory.version,
    batchCount: activeBatches.length,
    nearestExpiry: expiries[0] ?? null,
    productId: product.id,
    productName: product.name,
    sku: product.sku,
    barcode: product.barcode ?? null,
    description: product.description ?? null,
    unit: product.unit,
    costPrice: product.costPrice?.toString() ?? null,
    sellingPrice: product.sellingPrice.toString(),
    reorderLevel: product.reorderLevel,
    targetStockLevel: product.targetStockLevel,
    status: product.status,
    isActive: product.status === "ACTIVE",
    category: serializeCategory(product.category),
    createdAt: inventory.createdAt,
    updatedAt: inventory.updatedAt,
    availability: product.status === "ACTIVE" && inventory.quantityOnHand > 0
  };
}

export function serializeMovement(movement: MovementWithRelations): MovementSummary {
  return {
    id: movement.id,
    productId: movement.productId,
    inventoryId: movement.inventoryId,
    type: movement.type,
    quantity: movement.quantity,
    quantityBefore: movement.quantityBefore,
    quantityAfter: movement.quantityAfter,
    reason: movement.reason ?? null,
    referenceType: movement.referenceType ?? null,
    referenceId: movement.referenceId ?? null,
    performedBy: movement.performedBy
      ? {
          id: movement.performedBy.id,
          name: movement.performedBy.name,
          email: movement.performedBy.email
        }
      : null,
    createdAt: movement.createdAt
  };
}

export function serializePosLookup(product: ProductWithRelations): PosLookupSummary {
  const inventory = product.inventory ?? null;
  const currentStock = inventory?.quantityOnHand ?? 0;

  return {
    productId: product.id,
    productName: product.name,
    sku: product.sku,
    barcode: product.barcode ?? null,
    sellingPrice: product.sellingPrice.toString(),
    currentStock,
    available: product.status === "ACTIVE" && currentStock > 0,
    isActive: product.status === "ACTIVE",
    stockStatus: computeStockStatus(currentStock, product.reorderLevel),
    category: serializeCategory(product.category)
  };
}
