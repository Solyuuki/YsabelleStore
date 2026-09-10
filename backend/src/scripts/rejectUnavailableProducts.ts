import { prisma } from "../database/prismaClient.js";

const APPLY_FLAG = "--apply-reject-unavailable";
const PROTECTED_SKUS = new Set<string>(["SARIMA-P254", "SARIMA-P255"]);

async function main() {
  const apply = process.argv.includes(APPLY_FLAG);

  const candidates = await prisma.product.findMany({
    where: {
      status: "INACTIVE",
      dataQualityStatus: "NEEDS_REVIEW",
      isStorefrontVisible: false,
      sku: { notIn: [...PROTECTED_SKUS] }
    },
    select: {
      id: true,
      sku: true,
      name: true,
      status: true,
      dataQualityStatus: true,
      isStorefrontVisible: true
    },
    orderBy: { sku: "asc" }
  });

  if (!apply) {
    console.log(
      JSON.stringify(
        {
          mode: "PREVIEW",
          candidateCount: candidates.length,
          sample: candidates.slice(0, 20),
          targetState: {
            status: "DISCONTINUED",
            dataQualityStatus: "REJECTED",
            isStorefrontVisible: false
          },
          applyCommand:
            "npx tsx backend/src/scripts/rejectUnavailableProducts.ts --apply-reject-unavailable"
        },
        null,
        2
      )
    );
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.product.updateMany({
      where: {
        id: { in: candidates.map((product) => product.id) },
        status: "INACTIVE",
        dataQualityStatus: "NEEDS_REVIEW",
        isStorefrontVisible: false
      },
      data: {
        status: "DISCONTINUED",
        dataQualityStatus: "REJECTED",
        isStorefrontVisible: false
      }
    });

    if (updated.count !== candidates.length) {
      throw new Error(
        `Conditional rejection mismatch: expected ${candidates.length}, updated ${updated.count}.`
      );
    }

    for (const product of candidates) {
      await tx.catalogAuditLog.create({
        data: {
          entityType: "PRODUCT",
          entityId: product.id,
          canonicalProductId: product.id,
          action: "BULK_REJECT_UNAVAILABLE",
          reason:
            "Owner-directed rejection of unavailable products not intended for current POS/storefront use.",
          automated: true,
          actor: "reject-unavailable-products",
          evidence: {
            sku: product.sku,
            name: product.name,
            before: {
              status: product.status,
              dataQualityStatus: product.dataQualityStatus,
              isStorefrontVisible: product.isStorefrontVisible
            },
            after: {
              status: "DISCONTINUED",
              dataQualityStatus: "REJECTED",
              isStorefrontVisible: false
            }
          }
        }
      });
    }

    return updated.count;
  });

  console.log(
    JSON.stringify(
      {
        mode: "APPLIED",
        rejectedCount: result,
        targetState: {
          status: "DISCONTINUED",
          dataQualityStatus: "REJECTED",
          isStorefrontVisible: false
        }
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
