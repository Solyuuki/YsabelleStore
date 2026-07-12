import type { UserRole } from "@prisma/client";

import { prisma } from "../database/prismaClient.js";
import type {
  SearchActionResult,
  SearchBatchResult,
  SearchProductResult,
  SearchReceiptResult,
  SearchResponseData
} from "../types/search.js";

type SearchActionDefinition = SearchActionResult & {
  allowedRoles: readonly UserRole[];
};

const actionDefinitions: readonly SearchActionDefinition[] = [
  {
    id: "action-dashboard",
    label: "Dashboard",
    description: "Open the store overview",
    path: "/dashboard",
    badge: "Navigate",
    allowedRoles: ["OWNER", "STAFF"]
  },
  {
    id: "action-pos",
    label: "POS",
    description: "Jump to the point of sale",
    path: "/pos",
    badge: "Navigate",
    allowedRoles: ["OWNER", "STAFF"]
  },
  {
    id: "action-products",
    label: "Products",
    description: "Open the product catalog",
    path: "/products",
    badge: "Navigate",
    allowedRoles: ["OWNER"]
  },
  {
    id: "action-inventory",
    label: "Inventory",
    description: "Review stock and batches",
    path: "/inventory",
    badge: "Navigate",
    allowedRoles: ["OWNER", "STAFF"]
  },
  {
    id: "action-sales",
    label: "Sales",
    description: "View receipts and history",
    path: "/sales",
    badge: "Navigate",
    allowedRoles: ["OWNER", "STAFF"]
  },
  {
    id: "action-users",
    label: "User Management",
    description: "Manage owner and staff accounts",
    path: "/users",
    badge: "Navigate",
    allowedRoles: ["OWNER"]
  },
  {
    id: "action-reports",
    label: "Reports",
    description: "Open reporting tools",
    path: "/reports",
    badge: "Navigate",
    allowedRoles: ["OWNER"]
  },
  {
    id: "action-settings",
    label: "Settings",
    description: "Open system settings",
    path: "/settings",
    badge: "Navigate",
    allowedRoles: ["OWNER"]
  }
];

export async function searchSystem(query: string, userRole: UserRole): Promise<SearchResponseData> {
  const normalizedQuery = query.trim();

  const [counts, products, batches, receipts] = await Promise.all([
    prisma.$transaction([
      prisma.product.count(),
      prisma.inventoryBatch.count(),
      prisma.sale.count()
    ]),
    searchProducts(normalizedQuery),
    searchBatches(normalizedQuery),
    searchReceipts(normalizedQuery)
  ]);

  const actions = actionDefinitions
    .filter((action) => action.allowedRoles.includes(userRole))
    .filter((action) => matchesAction(action, normalizedQuery));

  return {
    query: normalizedQuery,
    hasSearchableRecords: counts.some((count) => count > 0),
    counts: {
      products: counts[0],
      batches: counts[1],
      receipts: counts[2]
    },
    products,
    batches,
    receipts,
    actions
  };
}

async function searchProducts(query: string): Promise<SearchProductResult[]> {
  if (!query) {
    return [];
  }

  const results = await prisma.product.findMany({
    include: {
      category: true
    },
    orderBy: {
      updatedAt: "desc"
    },
    take: 6,
    where: {
      OR: [
        { name: { contains: query } },
        { sku: { contains: query } },
        { barcode: { contains: query } },
        { description: { contains: query } },
        {
          category: {
            name: {
              contains: query
            }
          }
        }
      ]
    }
  });

  return results.map((product) => ({
    id: product.id,
    label: product.name,
    subtitle: `SKU ${product.sku}${product.barcode ? ` · Barcode ${product.barcode}` : ""}`,
    badge: product.category.name,
    path: "/products"
  }));
}

async function searchBatches(query: string): Promise<SearchBatchResult[]> {
  if (!query) {
    return [];
  }

  const results = await prisma.inventoryBatch.findMany({
    include: {
      product: {
        include: {
          category: true
        }
      }
    },
    orderBy: {
      updatedAt: "desc"
    },
    take: 6,
    where: {
      OR: [
        { batchCode: { contains: query } },
        {
          product: {
            name: {
              contains: query
            }
          }
        },
        {
          product: {
            sku: {
              contains: query
            }
          }
        },
        {
          product: {
            barcode: {
              contains: query
            }
          }
        }
      ]
    }
  });

  return results.map((batch) => {
    const remaining = `${batch.quantityRemaining.toLocaleString()} remaining`;
    const expiry = batch.expiresAt ? `Expires ${formatDate(batch.expiresAt)}` : "No expiry date";

    return {
      id: batch.id,
      label: batch.product.name,
      subtitle: `Batch ${batch.batchCode} · ${remaining} · ${expiry}`,
      badge: batch.product.category.name,
      path: "/inventory"
    };
  });
}

async function searchReceipts(query: string): Promise<SearchReceiptResult[]> {
  if (!query) {
    return [];
  }

  const results = await prisma.sale.findMany({
    include: {
      cashier: true
    },
    orderBy: {
      saleDate: "desc"
    },
    take: 6,
    where: {
      OR: [
        { saleNumber: { contains: query } },
        { notes: { contains: query } },
        {
          cashier: {
            name: {
              contains: query
            }
          }
        },
        {
          cashier: {
            email: {
              contains: query
            }
          }
        }
      ]
    }
  });

  return results.map((sale) => ({
    id: sale.id,
    label: `Receipt ${sale.saleNumber}`,
    subtitle: `${formatCurrency(sale.totalAmount)} · ${formatDateTime(sale.saleDate)}${sale.cashier ? ` · ${sale.cashier.name}` : ""}`,
    badge: sale.status,
    path: "/sales"
  }));
}

function matchesAction(action: SearchActionDefinition, query: string) {
  if (!query) {
    return true;
  }

  const haystack = `${action.label} ${action.description} ${action.path}`.toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function formatCurrency(value: { toString: () => string }) {
  return new Intl.NumberFormat("en-PH", {
    currency: "PHP",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency"
  }).format(Number(value.toString()));
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-PH", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(value);
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(value);
}
