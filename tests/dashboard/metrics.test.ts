import { describe, it, expect } from "vitest";

import {
  computeDashboard,
  type OrderInput,
  type StoreInput,
} from "../../lib/dashboard/metrics";

const now = new Date("2026-06-10T12:00:00");

function daysBefore(n: number): Date {
  return new Date(now.getTime() - n * 24 * 60 * 60 * 1000);
}

const stores: StoreInput[] = [
  {
    id: "s1",
    name: "Store One",
    shopDomain: "one.myshopify.com",
    currency: "USD",
    status: "ACTIVE",
    latestSync: { ok: true, kind: "ORDERS", finishedAt: now },
  },
  {
    id: "s2",
    name: "Store Two",
    shopDomain: "two.myshopify.com",
    currency: "USD",
    status: "ACTIVE",
    latestSync: null,
  },
];

const orders: OrderInput[] = [
  { storeId: "s1", placedAt: now, revenueCents: 1000 }, // today
  { storeId: "s1", placedAt: daysBefore(3), revenueCents: 2000 }, // in 7d
  { storeId: "s1", placedAt: daysBefore(20), revenueCents: 500 }, // in 30d only
  { storeId: "s2", placedAt: now, revenueCents: 3000 }, // today
  { storeId: "sX", placedAt: now, revenueCents: 9999 }, // unknown store, ignored
];

describe("computeDashboard", () => {
  const data = computeDashboard(stores, orders, now);

  it("computes per-store revenue windows and order counts", () => {
    const s1 = data.stores.find((s) => s.id === "s1")!;
    expect(s1.revenueTodayCents).toBe(1000);
    expect(s1.revenue7dCents).toBe(3000); // today + 3d ago
    expect(s1.revenue30dCents).toBe(3500); // + 20d ago
    expect(s1.orders30d).toBe(3);

    const s2 = data.stores.find((s) => s.id === "s2")!;
    expect(s2.revenueTodayCents).toBe(3000);
    expect(s2.orders30d).toBe(1);
  });

  it("ignores orders for unknown stores", () => {
    const total = data.stores.reduce((n, s) => n + s.orders30d, 0);
    expect(total).toBe(4); // the sX order is dropped
  });

  it("computes combined totals", () => {
    expect(data.totals.revenueTodayCents).toBe(4000);
    expect(data.totals.revenue7dCents).toBe(6000);
    expect(data.totals.revenue30dCents).toBe(6500);
    expect(data.totals.orders30d).toBe(4);
  });

  it("builds a 30-point daily series with today's bucket in dollars", () => {
    expect(data.series).toHaveLength(30);
    const todayPoint = data.series[29];
    expect(todayPoint.s1).toBe(10); // 1000 cents -> $10
    expect(todayPoint.s2).toBe(30); // 3000 cents -> $30
  });

  it("carries the currency through", () => {
    expect(data.currency).toBe("USD");
  });
});
