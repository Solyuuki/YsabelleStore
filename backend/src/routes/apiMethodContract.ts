export type ApiHttpMethod = "DELETE" | "GET" | "PATCH" | "POST" | "PUT";

type ApiRouteMethodContract = {
  methods: readonly ApiHttpMethod[];
  pattern: string;
};

const API_ROUTE_METHODS: readonly ApiRouteMethodContract[] = [
  { pattern: "/api/auth/login", methods: ["POST"] },
  { pattern: "/api/auth/register", methods: ["POST"] },
  { pattern: "/api/auth/me", methods: ["GET"] },
  { pattern: "/api/auth/trusted-device/session", methods: ["POST"] },
  { pattern: "/api/auth/trusted-device/revoke", methods: ["POST"] },
  { pattern: "/api/auth/logout", methods: ["POST"] },

  { pattern: "/api/customer-auth/registration-intent", methods: ["GET"] },
  { pattern: "/api/customer-auth/registration/email/request", methods: ["POST"] },
  { pattern: "/api/customer-auth/registration/email/verify", methods: ["POST"] },
  { pattern: "/api/customer-auth/register", methods: ["POST"] },
  { pattern: "/api/customer-auth/login", methods: ["POST"] },
  { pattern: "/api/customer-auth/remembered", methods: ["GET"] },
  { pattern: "/api/customer-auth/remembered/continue", methods: ["POST"] },
  { pattern: "/api/customer-auth/remembered/request", methods: ["POST"] },
  { pattern: "/api/customer-auth/remembered/verify", methods: ["POST"] },
  { pattern: "/api/customer-auth/remembered/:id", methods: ["DELETE"] },
  { pattern: "/api/customer-auth/email/request", methods: ["POST"] },
  { pattern: "/api/customer-auth/email/verify", methods: ["POST"] },
  { pattern: "/api/customer-auth/recovery/request", methods: ["POST"] },
  { pattern: "/api/customer-auth/recovery/verify", methods: ["POST"] },
  { pattern: "/api/customer-auth/recovery/reset", methods: ["POST"] },
  { pattern: "/api/customer-auth/social/:provider/start", methods: ["GET"] },
  { pattern: "/api/customer-auth/social/:provider/callback", methods: ["GET"] },
  { pattern: "/api/customer-auth/social/link/complete", methods: ["POST"] },
  { pattern: "/api/customer-auth/social/electron/start", methods: ["POST"] },
  { pattern: "/api/customer-auth/social/electron/redeem", methods: ["POST"] },
  { pattern: "/api/customer-auth/me", methods: ["GET"] },
  { pattern: "/api/customer-auth/logout", methods: ["POST"] },

  { pattern: "/api/customer-account/orders", methods: ["GET"] },
  { pattern: "/api/customer-account/address", methods: ["GET", "PUT"] },
  { pattern: "/api/customer-account/profile", methods: ["PATCH"] },
  { pattern: "/api/customer-account/username/claim", methods: ["POST"] },
  { pattern: "/api/customer-account/password/change", methods: ["POST"] },
  { pattern: "/api/customer-account/sessions", methods: ["GET"] },
  { pattern: "/api/customer-account/sessions/revoke-others", methods: ["POST"] },

  { pattern: "/api/dashboard/summary", methods: ["GET"] },
  { pattern: "/api/dashboard/operations", methods: ["GET"] },
  { pattern: "/api/dashboard/navigation-badges", methods: ["GET"] },

  { pattern: "/api/forecasts/validation", methods: ["GET"] },
  { pattern: "/api/forecasts/generate", methods: ["POST"] },
  { pattern: "/api/forecasts/products", methods: ["GET"] },
  { pattern: "/api/forecasts/products/:productId", methods: ["GET"] },
  { pattern: "/api/forecasts/summary", methods: ["GET"] },
  { pattern: "/api/forecasts/generation-summary", methods: ["GET"] },

  { pattern: "/api/historical-sales/template", methods: ["GET"] },
  { pattern: "/api/historical-sales/preview", methods: ["POST"] },
  { pattern: "/api/historical-sales/confirm", methods: ["POST"] },
  { pattern: "/api/historical-sales/batches", methods: ["GET"] },
  { pattern: "/api/historical-sales/batches/:batchId", methods: ["GET"] },
  { pattern: "/api/historical-sales/batches/:batchId/rows", methods: ["GET"] },
  { pattern: "/api/historical-sales/batches/:batchId/rollback-impact", methods: ["GET"] },
  { pattern: "/api/historical-sales/batches/:batchId/rollback", methods: ["POST"] },
  { pattern: "/api/historical-sales/batches/:batchId/refresh-forecasts", methods: ["POST"] },
  { pattern: "/api/historical-sales/eligibility", methods: ["GET"] },

  { pattern: "/api/health", methods: ["GET"] },
  { pattern: "/api/health/live", methods: ["GET"] },
  { pattern: "/api/health/ready", methods: ["GET"] },

  { pattern: "/api/products", methods: ["GET"] },
  { pattern: "/api/pos/products", methods: ["GET"] },
  { pattern: "/api/pos/checkout", methods: ["POST"] },

  { pattern: "/api/catalog/products/import/preview", methods: ["POST"] },
  { pattern: "/api/catalog/products/import", methods: ["POST"] },
  { pattern: "/api/catalog/products/import/google-drive/preview", methods: ["POST"] },
  { pattern: "/api/catalog/products/import/google-drive", methods: ["POST"] },
  { pattern: "/api/catalog/products/categories", methods: ["GET"] },
  { pattern: "/api/catalog/products", methods: ["GET", "POST"] },
  { pattern: "/api/catalog/products/:productId/barcodes", methods: ["GET", "POST"] },
  { pattern: "/api/catalog/products/:productId/barcodes/:barcodeId/primary", methods: ["PATCH"] },
  { pattern: "/api/catalog/products/:id/images", methods: ["POST"] },
  { pattern: "/api/catalog/products/:productId/images/latest", methods: ["GET"] },
  { pattern: "/api/catalog/products/:productId/images/:imageId/preview/:variant", methods: ["GET"] },
  { pattern: "/api/catalog/products/:productId/images/:imageId/approve", methods: ["POST"] },
  { pattern: "/api/catalog/products/:productId/images/:imageId/reject", methods: ["POST"] },
  { pattern: "/api/catalog/products/:id", methods: ["GET", "PATCH"] },
  { pattern: "/api/catalog/products/:id/status", methods: ["PATCH"] },
  { pattern: "/api/catalog/categories", methods: ["POST"] },

  { pattern: "/api/inventory", methods: ["GET"] },
  { pattern: "/api/inventory/lookup", methods: ["GET"] },
  { pattern: "/api/inventory/import/template", methods: ["GET"] },
  { pattern: "/api/inventory/import/preview", methods: ["POST"] },
  { pattern: "/api/inventory/import/confirm", methods: ["POST"] },
  { pattern: "/api/inventory/delivery-sessions/pdf/preview", methods: ["POST"] },
  { pattern: "/api/inventory/delivery-sessions/complete", methods: ["POST"] },
  { pattern: "/api/inventory/product/:productId", methods: ["GET"] },
  { pattern: "/api/inventory/deduct", methods: ["POST"] },
  { pattern: "/api/inventory/:productId/stock-in", methods: ["POST"] },
  { pattern: "/api/inventory/:productId/adjust", methods: ["POST"] },
  { pattern: "/api/inventory/:productId/movements", methods: ["GET"] },

  { pattern: "/api/restock-orders/requests", methods: ["POST"] },
  { pattern: "/api/restock-orders/planning", methods: ["GET"] },
  { pattern: "/api/restock-orders/recommendations/:recommendationId/dismiss", methods: ["POST"] },
  { pattern: "/api/restock-orders", methods: ["GET", "POST"] },
  { pattern: "/api/restock-orders/:orderId", methods: ["GET", "PATCH"] },
  { pattern: "/api/restock-orders/:orderId/lines", methods: ["PUT"] },
  { pattern: "/api/restock-orders/:orderId/approve", methods: ["POST"] },
  { pattern: "/api/restock-orders/:orderId/await-delivery", methods: ["POST"] },
  { pattern: "/api/restock-orders/:orderId/cancel", methods: ["POST"] },
  { pattern: "/api/restock-orders/:orderId/receipts", methods: ["POST"] },
  { pattern: "/api/restock-orders/:orderId/return-report", methods: ["PATCH"] },

  { pattern: "/api/sales", methods: ["GET"] },
  { pattern: "/api/search", methods: ["GET"] },

  { pattern: "/api/storefront/product-images/:imageId/:variant", methods: ["GET"] },
  { pattern: "/api/storefront/categories", methods: ["GET"] },
  { pattern: "/api/storefront/merchandising", methods: ["GET"] },
  { pattern: "/api/storefront/products", methods: ["GET"] },
  { pattern: "/api/storefront/products/:id/reviews", methods: ["GET"] },
  { pattern: "/api/storefront/products/:id/related", methods: ["GET"] },
  { pattern: "/api/storefront/products/:id", methods: ["GET"] },
  { pattern: "/api/storefront/orders", methods: ["POST"] }
];

const compiledRouteMethods = API_ROUTE_METHODS.map((route) => ({
  ...route,
  regex: compileRoutePattern(route.pattern)
}));

export function getAllowedMethodsForApiPath(pathname: string): string[] {
  const methods = new Set<string>();

  for (const route of compiledRouteMethods) {
    if (!route.regex.test(pathname)) continue;

    for (const method of route.methods) {
      methods.add(method);
      if (method === "GET") methods.add("HEAD");
    }
  }

  return [...methods].sort();
}

function compileRoutePattern(pattern: string): RegExp {
  const escaped = pattern
    .split("/")
    .map((segment) => {
      if (!segment) return "";
      if (segment.startsWith(":")) return "[^/]+";
      return segment.replace(/[.*+?^$()|[\]\\]/g, "\\$&");
    })
    .join("/");

  return new RegExp(`^${escaped}/?$`);
}
