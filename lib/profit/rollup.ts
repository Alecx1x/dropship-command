import { prisma } from "../db";
import { defaultFeeConfig } from "./config";
import { rollupDay, type RollupOrder } from "./profit";

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/**
 * Rebuild DailyMetric rows for one store + day from its orders (SPEC 3.1).
 * Delete-then-insert keeps it idempotent without a unique on the nullable
 * productId. Returns the number of rows written.
 */
export async function rebuildDailyMetricsForStoreDate(
  storeId: string,
  date: Date,
): Promise<number> {
  const dayStart = startOfDay(date);
  const dayEnd = addDays(dayStart, 1);

  const orders = await prisma.order.findMany({
    where: { storeId, placedAt: { gte: dayStart, lt: dayEnd } },
    select: {
      revenueCents: true,
      shippingChargedCents: true,
      refundCents: true,
      items: {
        select: { productId: true, qty: true, priceCents: true, costCents: true },
      },
    },
  });

  const rollupOrders: RollupOrder[] = orders.map((o) => ({
    revenueCents: o.revenueCents,
    shippingChargedCents: o.shippingChargedCents,
    refundCents: o.refundCents,
    items: o.items.map((i) => ({
      productId: i.productId,
      qty: i.qty,
      priceCents: i.priceCents,
      costCents: i.costCents,
    })),
  }));

  const rows = rollupDay(rollupOrders, defaultFeeConfig);

  await prisma.$transaction([
    prisma.dailyMetric.deleteMany({ where: { storeId, date: dayStart } }),
    prisma.dailyMetric.createMany({
      data: rows.map((r) => ({
        storeId,
        productId: r.productId,
        date: dayStart,
        orders: r.orders,
        revenueCents: r.revenueCents,
        costCents: r.costCents,
        paymentFeesCents: r.paymentFeesCents,
        refundCents: r.refundCents,
        profitCents: r.profitCents,
      })),
    }),
  ]);

  return rows.length;
}

/** Rebuild the last `days` days of metrics for every active store (nightly). */
export async function rebuildRecentDailyMetrics(
  days = 35,
  now: Date = new Date(),
): Promise<{ stores: number; rowsWritten: number }> {
  const stores = await prisma.store.findMany({
    where: { status: "ACTIVE" },
    select: { id: true },
  });

  let rowsWritten = 0;
  for (const s of stores) {
    for (let i = 0; i < days; i++) {
      rowsWritten += await rebuildDailyMetricsForStoreDate(
        s.id,
        addDays(startOfDay(now), -i),
      );
    }
  }
  return { stores: stores.length, rowsWritten };
}
