/**
 * READ-ONLY operational migration preflight. No schema changes, writes,
 * fixture creation, migration deployment or stock mutations are performed.
 *
 * Run on the existing store database only to review rollout blockers.
 */
import { prisma } from "../database/prismaClient.js";
import { auditStock } from "../services/stockDomainService.js";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required.");
  const address = new URL(databaseUrl);
  const dbName = address.pathname.replace(/^\//, "").split("?")[0];

  const [unsettledOrders, schema, inventoryAudit] = await Promise.all([
    prisma.customerOrder.findMany({
      select: {
        id: true,
        orderNumber: true,
        deliveryStatus: true,
        paymentStatus: true,
        saleId: true,
        createdAt: true
      },
      where: {
        status: { notIn: ["COMPLETED", "CANCELLED"] },
        deliveryStatus: { not: "CANCELLED" }
      },
      orderBy: { createdAt: "asc" }
    }),
    prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name = 'inventory_reservations'
    `,
    auditStock(prisma)
  ]);
  const stockMismatches = inventoryAudit.filter((row) => row.invariantStatus !== "OK");

  const report = {
    kind: "YSABELLE_RESERVATION_READ_ONLY_PREFLIGHT",
    database: `${address.hostname}/${dbName}`,
    reservationTableExists: schema.length === 1,
    activeLegacyOrderCount: unsettledOrders.length,
    activeLegacyOrders: unsettledOrders.slice(0, 40).map((order) => ({
      orderNumber: order.orderNumber,
      deliveryStatus: order.deliveryStatus,
      paymentStatus: order.paymentStatus,
      alreadyFinalized: Boolean(order.saleId)
    })),
    stockInvariantMismatchCount: stockMismatches.length,
    stockInvariantProductIds: stockMismatches.slice(0, 30).map((row) => row.productId),
    migrationReady: unsettledOrders.length === 0 && stockMismatches.length === 0,
    writes: 0,
    releaseStatus: "NOT_CERTIFIED",
    note: "Do not auto-backfill existing orders, run migrations or authorize purchases from this report."
  };
  console.log(JSON.stringify(report, null, 2));
  if (!report.migrationReady) process.exitCode = 2;
}

void main()
  .catch((error) => {
    console.error("Read-only reservation preflight failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
