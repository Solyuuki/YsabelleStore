import { downloadProductImportTemplate, fetchCategories } from "@/services/catalogApi";

type ZipEntry = {
  name: string;
  bytes: Uint8Array;
  isDirectory?: boolean;
};

const encoder = new TextEncoder();

// Store-only ZIP writer: templates are small UTF-8 text files, so compression
// and a runtime ZIP dependency are unnecessary. Files use CRC-32 and UTF-8 names.
function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const value of bytes) {
    crc ^= value;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeU16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true);
}

function writeU32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value >>> 0, true);
}

export function createProductTemplateZip(entries: ZipEntry[]): Uint8Array {
  if (entries.length === 0 || entries.length > 100) {
    throw new Error("Product template ZIP must contain between 1 and 100 entries.");
  }

  const files = entries.map((entry) => ({
    ...entry,
    nameBytes: encoder.encode(entry.name),
    crc: crc32(entry.bytes)
  }));
  const localBytes = files.reduce(
    (total, file) => total + 30 + file.nameBytes.length + file.bytes.length,
    0
  );
  const centralBytes = files.reduce((total, file) => total + 46 + file.nameBytes.length, 0);
  const archive = new Uint8Array(localBytes + centralBytes + 22);
  const view = new DataView(archive.buffer);
  let cursor = 0;
  const offsets: number[] = [];

  for (const file of files) {
    offsets.push(cursor);
    writeU32(view, cursor, 0x04034b50);
    writeU16(view, cursor + 4, 20);
    writeU16(view, cursor + 6, 0x0800); // UTF-8 filenames
    writeU16(view, cursor + 8, 0); // stored, not compressed
    writeU32(view, cursor + 14, file.crc);
    writeU32(view, cursor + 18, file.bytes.length);
    writeU32(view, cursor + 22, file.bytes.length);
    writeU16(view, cursor + 26, file.nameBytes.length);
    cursor += 30;
    archive.set(file.nameBytes, cursor);
    cursor += file.nameBytes.length;
    archive.set(file.bytes, cursor);
    cursor += file.bytes.length;
  }

  const centralStart = cursor;
  files.forEach((file, index) => {
    writeU32(view, cursor, 0x02014b50);
    writeU16(view, cursor + 4, 20);
    writeU16(view, cursor + 6, 20);
    writeU16(view, cursor + 8, 0x0800);
    writeU16(view, cursor + 10, 0);
    writeU32(view, cursor + 16, file.crc);
    writeU32(view, cursor + 20, file.bytes.length);
    writeU32(view, cursor + 24, file.bytes.length);
    writeU16(view, cursor + 28, file.nameBytes.length);
    writeU32(view, cursor + 38, file.isDirectory ? 0x10 << 16 : 0);
    writeU32(view, cursor + 42, offsets[index]!);
    cursor += 46;
    archive.set(file.nameBytes, cursor);
    cursor += file.nameBytes.length;
  });

  const centralSize = cursor - centralStart;
  writeU32(view, cursor, 0x06054b50);
  writeU16(view, cursor + 8, files.length);
  writeU16(view, cursor + 10, files.length);
  writeU32(view, cursor + 12, centralSize);
  writeU32(view, cursor + 16, centralStart);
  return archive;
}

export async function downloadProductPackageTemplate(): Promise<void> {
  // The canonical header comes from the backend validator; category options
  // come from the current database rather than the storefront taxonomy.
  const [header, categories] = await Promise.all([downloadProductImportTemplate(), fetchCategories()]);
  if (!header.trim() || !header.includes("initialStock") || !header.includes("sku")) {
    throw new Error("The current product import schema could not be loaded.");
  }

  const categoryLines = categories
    .filter((category) => category.isActive && category.dataQualityStatus !== "REJECTED")
    .map((category) => `- ${category.slug}  (${category.name})`)
    .sort();
  if (categoryLines.length === 0) {
    throw new Error("No active catalog categories were found. Set up categories before importing.");
  }

  const readme = [
    "YSABELLE STORE - PRODUCT PACKAGE IMPORT TEMPLATE",
    "",
    "This is a BLANK reusable template, NOT the 50-product QA data.",
    "The products.csv column order is generated from the live backend importer.",
    "No example product, fake barcode, or opening stock is included.",
    "",
    "1. Extract this ZIP and open products.csv in a spreadsheet editor.",
    "2. Keep the first row (column names). Add one row per NEW product starting on row 2.",
    "3. Required: name, sku, category, unit, costPrice, sellingPrice, reorderLevel, initialStock.",
    "4. Category must be an existing category NAME or SLUG from the current database.",
    "5. Use original manufacturer barcode only when verified. Leave blank if unavailable.",
    "   The catalog may assign a system-managed barcode; do not invent manufacturer GTINs.",
    "6. Valid unit: PIECE, PACK, BOX, BOTTLE, SACHET, KILOGRAM, GRAM, LITER, MILLILITER.",
    "7. Valid sizeUnit: MILLILITER, LITER, GRAM, KILOGRAM, PIECE.",
    "8. Valid status: ACTIVE, INACTIVE, DISCONTINUED.",
    "9. Prices are numeric. Initial stock and reorder level are nonnegative integers.",
    "10. Optional photos go in images/<SKU>.jpg (or .jpeg, .png, .webp).",
    "    Use authentic exact-product packaging images; the CIQE gate will validate them.",
    "11. Re-ZIP products.csv and images/ into ONE .zip, then upload it to Import Products.",
    "12. Use Scan package and resolve ALL blocking errors before confirming import.",
    "    An unchanged blank template cannot be imported until product rows are filled.",
    "",
    "ACTIVE CATEGORIES WHEN THIS TEMPLATE WAS DOWNLOADED:",
    ...categoryLines,
    "",
    "Categories can change. Download a fresh template if categories have been updated.",
    ""
  ].join("\r\n");

  const zip = createProductTemplateZip([
    { name: "products.csv", bytes: encoder.encode(`\uFEFF${header.trim()}\r\n`) },
    { name: "images/", bytes: new Uint8Array(), isDirectory: true },
    { name: "README-FIRST.txt", bytes: encoder.encode(readme) }
  ]);
  const url = URL.createObjectURL(
    new Blob([zip.buffer as ArrayBuffer], {
      type: "application/zip"
    })
  );
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "YSABELLE_PRODUCT_IMPORT_TEMPLATE.zip";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    // The click schedules a browser download; revoke on the next task.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
