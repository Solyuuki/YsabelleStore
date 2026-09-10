import {
  CatalogRecordSource,
  Prisma,
  ProductAliasType,
  ProductBarcodeSource,
  ProductBarcodeType,
  type ProductBarcode
} from "@prisma/client";

import { prisma } from "../database/prismaClient.js";
import { HttpError } from "../utils/httpError.js";
import {
  buildYsabelleInternalBarcode,
  isYsabelleInternalBarcode
} from "../utils/catalogBarcode.js";
import { normalizeCode } from "../utils/normalizers.js";

const MAX_BARCODE_LENGTH = 80;
const MAX_INTERNAL_BARCODE_ATTEMPTS = 100;

type BarcodeDb = Pick<
  Prisma.TransactionClient,
  "catalogAuditLog" | "product" | "productAlias" | "productBarcode"
>;

export type ProductBarcodeIdentity = {
  id: string;
  productId: string;
  barcode: string;
  type: ProductBarcodeType;
  isPrimary: boolean;
  source: ProductBarcodeSource;
  registeredById: string | null;
  sourceReference: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ProductBarcodeResolution = {
  found: boolean;
  barcode: string;
  product: {
    id: string;
    name: string;
    sku: string;
    primaryBarcode: string | null;
  } | null;
  registration: ProductBarcodeIdentity | null;
};

type RegisterBarcodeInput = {
  productId: string;
  barcode: string;
  source: ProductBarcodeSource;
  registeredById?: string | null;
  sourceReference?: string | null;
  type?: ProductBarcodeType;
  makePrimary?: boolean;
  automated?: boolean;
};

type ReceivingEnrollmentInput = {
  productId: string;
  barcode: string;
  confirmed: boolean;
  registeredById?: string | null;
  sourceReference?: string | null;
};

function barcodeIdentity(record: ProductBarcode): ProductBarcodeIdentity {
  return {
    id: record.id,
    productId: record.productId,
    barcode: record.barcode,
    type: record.type,
    isPrimary: record.isPrimary,
    source: record.source,
    registeredById: record.registeredById,
    sourceReference: record.sourceReference,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

export function normalizeProductBarcode(value: string) {
  const normalized = normalizeCode(value);
  if (!normalized) {
    throw new HttpError(400, "Barcode is required.", { code: "PRODUCT_BARCODE_REQUIRED" });
  }
  if (normalized.length > MAX_BARCODE_LENGTH) {
    throw new HttpError(400, "Barcode exceeds the supported length.", {
      code: "PRODUCT_BARCODE_TOO_LONG",
      details: { maxLength: MAX_BARCODE_LENGTH }
    });
  }
  return normalized;
}

export function classifyProductBarcode(value: string): ProductBarcodeType {
  return isYsabelleInternalBarcode(value)
    ? ProductBarcodeType.INTERNAL
    : ProductBarcodeType.MANUFACTURER;
}

function recordSourceForBarcodeSource(source: ProductBarcodeSource): CatalogRecordSource {
  switch (source) {
    case ProductBarcodeSource.IMPORT:
      return CatalogRecordSource.IMPORT;
    case ProductBarcodeSource.SYSTEM_INTERNAL:
      return CatalogRecordSource.INTERNAL;
    default:
      return CatalogRecordSource.CATALOG;
  }
}

function assertRegistrationTypeAllowed(type: ProductBarcodeType, source: ProductBarcodeSource) {
  if (
    type === ProductBarcodeType.INTERNAL &&
    source !== ProductBarcodeSource.SYSTEM_INTERNAL &&
    source !== ProductBarcodeSource.MIGRATION
  ) {
    throw new HttpError(422, "YSB internal barcodes are system-managed and cannot be enrolled manually.", {
      code: "PRODUCT_INTERNAL_BARCODE_RESERVED"
    });
  }
}

async function findBarcodeWithProduct(db: BarcodeDb, barcode: string) {
  return db.productBarcode.findUnique({
    where: { barcode },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          barcode: true
        }
      }
    }
  });
}

function barcodeConflict(existing: Awaited<ReturnType<typeof findBarcodeWithProduct>>, requestedProductId: string) {
  if (!existing || existing.productId === requestedProductId) return;
  throw new HttpError(409, "Barcode is already assigned to another product.", {
    code: "PRODUCT_BARCODE_CONFLICT",
    details: {
      barcode: existing.barcode,
      existingProductId: existing.product.id,
      existingProductName: existing.product.name,
      existingProductSku: existing.product.sku,
      requestedProductId
    }
  });
}

