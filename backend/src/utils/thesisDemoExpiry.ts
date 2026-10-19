const DEMO_START_UTC = Date.UTC(2028, 9, 19);
const DAY_MS = 86_400_000;
const EXPIRY_SPREAD_DAYS = 366;
const THESIS_DEMO_PROJECT_ID = "78e2a5d3-f0f8-4e4a-a425-41bb4c6e161e";

/** Sample data only. Never treat these generated dates as manufacturer-verified expiry. */
export function getThesisDemoExpiryDate(productId: string, batchIdOrCode: string): Date {
  let hash = 2166136261;
  for (const character of `${productId}:${batchIdOrCode}`) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
  }
  return new Date(DEMO_START_UTC + (hash % EXPIRY_SPREAD_DAYS) * DAY_MS);
}

/** Generate demo dates only in this thesis project's production environment. */
export function getThesisDemoExpiryForNewBatch(productId: string, batchCode: string): Date | null {
  if (
    process.env.RAILWAY_PROJECT_ID !== THESIS_DEMO_PROJECT_ID ||
    process.env.RAILWAY_ENVIRONMENT_NAME !== "production" ||
    process.env.THESIS_DEMO_EXPIRIES_ENABLED === "false"
  ) {
    return null;
  }
  return getThesisDemoExpiryDate(productId, batchCode);
}
