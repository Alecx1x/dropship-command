import { prisma } from "../db";
import {
  computeDashboard,
  dashboardWindowStart,
  type DashboardData,
  type StoreInput,
} from "./metrics";

/** Load stores + recent orders and compute the dashboard (SPEC 1.6). */
export async function getDashboardData(
  now: Date = new Date(),
): Promise<DashboardData> {
  const stores = await prisma.store.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      syncLogs: {
        orderBy: { startedAt: "desc" },
        take: 1,
        select: { ok: true, kind: true, finishedAt: true },
      },
    },
  });

  const orders = await prisma.order.findMany({
    where: { placedAt: { gte: dashboardWindowStart(now) } },
    select: { storeId: true, placedAt: true, revenueCents: true },
  });

  const storeInputs: StoreInput[] = stores.map((s) => ({
    id: s.id,
    name: s.name,
    shopDomain: s.shopDomain,
    currency: s.currency,
    status: s.status,
    latestSync: s.syncLogs[0] ?? null,
  }));

  return computeDashboard(storeInputs, orders, now);
}