async function upsertCompatibilityAlias(
  db: BarcodeDb,
  input: {
    productId: string;
    barcode: string;
    source: ProductBarcodeSource;
    sourceReference?: string | null;
  }
) {
  await db.productAlias.upsert({
    where: {
      canonicalProductId_type_normalizedValue: {
        canonicalProductId: input.productId,
        type: ProductAliasType.BARCODE,
        normalizedValue: input.barcode.toLowerCase()
      }
    },
    create: {
      canonicalProductId: input.productId,
      type: ProductAliasType.BARCODE,
      value: input.barcode,
      normalizedValue: input.barcode.toLowerCase(),
      recordSource: recordSourceForBarcodeSource(input.source),
      sourceReference: input.sourceReference ?? undefined,
      evidence: {
        barcodeIdentity: true,
        source: input.source
      }
    },
    update: {
      value: input.barcode,
      sourceReference: input.sourceReference ?? undefined
    }
  });
}

async function writeBarcodeAudit(
  db: BarcodeDb,
  input: {
    record: ProductBarcode;
    action: string;
    reason: string;
    actor?: string | null;
    automated?: boolean;
    evidence?: Prisma.InputJsonValue;
  }
) {
  await db.catalogAuditLog.create({
    data: {
      entityType: "ProductBarcode",
      entityId: input.record.id,
      canonicalProductId: input.record.productId,
      action: input.action,
      reason: input.reason,
      actor: input.actor ?? undefined,
      automated: input.automated ?? false,
      evidence: {
        barcode: input.record.barcode,
        type: input.record.type,
        source: input.record.source,
        isPrimary: input.record.isPrimary,
        sourceReference: input.record.sourceReference,
        ...(input.evidence && typeof input.evidence === "object" ? input.evidence : {})
      }
    }
  });
}

async function promoteBarcodeInTransaction(
  db: BarcodeDb,
  record: ProductBarcode,
  actor?: string | null,
  automated = false
) {
  const product = await db.product.findUnique({
    where: { id: record.productId },
    select: { barcode: true }
  });
  if (!product) {
    throw new HttpError(404, "Product not found.", { code: "PRODUCT_NOT_FOUND" });
  }

  const previousPrimary = await db.productBarcode.findFirst({
    where: { productId: record.productId, isPrimary: true },
    orderBy: { createdAt: "asc" }
  });

  await db.productBarcode.updateMany({
    where: {
      productId: record.productId,
      isPrimary: true,
      NOT: { id: record.id }
    },
    data: { isPrimary: false }
  });

  const promoted = record.isPrimary
    ? record
    : await db.productBarcode.update({
        where: { id: record.id },
        data: { isPrimary: true }
      });

  if (product.barcode !== promoted.barcode) {
    await db.product.update({
      where: { id: promoted.productId },
      data: { barcode: promoted.barcode }
    });
  }

  if (!previousPrimary || previousPrimary.id !== promoted.id || product.barcode !== promoted.barcode) {
    await writeBarcodeAudit(db, {
      record: promoted,
      action: "PRODUCT_BARCODE_PRIMARY_CHANGED",
      reason: "Primary product barcode changed while preserving all registered barcode aliases.",
      actor,
      automated,
      evidence: {
        previousBarcode: previousPrimary?.barcode ?? product.barcode,
        primaryBarcode: promoted.barcode
      }
    });
  }

  return promoted;
}

