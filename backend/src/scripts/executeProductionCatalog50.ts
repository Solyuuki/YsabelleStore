import path from "node:path";
import { fileURLToPath } from "node:url";

import { prisma } from "../database/prismaClient.js";
import {
  buildProductionCatalog50Plan,
  executeProductionCatalog50,
  type ProductionCatalog50Client
} from "../modules/catalog/catalog-production-ready-50-execution.js";
import { assertProductionCatalog50Names } from "../modules/catalog/catalog-production-ready-50-name-guard.js";

const APPLY_FLAG = "--apply-production-catalog-50";

export async function runProductionCatalog50(options: {
  apply: boolean;
  client?: ProductionCatalog50Client;
}) {
  const client = options.client ?? (prisma as unknown as ProductionCatalog50Client);
  const plan = await buildProductionCatalog50Plan({ client });
  assertProductionCatalog50Names(plan);

  if (!options.apply) {
    return {
      mode: "PREVIEW" as const,
      summary: plan.summary,
      applyCommand:
        "npx tsx backend/src/scripts/executeProductionCatalog50.ts --apply-production-catalog-50"
    };
  }

  const result = await executeProductionCatalog50({ client });
  return {
    mode: "APPLIED" as const,
    summary: result.summary
  };
}

function isDirectExecution() {
  const entryPoint = process.argv[1];
  return Boolean(entryPoint) && path.resolve(entryPoint!) === path.resolve(fileURLToPath(import.meta.url));
}

if (isDirectExecution()) {
  try {
    const result = await runProductionCatalog50({
      apply: process.argv.includes(APPLY_FLAG)
    });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}
