import type {
  CatalogPromotionCategoryMutationPlan,
  CatalogPromotionCategoryMutationPlanRow
} from "./catalog-promotion-category-mutation-plan.js";

type CategorySnapshot = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  recordSource: "CATALOG" | "IMPORT" | "TEST_FIXTURE" | "INTERNAL";
  dataQualityStatus: "APPROVED" | "NEEDS_REVIEW" | "REJECTED";
  isStorefrontVisible: boolean;
};

type CategoryMutationTransaction = {
  category: {
    findMany(args?: unknown): Promise<CategorySnapshot[]>;
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
  };
};

export type CategoryMutationClient = {
  $transaction<T>(callback: (tx: CategoryMutationTransaction) => Promise<T>): Promise<T>;
};

export type CategoryMutationAuthorization = {
  expectedSourceCategories: number;
  expectedCategoryCreates: number;
  expectedCategoryReuses: number;
};

export type CategoryMutationExecutionResult = {
  summary: {
    authorizedCategoryCreates: number;
    createdCategories: number;
    alreadyPresentCategories: number;
    actualMutationsPerformed: number;
  };
};

function fail(code: string, detail?: string): never {
  throw new Error(detail ? `${code}: ${detail}` : code);
}

function createRows(plan: CatalogPromotionCategoryMutationPlan) {
  return plan.rows.filter(
    (row): row is CatalogPromotionCategoryMutationPlanRow & {
      decision: "CREATE_CATEGORY";
      proposedCategoryCreate: NonNullable<CatalogPromotionCategoryMutationPlanRow["proposedCategoryCreate"]>;
    } => row.decision === "CREATE_CATEGORY" && Boolean(row.proposedCategoryCreate)
  );
}

function reuseRows(plan: CatalogPromotionCategoryMutationPlan) {
  return plan.rows.filter(
    (row): row is CatalogPromotionCategoryMutationPlanRow & {
      decision: "REUSE_EXISTING";
      existingCategoryId: string;
    } => row.decision === "REUSE_EXISTING" && Boolean(row.existingCategoryId)
  );
}

function assertAuthorization(
  plan: CatalogPromotionCategoryMutationPlan,
  authorization: CategoryMutationAuthorization
) {
  const creates = createRows(plan);
  const reuses = reuseRows(plan);
  const matches =
    plan.summary.sourceCategories === authorization.expectedSourceCategories &&
    plan.summary.proposedCategoryCreates === authorization.expectedCategoryCreates &&
    plan.summary.proposedCategoryReuses === authorization.expectedCategoryReuses &&
    plan.summary.blockedCategories === 0 &&
    plan.summary.actualMutationsPerformed === 0 &&
    plan.rows.length === authorization.expectedSourceCategories &&
    creates.length === authorization.expectedCategoryCreates &&
    reuses.length === authorization.expectedCategoryReuses;

  if (!matches) {
    fail("CATEGORY_MUTATION_AUTHORIZATION_MISMATCH");
  }
}

function isExactPlannedCategory(
  existing: CategorySnapshot,
  proposed: NonNullable<CatalogPromotionCategoryMutationPlanRow["proposedCategoryCreate"]>
) {
  return (
    existing.name === proposed.name &&
    existing.slug === proposed.slug &&
    existing.isActive === proposed.isActive &&
    existing.recordSource === proposed.recordSource &&
    existing.dataQualityStatus === proposed.dataQualityStatus &&
    existing.isStorefrontVisible === proposed.isStorefrontVisible
  );
}

function assertReusableCategory(row: CatalogPromotionCategoryMutationPlanRow, existing: CategorySnapshot | undefined) {
  if (!existing) {
    fail("CATEGORY_MUTATION_DATABASE_DRIFT", `reuse target missing for ${row.sourceCategory}`);
  }
  if (
    !existing.isActive ||
    existing.recordSource === "TEST_FIXTURE" ||
    existing.dataQualityStatus === "REJECTED"
  ) {
    fail("CATEGORY_MUTATION_DATABASE_DRIFT", `reuse target is no longer eligible for ${row.sourceCategory}`);
  }
}

export async function executeCatalogPromotionCategoryMutationPlan(input: {
  client: CategoryMutationClient;
  plan: CatalogPromotionCategoryMutationPlan;
  authorization: CategoryMutationAuthorization;
}): Promise<CategoryMutationExecutionResult> {
  assertAuthorization(input.plan, input.authorization);

  const creates = createRows(input.plan);
  const reuses = reuseRows(input.plan);

  return input.client.$transaction(async (tx) => {
    const relevantNames = creates.map((row) => row.proposedCategoryCreate.name);
    const relevantSlugs = creates.map((row) => row.proposedCategoryCreate.slug);
    const reuseIds = reuses.map((row) => row.existingCategoryId);
    const existing = await tx.category.findMany({
      where: {
        OR: [
          { name: { in: relevantNames } },
          { slug: { in: relevantSlugs } },
          { id: { in: reuseIds } }
        ]
      },
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
        recordSource: true,
        dataQualityStatus: true,
        isStorefrontVisible: true
      }
    });

    for (const row of reuses) {
      assertReusableCategory(
        row,
        existing.find((category) => category.id === row.existingCategoryId)
      );
    }

    const pendingCreates: typeof creates = [];
    let alreadyPresentCategories = 0;

    for (const row of creates) {
      const proposed = row.proposedCategoryCreate;
      const sameName = existing.filter((category) => category.name === proposed.name);
      const sameSlug = existing.filter((category) => category.slug === proposed.slug);
      const matches = existing.filter((category) => isExactPlannedCategory(category, proposed));

      if (matches.length === 1 && sameName.length === 1 && sameSlug.length === 1) {
        alreadyPresentCategories += 1;
        continue;
      }

      if (sameName.length > 0 || sameSlug.length > 0) {
        fail("CATEGORY_MUTATION_DATABASE_DRIFT", `name/slug collision for ${row.sourceCategory}`);
      }

      pendingCreates.push(row);
    }

    for (const row of pendingCreates) {
      await tx.category.create({
        data: {
          name: row.proposedCategoryCreate.name,
          slug: row.proposedCategoryCreate.slug,
          isActive: row.proposedCategoryCreate.isActive,
          recordSource: row.proposedCategoryCreate.recordSource,
          dataQualityStatus: row.proposedCategoryCreate.dataQualityStatus,
          isStorefrontVisible: row.proposedCategoryCreate.isStorefrontVisible
        }
      });
    }

    return {
      summary: {
        authorizedCategoryCreates: creates.length,
        createdCategories: pendingCreates.length,
        alreadyPresentCategories,
        actualMutationsPerformed: pendingCreates.length
      }
    };
  });
}
