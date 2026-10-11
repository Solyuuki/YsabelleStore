/**
 * Read-only delivery history audit for the existing local database.
 * Does not create orders, run migrations, alter inventory, or clear test data.
 */
import { CustomerDeliveryStatus, CustomerPaymentStatus } from "@prisma/client";

import { prisma } from "../database/prismaClient.js";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required.");
  const url = new URL(databaseUrl);
  const [grouped, eventCount] = await Promise.all([
    prisma.customerOrder.groupBy({
      by: ["deliveryStatus", "paymentStatus"],
      _count: { _all: true }
    }),
    prisma.customerDeliveryEvent.count()
  ]);
  const summary = grouped.map((row) => ({
    deliveryStatus: row.deliveryStatus,
    paymentStatus: row.paymentStatus,
    count: row._count._all
  }));
  const all = summary.reduce((sum, row) => sum + row.count, 0);
  const archived = summary
    .filter(
      (row) =>
        row.deliveryStatus === CustomerDeliveryStatus.CANCELLED ||
        row.deliveryStatus === CustomerDeliveryStatus.DELIVERED
    )
    .reduce((sum, row) => sum + row.count, 0);
  const awaitingSettlement = summary
    .filter(
      (row) =>
        row.deliveryStatus === CustomerDeliveryStatus.DELIVERED &&
        row.paymentStatus !== CustomerPaymentStatus.PAID
    )
    .reduce((sum, row) => sum + row.count, 0);

  console.log(
    JSON.stringify(
      {
        kind: "YSABELLE_DELIVERY_HISTORY_READ_ONLY_AUDIT",
        database: `${url.hostname}/${url.pathname.replace(/^\//, "")}`,
        allTickets: all,
        historyTickets: archived,
        activeTickets: all - archived + awaitingSettlement,
        deliveredAwaitingPayment: awaitingSettlement,
        recordedTimelineEvents: eventCount,
        byStatus: summary,
        writes: 0,
        releaseStatus: "NOT_CERTIFIED",
        note: "Rejected checkout attempts do not create delivery tickets. Their audit trail is a separate scope."
      },
      null,
      2
    )
  );
}

void main()
  .catch((error) => {
    console.error("Read-only delivery history audit failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
