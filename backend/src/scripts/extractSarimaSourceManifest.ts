import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildSarimaSourceManifest,
  type SarimaSourceIdentity
} from "../modules/catalog/sarima-source-manifest.js";
import { loadHistoricalSalesData } from "../modules/forecasting/historical-sales.service.js";
import { resolveRepositoryPath } from "../modules/forecasting/repository-paths.js";

const DEFAULT_OUTPUT_PATH = resolveRepositoryPath(
  "artifacts/catalog/phase9/sarima-source-manifest.json"
);

export async function extractSarimaSourceManifest(
  outputPath = DEFAULT_OUTPUT_PATH
): Promise<SarimaSourceIdentity[]> {
  const historicalSales = await loadHistoricalSalesData();
  const manifest = buildSarimaSourceManifest(historicalSales);

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  return manifest;
}

function isDirectExecution() {
  const entryPoint = process.argv[1];

  if (!entryPoint) {
    return false;
  }

  return path.resolve(entryPoint) === path.resolve(fileURLToPath(import.meta.url));
}

if (isDirectExecution()) {
  const outputPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : DEFAULT_OUTPUT_PATH;
  const manifest = await extractSarimaSourceManifest(outputPath);

  console.log(
    JSON.stringify(
      {
        firstProductCode: manifest[0]?.productCode ?? null,
        lastProductCode: manifest.at(-1)?.productCode ?? null,
        outputPath,
        products: manifest.length
      },
      null,
      2
    )
  );
}