export async function registerProductBarcodeInTransaction(
  db: BarcodeDb,
  input: RegisterBarcodeInput
): Promise<{ record: ProductBarcodeIdentity; created: boolean; primaryChanged: boolean }> {
  const barcode = normalizeProductBarcode(input.barcode);
  const type = input.type ?? classifyProductBarcode(barcode);
  assertRegistrationTypeAllowed(type, input.source);

  const product = await db.product.findUnique({
    where: { id: input.productId },
    select: { id: true, name: true, sku: true, barcode: true }
  });
  if (!product) {
    throw new HttpError(404, "Product not found.", { code: "PRODUCT_NOT_FOUND" });
  }

  let existing = await findBarcodeWithProduct(db, barcode);
  barcodeConflict(existing, input.productId);

  const currentPrimary = await db.productBarcode.findFirst({
    where: { productId: input.productId, isPrimary: true },
    orderBy: { createdAt: "asc" }
  });
  const existingManufacturer = await db.productBarcode.findFirst({
    where: {
      productId: input.productId,
      type: ProductBarcodeType.MANUFACTURER
    },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }]
  });

  const shouldBecomePrimary =
    input.makePrimary === true ||
    (!currentPrimary && type === ProductBarcodeType.MANUFACTURER) ||
    (!currentPrimary && type === ProductBarcodeType.INTERNAL && !existingManufacturer) ||
    (input.makePrimary !== false &&
      type === ProductBarcodeType.MANUFACTURER &&
      currentPrimary?.type === ProductBarcodeType.INTERNAL);

  let created = false;
  if (!existing) {
    try {
      existing = await db.productBarcode.create({
        data: {
          productId: input.productId,
          barcode,
          type,
          isPrimary: false,
          source: input.source,
          registeredById: input.registeredById ?? undefined,
          sourceReference: input.sourceReference ?? undefined
        },
        include: {
          product: {
            select: { id: true, name: true, sku: true, barcode: true }
          }
        }
      });
      created = true;
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
        throw error;
      }
      existing = await findBarcodeWithProduct(db, barcode);
      barcodeConflict(existing, input.productId);
      if (!existing) throw error;
    }
  }

  await upsertCompatibilityAlias(db, {
    productId: input.productId,
    barcode,
    source: input.source,
    sourceReference: input.sourceReference
  });

  if (created) {
    await writeBarcodeAudit(db, {
      record: existing,
      action: "PRODUCT_BARCODE_REGISTERED",
      reason: "Barcode registered as a durable identifier for the canonical product.",
      actor: input.registeredById,
      automated: input.automated,
      evidence: { requestedPrimary: input.makePrimary ?? null }
    });
  }

  let primaryChanged = false;
  if (shouldBecomePrimary) {
    const beforePrimaryId = currentPrimary?.id ?? null;
    const beforeMirror = product.barcode;
    existing = {
      ...existing,
      ...(await promoteBarcodeInTransaction(db, existing, input.registeredById, input.automated))
    };
    primaryChanged = beforePrimaryId !== existing.id || beforeMirror !== existing.barcode;
  } else if (!currentPrimary && existingManufacturer && existingManufacturer.id !== existing.id) {
    await promoteBarcodeInTransaction(db, existingManufacturer, input.registeredById, true);
    primaryChanged = true;
  }

  return {
    record: barcodeIdentity(existing),
    created,
    primaryChanged
  };
}

export async function registerProductBarcode(input: RegisterBarcodeInput) {
  return prisma.$transaction((tx) => registerProductBarcodeInTransaction(tx, input));
}

export async function resolveProductBarcode(barcodeInput: string): Promise<ProductBarcodeResolution> {
  const barcode = normalizeProductBarcode(barcodeInput);
  const registered = await prisma.productBarcode.findUnique({
    where: { barcode },
    include: {
      product: {
        select: { id: true, name: true, sku: true, barcode: true }
      }
    }
  });

  if (registered) {
    return {
      found: true,
      barcode,
      product: {
        id: registered.product.id,
        name: registered.product.name,
        sku: registered.product.sku,
        primaryBarcode: registered.product.barcode
      },
      registration: barcodeIdentity(registered)
    };
  }

  // Expand/migrate compatibility: recognize the legacy primary mirror and self-heal the alias table.
  const legacy = await prisma.product.findUnique({
    where: { barcode },
    select: { id: true, name: true, sku: true, barcode: true }
  });
  if (!legacy) {
    return { found: false, barcode, product: null, registration: null };
  }

  const synced = await registerProductBarcode({
    productId: legacy.id,
    barcode,
    source: ProductBarcodeSource.MIGRATION,
    type: classifyProductBarcode(barcode),
    makePrimary: true,
    automated: true,
    sourceReference: "legacy-primary-self-heal"
  });

  return {
    found: true,
    barcode,
    product: {
      id: legacy.id,
      name: legacy.name,
      sku: legacy.sku,
      primaryBarcode: barcode
    },
    registration: synced.record
  };
}

export async function listProductBarcodes(productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true }
  });
  if (!product) {
    throw new HttpError(404, "Product not found.", { code: "PRODUCT_NOT_FOUND" });
  }

  const records = await prisma.productBarcode.findMany({
    where: { productId },
    orderBy: [{ isPrimary: "desc" }, { type: "asc" }, { createdAt: "asc" }]
  });
  return records.map(barcodeIdentity);
}

export async function setPrimaryProductBarcode(input: {
  productId: string;
  barcodeId: string;
  actorId?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const record = await tx.productBarcode.findUnique({ where: { id: input.barcodeId } });
    if (!record || record.productId !== input.productId) {
      throw new HttpError(404, "Product barcode not found.", {
        code: "PRODUCT_BARCODE_NOT_FOUND"
      });
    }
    const promoted = await promoteBarcodeInTransaction(tx, record, input.actorId, false);
    return barcodeIdentity(promoted);
  });
}

