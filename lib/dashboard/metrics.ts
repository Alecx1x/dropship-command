/**
 * Portfolio dashboard metrics (SPEC 1.6) — PURE aggregation only (unit-tested).
 * DB access lives in lib/dashboard/data.ts so this module imports no prisma and
 * can be tested without a database. All money is integer cents until the edge.
 */

export interface SyncSummary {
  ok: boolean;
  kind: string;
  finishedAt: Date | null;
}

export interface StoreInput {
  id: string;
  name: string;
  shopDomain: string;
  currency: string;
  status: string;
  latestSync: SyncSummary | null;
}

export interface OrderInput {
  storeId: string;
  placedAt: Date;
  revenueCents: number;
}

export interface StoreMetrics {
  id: string;
  name: string;
  shopDomain: string;
  currency: string;
  status: string;
  revenueTodayCents: number;
  revenue7dCents: number;
  revenue30dCents: number;
  orders30d: number;
  sync: SyncSummary | null;
}

export interface RevenuePoint {
  date: string;
  [storeId: string]: number | string;
}

export interface DashboardData {
  stores: StoreMetrics[];
  totals: {
    revenueTodayCents: number;
    revenue7dCents: number;
    revenue30dCents: number;
    orders30d: number;
  };
  series: RevenuePoint[];
  currency: string;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function daysAgo(d: Date, n: number): Date {
  const x = startOfDay(d);
  x.setDate(x.getDate() - n);
  return x;
}
function dayKey(d: Date): string {
  const x = startOfDay(d);
  return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
}
function dayLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const WINDOW_DAYS = 30;

export function computeDashboard(
  stores: StoreInput[],
  orders: OrderInput[],
  now: Date,
): DashboardData {
  const today = startOfDay(now);
  const since7 = daysAgo(now, 6); // last 7 days, inclusive of today
  const since30 = daysAgo(now, WINDOW_DAYS - 1);

  const metricsById = new Map<string, StoreMetrics>();
  for (const s of stores) {
    metricsById.set(s.id, {
      id: s.id,
      name: s.name,
      shopDomain: s.shopDomain,
      currency: s.currency,
      status: s.status,
      revenueTodayCents: 0,
      revenue7dCents: 0,
      revenue30dCents: 0,
      orders30d: 0,
      sync: s.latestSync,
    });
  }

  // Daily buckets (oldest → newest) for the revenue-over-time chart.
  const keys: string[] = [];
  const labels: string[] = [];
  for (let i = WINDOW_DAYS - 1; i >= 0; i--) {
    const d = daysAgo(now, i);
    keys.push(dayKey(d));
    labels.push(dayLabel(d));
  }
  const perDay = new Map<string, Map<string, number>>();
  for (const k of keys) perDay.set(k, new Map());

  for (const o of orders) {
    const m = metricsById.get(o.storeId);
    if (!m) continue;
    if (o.placedAt >= today) m.revenueTodayCents += o.revenueCents;
    if (o.placedAt >= since7) m.revenue7dCents += o.revenueCents;
    if (o.placedAt >= since30) {
      m.revenue30dCents += o.revenueCents;
      m.orders30d += 1;
    }
    const bucket = perDay.get(dayKey(o.placedAt));
    if (bucket) {
      bucket.set(o.storeId, (bucket.get(o.storeId) ?? 0) + o.revenueCents);
    }
  }

  const storeMetrics = [...metricsById.values()];

  const series: RevenuePoint[] = keys.map((k, i) => {
    const point: RevenuePoint = { date: labels[i] };
    const bucket = perDay.get(k)!;
    for (const s of storeMetrics) {
      point[s.id] = (bucket.get(s.id) ?? 0) / 100; // dollars for the chart
    }
    return point;
  });

  const totals = storeMetrics.reduce(
    (acc, m) => ({
      revenueTodayCents: acc.revenueTodayCents + m.revenueTodayCents,
      revenue7dCents: acc.revenue7dCents + m.revenue7dCents,
      revenue30dCents: acc.revenue30dCents + m.revenue30dCents,
      orders30d: acc.orders30d + m.orders30d,
    }),
    { revenueTodayCents: 0, revenue7dCents: 0, revenue30dCents: 0, orders30d: 0 },
  );

  return {
    stores: storeMetrics,
    totals,
    series,
    currency: storeMetrics[0]?.currency ?? "USD",
  };
}

/** Start of the dashboard's 30-day window — used by the DB query in data.ts. */
export function dashboardWindowStart(now: Date = new Date()): Date {
  return daysAgo(now, WINDOW_DAYS - 1);
}
