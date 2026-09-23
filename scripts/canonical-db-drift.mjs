#!/usr/bin/env node
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { inspectCanonicalDbDrift, loadCanonicalSubset } from "./canonical-data-materializer.mjs";

export async function checkCanonicalDbDrift(prisma) {
  const { subset } = loadCanonicalSubset();
  return inspectCanonicalDbDrift(prisma, subset);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to prove canonical DB drift is fully represented.");
  }
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const findings = await checkCanonicalDbDrift(prisma);
    if (findings.length) {
      for (const finding of findings) {
        console.error("BLOCK: hidden canonical DB drift: " + finding);
      }
      throw new Error("Canonical DB differs from committed repository state.");
    }
    console.log("CANONICAL_DB_DRIFT=PASS");
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error("CANONICAL_DB_DRIFT=BLOCKED");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
