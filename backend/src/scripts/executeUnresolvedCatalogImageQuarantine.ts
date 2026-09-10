import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  executeUnresolvedCatalogImageQuarantine,
  type UnresolvedCatalogImageQuarantineClient
} from "../modules/catalog/catalog-unresolved-image-quarantine.js";
import { prisma } from "../database/prismaClient.js";

const APPLY_FLAG = "--apply-approved-unresolved-image-quarantine";

export async function runApprovedUnresolvedCatalogImageQuarantine(options: {
  client?: UnresolvedCatalogImageQuarantineClient;
  applyApprovedUnresolvedImageQuarantine: boolean;
}) {
  if (!options.applyApprovedUnresolvedImageQuarantine) {
    throw new Error(
      `CATALOG_UNRESOLVED_IMAGE_EXPLICIT_APPLY_REQUIRED: rerun with ${APPLY_FLAG} only after explicit approval.`
    );
  }

  const client = options.client ?? (prisma as unknown as UnresolvedCatalogImageQuarantineClient);
  return executeUnresolvedCatalogImageQuarantine({ client });
}

function isDirectExecution() {
  const entryPoint = process.argv[1];
  return (
    Boolean(entryPoint) &&
    path.resolve(entryPoint!) === path.resolve(fileURLToPath(import.meta.url))
  );
}

if (isDirectExecution()) {
  try {
    const result = await runApprovedUnresolvedCatalogImageQuarantine({
      applyApprovedUnresolvedImageQuarantine: process.argv.includes(APPLY_FLAG)
    });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}