export async function enrollReceivingBarcodeInTransaction(
  db: BarcodeDb,
  input: ReceivingEnrollmentInput
) {
  const barcode = normalizeProductBarcode(input.barcode);
  const existing = await findBarcodeWithProduct(db, barcode);
  barcodeConflict(existing, input.productId);

  if (existing) {
    return { record: barcodeIdentity(existing), created: false, confirmationRequired: false };
  }

  if (isYsabelleInternalBarcode(barcode)) {
    throw new HttpError(422, "Unknown YSB internal barcode cannot be enrolled from receiving.", {
      code: "PRODUCT_INTERNAL_BARCODE_RESERVED"
    });
  }

  if (!input.confirmed) {
    const product = await db.product.findUnique({
      where: { id: input.productId },
      select: { id: true, name: true, sku: true }
    });
    if (!product) {
      throw new HttpError(404, "Product not found.", { code: "PRODUCT_NOT_FOUND" });
    }
    throw new HttpError(409, "New barcode confirmation is required before registration.", {
      code: "PRODUCT_BARCODE_CONFIRMATION_REQUIRED",
      details: {
        barcode,
        productId: product.id,
        productName: product.name,
        productSku: product.sku
      }
    });
  }

  const registered = await registerProductBarcodeInTransaction(db, {
    productId: input.productId,
    barcode,
    source: ProductBarcodeSource.RECEIVING_SCAN,
    type: ProductBarcodeType.MANUFACTURER,
    registeredById: input.registeredById,
    sourceReference: input.sourceReference,
    makePrimary: undefined
  });

  return { ...registered, confirmationRequired: false };
}

export async function enrollReceivingBarcode(input: ReceivingEnrollmentInput) {
  return prisma.$transaction((tx) => enrollReceivingBarcodeInTransaction(tx, input));
}

export async function ensureInternalBarcodeForProductInTransaction(
  db: BarcodeDb,
  input: {
    productId: string;
    registeredById?: string | null;
    sourceReference?: string | null;
  }
) {
  const manufacturer = await db.productBarcode.findFirst({
    where: { productId: input.productId, type: ProductBarcodeType.MANUFACTURER },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }]
  });
  if (manufacturer) {
    return barcodeIdentity(manufacturer);
  }

  const existingInternal = await db.productBarcode.findFirst({
    where: { productId: input.productId, type: ProductBarcodeType.INTERNAL },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }]
  });
  if (existingInternal) {
    if (!existingInternal.isPrimary) {
      return barcodeIdentity(
        await promoteBarcodeInTransaction(db, existingInternal, input.registeredById, true)
      );
    }
    return barcodeIdentity(existingInternal);
  }

  const product = await db.product.findUnique({
    where: { id: input.productId },
    select: { id: true, sku: true, barcode: true }
  });
  if (!product) {
    throw new HttpError(404, "Product not found.", { code: "PRODUCT_NOT_FOUND" });
  }

  if (product.barcode && isYsabelleInternalBarcode(product.barcode)) {
    return (
      await registerProductBarcodeInTransaction(db, {
        productId: product.id,
        barcode: product.barcode,
        source: ProductBarcodeSource.SYSTEM_INTERNAL,
        type: ProductBarcodeType.INTERNAL,
        makePrimary: true,
        registeredById: input.registeredById,
        sourceReference: input.sourceReference,
        automated: true
      })
    ).record;
  }

  for (let attempt = 0; attempt < MAX_INTERNAL_BARCODE_ATTEMPTS; attempt += 1) {
    const candidate = buildYsabelleInternalBarcode({
      id: product.id,
      sku: product.sku,
      attempt
    });
    const [aliasCollision, mirrorCollision] = await Promise.all([
      db.productBarcode.findUnique({ where: { barcode: candidate }, select: { productId: true } }),
      db.product.findUnique({ where: { barcode: candidate }, select: { id: true } })
    ]);
    if (
      (aliasCollision && aliasCollision.productId !== product.id) ||
      (mirrorCollision && mirrorCollision.id !== product.id)
    ) {
      continue;
    }

    return (
      await registerProductBarcodeInTransaction(db, {
        productId: product.id,
        barcode: candidate,
        source: ProductBarcodeSource.SYSTEM_INTERNAL,
        type: ProductBarcodeType.INTERNAL,
        makePrimary: true,
        registeredById: input.registeredById,
        sourceReference: input.sourceReference,
        automated: true
      })
    ).record;
  }

  throw new HttpError(500, "Unable to allocate a unique internal product barcode.", {
    code: "PRODUCT_INTERNAL_BARCODE_ALLOCATION_FAILED"
  });
}

export async function synchronizeLegacyPrimaryBarcodes() {
  const products = await prisma.product.findMany({
    where: { barcode: { not: null } },
    select: { id: true, barcode: true },
    orderBy: { id: "asc" }
  });

  let synchronized = 0;
  for (const product of products) {
    if (!product.barcode) continue;
    const result = await registerProductBarcode({
      productId: product.id,
      barcode: product.barcode,
      source: ProductBarcodeSource.MIGRATION,
      type: classifyProductBarcode(product.barcode),
      makePrimary: true,
      automated: true,
      sourceReference: "startup-legacy-primary-sync"
    });
    if (result.created || result.primaryChanged) synchronized += 1;
  }

  return { scanned: products.length, synchronized };
}
