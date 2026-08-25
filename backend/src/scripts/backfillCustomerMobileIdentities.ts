import { pathToFileURL } from "node:url";

import { normalizePhilippineMobile } from "../utils/customerIdentity.js";

export type LegacyCustomerPhoneRow = {
  id: string;
  phone: string | null;
};

export type CustomerMobileIdentityBackfillSummary = {
  scanned: number;
  validUnique: number;
  duplicate: number;
  invalid: number;
  empty: number;
};

export type CustomerMobileIdentityBackfillPlan = {
  updates: Array<{
    id: string;
    phoneNormalized: string;
  }>;
  duplicateIds: string[];
  invalidIds: string[];
  emptyIds: string[];
  summary: CustomerMobileIdentityBackfillSummary;
};

export function planCustomerMobileIdentityBackfill(
  rows: readonly LegacyCustomerPhoneRow[]
): CustomerMobileIdentityBackfillPlan {
  const emptyIds: string[] = [];
  const invalidIds: string[] = [];
  const canonicalGroups = new Map<string, string[]>();

  for (const row of rows) {
    if (!row.phone || row.phone.trim().length === 0) {
      emptyIds.push(row.id);
      continue;
    }

    const phoneNormalized = normalizePhilippineMobile(row.phone);
    if (!phoneNormalized) {
      invalidIds.push(row.id);
      continue;
    }

    const ids = canonicalGroups.get(phoneNormalized);
    if (ids) {
      ids.push(row.id);
    } else {
      canonicalGroups.set(phoneNormalized, [row.id]);
    }
  }

  const updates: CustomerMobileIdentityBackfillPlan["updates"] = [];
  const duplicateIds: string[] = [];

  for (const [phoneNormalized, ids] of canonicalGroups) {
    if (ids.length === 1) {
      updates.push({ id: ids[0], phoneNormalized });
      continue;
    }

    duplicateIds.push(...ids);
  }

  return {
    updates,
    duplicateIds,
    invalidIds,
    emptyIds,
    summary: {
      scanned: rows.length,
      validUnique: updates.length,
      duplicate: duplicateIds.length,
      invalid: invalidIds.length,
      empty: emptyIds.length
    }
  };
}

export function formatCustomerMobileIdentityBackfillSummary(
  summary: CustomerMobileIdentityBackfillSummary,
  mode: "dry-run" | "apply"
): string {
  return [
    "Customer mobile identity backfill",
    `scanned=${summary.scanned} valid_unique=${summary.validUnique} duplicate=${summary.duplicate} invalid=${summary.invalid} empty=${summary.empty}`,
    `mode=${mode}`
  ].join("\n");
}

async function runCustomerMobileIdentityBackfill(): Promise<void> {
  const mode = process.argv.includes("--apply") ? "apply" : "dry-run";
  const { prisma } = await import("../database/prismaClient.js");

  try {
    const rows = await prisma.customerAccount.findMany({
      orderBy: { id: "asc" },
      select: { id: true, phone: true },
      where: {
        phone: { not: null },
        phoneNormalized: null
      }
    });

    const plan = planCustomerMobileIdentityBackfill(rows);

    if (mode === "apply" && plan.updates.length > 0) {
      await prisma.$transaction(
        plan.updates.map((update) =>
          prisma.customerAccount.update({
            data: { phoneNormalized: update.phoneNormalized },
            where: { id: update.id }
          })
        )
      );
    }

    console.log(formatCustomerMobileIdentityBackfillSummary(plan.summary, mode));
  } finally {
    await prisma.$disconnect();
  }
}

const entryPath = process.argv[1];
if (entryPath && import.meta.url === pathToFileURL(entryPath).href) {
  void runCustomerMobileIdentityBackfill().catch(() => {
    console.error("Customer mobile identity backfill failed.");
    process.exitCode = 1;
  });
}
