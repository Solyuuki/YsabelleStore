import { prisma } from "../database/prismaClient.js";
import {
  buildYsabelleInternalBarcode,
  YSABELLE_INTERNAL_BARCODE_SCHEME
} from "../utils/catalogBarcode.js";

export type CatalogInternalBarcodeBootstrapResult = {
  alreadyPresent: number;
  blocked: Array<{ code: string; sku: string; message: string }>;
  updated: number;
};

class InternalBarcodeBlocker extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "InternalBarcodeBlocker";
  }
}

export async function ensureInternalCatalogBarcodes(): Promise<CatalogInternalBarcodeBootstrapResult> {
  const products = await prisma.product.findMany({
    where: {
      barcode: null,
      recordSource: { not: "TEST_FIXTURE" }
    },
    orderBy: [{ sku: "asc" }, { id: "asc" }],
    select: {
      id: true,
      sku: true,
      name: true,
      barcode: true,
      recordSource: true
    }
  });

  let alreadyPresent = 0;
  let updated = 0;
  const blocked: CatalogInternalBarcodeBootstrapResult["blocked"] = [];

  for (const product of products) {
    try {
      const outcome = await applyInternalBarcode(product);
      if (outcome === "ALREADY_PRESENT") alreadyPresent += 1;
      if (outcome === "UPDATED") updated += 1;
    } catch (error) {
      if (error instanceof InternalBarcodeBlocker) {
        blocked.push({ code: error.code, sku: product.sku, message: error.message });
        continue;
      }

      throw error;
    }
  }

  return { alreadyPresent, blocked, updated };
}

async function applyInternalBarcode(product: {
  id: string;
  sku: string;
  name: string;
  barcode: string | null;
  recordSource: string;
}): Promise<"ALREADY_PRESENT" | "UPDATED"> {
  const barcode = buildYsabelleInternalBarcode({ id: product.id, sku: product.sku });

  return prisma.$transaction(async (tx) => {
    const current = await tx.product.findUnique({
      where: { id: product.id },
      select: { id: true, sku: true, name: true, barcode: true, recordSource: true }
    });

    if (!current) {
      throw new InternalBarcodeBlocker("PRODUCT_NOT_FOUND", `${product.sku} no longer exists.`);
    }

    if (current.sku !== product.sku || current.name !== product.name || current.recordSource !== product.recordSource) {
      throw new InternalBarcodeBlocker(
        "IDENTITY_CHANGED",
        `${product.sku} changed identity during internal barcode assignment.`
      );
    }

    if (current.barcode !== null) {
      if (current.barcode === barcode) return "ALREADY_PRESENT";
      throw new InternalBarcodeBlocker(
        "BARCODE_ALREADY_ASSIGNED",
        `${product.sku} received another barcode before internal assignment (${current.barcode}).`
      );
    }

    const collision = await tx.product.findFirst({
      where: {
        barcode,
        id: { not: current.id }
      },
      select: { id: true, sku: true }
    });

    if (collision) {
      throw new InternalBarcodeBlocker(
        "BARCODE_COLLISION",
        `${barcode} is already assigned to ${collision.sku} (${collision.id}).`
      );
    }

    const result = await tx.product.updateMany({
      where: {
        id: current.id,
        sku: current.sku,
        barcode: null
      },
      data: { barcode }
    });

    if (result.count !== 1) {
      throw new InternalBarcodeBlocker(
        "WRITE_MISMATCH",
        `${product.sku} internal barcode update affected ${result.count} rows.`
      );
    }

    await tx.catalogAuditLog.create({
      data: {
        action: "INTERNAL_BARCODE_ASSIGNED",
        automated: true,
        actor: "backend-startup",
        canonicalProductId: current.id,
        entityId: current.id,
        entityType: "PRODUCT",
        evidence: {
          barcode,
          barcodeSource: "INTERNAL",
          symbology: YSABELLE_INTERNAL_BARCODE_SCHEME,
          sku: current.sku
        },
        reason:
          "Assigned a deterministic YsabelleStore internal barcode because no barcode was present after verified external barcode enrichment."
      }
    });

    return "UPDATED";
  });
}
