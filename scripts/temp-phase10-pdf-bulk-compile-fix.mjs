import fs from "node:fs";

const inventoryPath = "backend/src/services/inventoryImportService.ts";
let inventory = fs.readFileSync(inventoryPath, "utf8");
inventory = inventory.replaceAll('fileType: "csv" | "xlsx";', 'fileType: "csv" | "xlsx" | "pdf";');
fs.writeFileSync(inventoryPath, inventory);

const pdfPath = "backend/src/services/pdfDeliveryImportService.ts";
let pdf = fs.readFileSync(pdfPath, "utf8");
pdf = pdf.replace('    isEvalSupported: false,\n', "");
pdf = pdf.replace("    await document.destroy();", "    await loadingTask.destroy();");
fs.writeFileSync(pdfPath, pdf);

console.log("Phase 10 PDF compiler compatibility patch applied.");
