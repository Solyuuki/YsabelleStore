import { prisma } from "../database/prismaClient.js";

type CountRow = { count: bigint | number };
type DuplicateRow = { barcode: string; count: bigint | number };
type ProductRow = { id: string; sku: string; barcode: string | null };
type ProductGroupRow = { productId: string; count?: bigint | number };

function countValue(rows: CountRow[]) {
  return Number(rows[0]?.count ?? 0);
}

async function main() {
  const [products, productsWithBarcode, invalidLegacyBarcodes, duplicateLegacyBarcodes, tableRows] =
    await Promise.all([
      prisma.$queryRaw<CountRow[]>`SELECT COUNT(*) AS count FROM products`,
      prisma.$queryRaw<CountRow[]>`SELECT COUNT(*) AS count FROM products WHERE barcode IS NOT NULL`,
      prisma.$queryRaw<CountRow[]>`
        SELECT COUNT(*) AS count
        FROM products
        WHERE barcode IS NOT NULL
          AND (TRIM(barcode) = '' OR CHAR_LENGTH(barcode) > 80)
      `,
      prisma.$queryRaw<DuplicateRow[]>`
        SELECT barcode, COUNT(*) AS count
        FROM products
        WHERE barcode IS NOT NULL
        GROUP BY barcode
        HAVING COUNT(*) > 1
        LIMIT 20
      `,
      prisma.$queryRaw<CountRow[]>`
        SELECT COUNT(*) AS count
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
          AND table_name = 'product_barcodes'
      `
    ]);

  const productCount = countValue(products);
  const legacyBarcodeCount = countValue(productsWithBarcode);
  const invalidLegacyCount = countValue(invalidLegacyBarcodes);
  const productBarcodesTableExists = countValue(tableRows) === 1;

  console.info(`Products: ${productCount}`);
  console.info(`Legacy products.barcode values: ${legacyBarcodeCount}`);
  console.info(`Invalid legacy barcode values: ${invalidLegacyCount}`);
  console.info(`Duplicate legacy barcode groups: ${duplicateLegacyBarcodes.length}`);
  console.info(`product_barcodes table: ${productBarcodesTableExists ? "present" : "not present"}`);

  if (invalidLegacyCount > 0 || duplicateLegacyBarcodes.length > 0) {
    console.error("BARCODE_MIGRATION_DOCTOR=BLOCKED");
    console.error("Legacy barcode data must be corrected before the expand-first migration is applied.");
    process.exitCode = 1;
    return;
  }

  if (!productBarcodesTableExists) {
    console.info("BARCODE_MIGRATION_DOCTOR=READY_TO_MIGRATE");
    console.info("No destructive action was performed. The legacy barcode set is safe for backfill.");
    return;
  }

  const [
    registrationRows,
    duplicateRegistrations,
    orphanRegistrations,
    missingLegacyRegistrations,
    missingPrimaryRegistrations,
    multiplePrimaryRegistrations,
    primaryMirrorMismatches
  ] = await Promise.all([
    prisma.$queryRaw<CountRow[]>`SELECT COUNT(*) AS count FROM product_barcodes`,
    prisma.$queryRaw<DuplicateRow[]>`
      SELECT barcode, COUNT(*) AS count
      FROM product_barcodes
      GROUP BY barcode
      HAVING COUNT(*) > 1
      LIMIT 20
    `,
    prisma.$queryRaw<ProductRow[]>`
      SELECT pb.product_id AS id, '' AS sku, pb.barcode
      FROM product_barcodes pb
      LEFT JOIN products p ON p.id = pb.product_id
      WHERE p.id IS NULL
      LIMIT 20
    `,
    prisma.$queryRaw<ProductRow[]>`
      SELECT p.id, p.sku, p.barcode
      FROM products p
      LEFT JOIN product_barcodes pb
        ON pb.product_id = p.id
       AND pb.barcode = p.barcode
      WHERE p.barcode IS NOT NULL
        AND pb.id IS NULL
      LIMIT 20
    `,
    prisma.$queryRaw<ProductGroupRow[]>`
      SELECT product_id AS productId
      FROM product_barcodes
      GROUP BY product_id
      HAVING SUM(CASE WHEN is_primary = 1 THEN 1 ELSE 0 END) = 0
      LIMIT 20
    `,
    prisma.$queryRaw<ProductGroupRow[]>`
      SELECT product_id AS productId, COUNT(*) AS count
      FROM product_barcodes
      WHERE is_primary = 1
      GROUP BY product_id
      HAVING COUNT(*) > 1
      LIMIT 20
    `,
    prisma.$queryRaw<ProductRow[]>`
      SELECT p.id, p.sku, p.barcode
      FROM products p
      LEFT JOIN product_barcodes pb
        ON pb.product_id = p.id
       AND pb.is_primary = 1
       AND pb.barcode = p.barcode
      WHERE p.barcode IS NOT NULL
        AND pb.id IS NULL
      LIMIT 20
    `
  ]);

  const registrationCount = countValue(registrationRows);
  console.info(`Registered barcode identities: ${registrationCount}`);
  console.info(`Duplicate registered barcode groups: ${duplicateRegistrations.length}`);
  console.info(`Orphan barcode registrations: ${orphanRegistrations.length}`);
  console.info(`Legacy mirrors missing from identity table: ${missingLegacyRegistrations.length}`);
  console.info(`Products with barcode identities but no primary: ${missingPrimaryRegistrations.length}`);
  console.info(`Products with multiple primary identities: ${multiplePrimaryRegistrations.length}`);
  console.info(`Primary identity / products.barcode mismatches: ${primaryMirrorMismatches.length}`);

  const blockers =
    duplicateRegistrations.length +
    orphanRegistrations.length +
    missingLegacyRegistrations.length +
    missingPrimaryRegistrations.length +
    multiplePrimaryRegistrations.length +
    primaryMirrorMismatches.length;

  if (blockers > 0) {
    console.error("BARCODE_MIGRATION_DOCTOR=BLOCKED");
    console.error("Barcode identity integrity checks failed. Do not promote this database to staging.");
    process.exitCode = 1;
    return;
  }

  if (registrationCount < legacyBarcodeCount) {
    console.error("BARCODE_MIGRATION_DOCTOR=BLOCKED");
    console.error("The identity table contains fewer rows than the legacy barcode set.");
    process.exitCode = 1;
    return;
  }

  console.info("BARCODE_MIGRATION_DOCTOR=HEALTHY");
  console.info("Legacy primary mirrors and durable barcode identities are internally consistent.");
}

main()
  .catch((error) => {
    console.error("BARCODE_MIGRATION_DOCTOR=ERROR");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
