import path from "node:path";

import {
  runLegacyCategoryCoverMigration,
  verifyLegacyCategoryCoverMigration
} from "../modules/catalog-image/legacyCategoryCoverMigration.js";

function argumentValue(prefix: string) {
  const argument = process.argv.find((value) => value.startsWith(prefix));
  return argument?.slice(prefix.length).trim() || undefined;
}

const apply = process.argv.includes("--apply-legacy-category-covers");
const verifyOnly = process.argv.includes("--verify-only");
const categoryId = argumentValue("--category-id=");
const repositoryRoot = path.resolve(import.meta.dirname, "../../..");

if (apply && verifyOnly) {
  throw new Error("Use either --apply-legacy-category-covers or --verify-only, not both.");
}

if (verifyOnly) {
  const verification = await verifyLegacyCategoryCoverMigration();
  const blockers = verification.filter((item) => !item.ready);

  console.log(
    JSON.stringify(
      {
        mode: "verify",
        ready: verification.length - blockers.length,
        blocked: blockers.length,
        verification
      },
      null,
      2
    )
  );

  if (blockers.length > 0) process.exitCode = 1;
} else {
  const result = await runLegacyCategoryCoverMigration({
    apply,
    categoryId,
    repositoryRoot
  });

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        eligible: result.eligible,
        processed: result.processed,
        approved: result.approved,
        rejected: result.rejected,
        failed: result.failed,
        skipped: result.skipped,
        plan: result.plan
      },
      null,
      2
    )
  );

  if (apply) {
    const verification = await verifyLegacyCategoryCoverMigration();
    const blockers = verification.filter((item) => !item.ready);

    console.log(
      JSON.stringify(
        {
          mode: "post-apply-verification",
          ready: verification.length - blockers.length,
          blocked: blockers.length,
          verification
        },
        null,
        2
      )
    );

    if (result.failed > 0 || result.rejected > 0 || blockers.length > 0) {
      process.exitCode = 1;
    }
  }
}
