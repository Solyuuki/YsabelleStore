import { prisma } from "../database/prismaClient.js";
import { HttpError } from "../utils/httpError.js";
import { buildPaginationMeta } from "../utils/pagination.js";
import type {
  CustomerAdminListQuery,
  CustomerAdminReviewMutation,
  CustomerAdminReviewQuery,
  CustomerAdminStatusMutation
} from "../validators/customerModeration.validators.js";

export async function listCustomerAccountsForModeration(query: CustomerAdminListQuery) {
  const search = query.search?.trim();
  const where = {
    ...(query.status ? { status: query.status } : {}),
    ...(search
      ? {
          OR: [
            { name: { startsWith: search } },
            { email: { startsWith: search } },
            { username: { startsWith: search } },
            { phone: { startsWith: search } }
          ]
        }
      : {})
  };

  const [totalItems, customers] = await Promise.all([
    prisma.customerAccount.count({ where }),
    prisma.customerAccount.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        phone: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            favorites: true,
            orders: true,
            reviews: true,
            sessions: {
              where: {
                revokedAt: null,
                expiresAt: { gt: new Date() }
              }
            }
          }
        }
      },
      where
    })
  ]);

  return {
    items: customers.map(({ _count, ...customer }) => ({
      ...customer,
      counts: {
        favorites: _count.favorites,
        orders: _count.orders,
        reviews: _count.reviews,
        activeSessions: _count.sessions
      }
    })),
    meta: buildPaginationMeta(totalItems, {
      page: query.page,
      pageSize: query.pageSize
    })
  };
}

export async function getCustomerModerationAccountSummary() {
  const grouped = await prisma.customerAccount.groupBy({
    by: ["status"],
    _count: { _all: true }
  });

  const counts = {
    ACTIVE: 0,
    INACTIVE: 0,
    SUSPENDED: 0,
    BANNED: 0
  };

  for (const row of grouped) {
    counts[row.status] = row._count._all;
  }

  return {
    total: counts.ACTIVE + counts.INACTIVE + counts.SUSPENDED + counts.BANNED,
    active: counts.ACTIVE,
    inactive: counts.INACTIVE,
    suspended: counts.SUSPENDED,
    banned: counts.BANNED,
    restricted: counts.SUSPENDED + counts.BANNED
  };
}

export async function updateCustomerModerationStatus(
  customerAccountId: string,
  input: CustomerAdminStatusMutation,
  actorUserId: string,
  now = new Date()
) {
  return prisma.$transaction(async (tx) => {
    const customer = await tx.customerAccount.findUnique({
      select: { id: true, status: true },
      where: { id: customerAccountId }
    });
    if (!customer) {
      throw new HttpError(404, "Customer account was not found.", {
        code: "CUSTOMER_ACCOUNT_NOT_FOUND"
      });
    }

    if (customer.status === input.status) {
      return { id: customer.id, status: customer.status };
    }

    const updated = await tx.customerAccount.update({
      data: { status: input.status },
      select: { id: true, status: true },
      where: { id: customer.id }
    });

    if (input.status !== "ACTIVE") {
      await tx.customerSession.updateMany({
        data: { revokedAt: now },
        where: {
          customerAccountId: customer.id,
          revokedAt: null
        }
      });
      await tx.customerRememberedAuth.deleteMany({
        where: { customerAccountId: customer.id }
      });
    }

    await tx.customerModerationAudit.create({
      data: {
        action: "CUSTOMER_STATUS_CHANGED",
        actorUserId,
        customerAccountId: customer.id,
        nextState: input.status,
        previousState: customer.status,
        reason: input.reason
      }
    });

    return updated;
  });
}

export async function listProductReviewsForModeration(query: CustomerAdminReviewQuery) {
  const where = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
          OR: [
            { reviewerDisplayName: { contains: query.search } },
            { comment: { contains: query.search } },
            { product: { name: { contains: query.search } } },
            { customerAccount: { is: { email: { contains: query.search } } } }
          ]
        }
      : {})
  };

  const [totalItems, reviews] = await Promise.all([
    prisma.productReview.count({ where }),
    prisma.productReview.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        rating: true,
        comment: true,
        reviewerDisplayName: true,
        status: true,
        moderationReason: true,
        moderatedAt: true,
        createdAt: true,
        updatedAt: true,
        verifiedOrderId: true,
        product: {
          select: {
            id: true,
            name: true,
            sku: true
          }
        },
        customerAccount: {
          select: {
            id: true,
            name: true,
            email: true,
            status: true
          }
        },
        moderatedBy: {
          select: {
            id: true,
            name: true
          }
        }
      },
      where
    })
  ]);

  return {
    items: reviews.map((review) => ({
      ...review,
      verifiedPurchase: Boolean(review.verifiedOrderId)
    })),
    meta: buildPaginationMeta(totalItems, {
      page: query.page,
      pageSize: query.pageSize
    })
  };
}

export async function updateProductReviewModerationStatus(
  reviewId: string,
  input: CustomerAdminReviewMutation,
  actorUserId: string,
  now = new Date()
) {
  return prisma.$transaction(async (tx) => {
    const review = await tx.productReview.findUnique({
      select: {
        id: true,
        productId: true,
        customerAccountId: true,
        status: true
      },
      where: { id: reviewId }
    });
    if (!review) {
      throw new HttpError(404, "Product review was not found.", {
        code: "PRODUCT_REVIEW_NOT_FOUND"
      });
    }

    if (review.status === input.status) {
      return { id: review.id, status: review.status };
    }

    const updated = await tx.productReview.update({
      data: {
        status: input.status,
        moderationReason: input.reason,
        moderatedAt: now,
        moderatedById: actorUserId
      },
      select: { id: true, status: true },
      where: { id: review.id }
    });

    await tx.customerModerationAudit.create({
      data: {
        action: "PRODUCT_REVIEW_STATUS_CHANGED",
        actorUserId,
        customerAccountId: review.customerAccountId,
        productReviewId: review.id,
        nextState: input.status,
        previousState: review.status,
        reason: input.reason
      }
    });

    return updated;
  });
}

export async function listCustomerModerationAudit(customerAccountId: string) {
  return prisma.customerModerationAudit.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 50,
    select: {
      id: true,
      action: true,
      reason: true,
      previousState: true,
      nextState: true,
      createdAt: true,
      productReviewId: true,
      actor: {
        select: { id: true, name: true }
      }
    },
    where: { customerAccountId }
  });
}
