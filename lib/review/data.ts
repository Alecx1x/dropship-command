import { prisma } from "../db";
import { roas } from "../profit/profit";
import type {
  ProductWeekly,
  StoreWeekly,
  WeeklyReviewData,
  WeeklyWindow,
} from "../ai/review";

/**
 * Gather the inputs for the weekly review (SPEC 4.4): per-store metrics for the
 * last 7 days vs the prior 7 days (for anomaly/trend signal), plus the week's
 * best and worst products by profit. Reads the same DailyMetric (3.1) + AdSpend
 * (3.2) rollups the profit dashboard uses, so the numbers reconcile.
 */

const DAY = 86_400_000;

interface Accum {
  revenueCents: number;
  profitBeforeAdsCents: number;
  adSpendCents: number;
  orders: number;
  refundCents: number;
}

function emptyAccum(): Accum {
  return {
    revenueCents: 0,
    profitBeforeAdsCents: 0,
    adSpendCents: 0,
    orders: 0,
    refundCents: 0,
  };
}

function finish(a: Accum): WeeklyWindow {
  return {
    revenueCents: a.revenueCents,
    netProfitCents: a.profitBeforeAdsCents - a.adSpendCents,
    adSpendCents: a.adSpendCents,
    orders: a.orders,
    refundCents: a.refundCents,
    roas: roas(a.revenueCents, a.adSpendCents),
  };
}

export async function gatherWeeklyReviewData(
  now: Date = new Date(),
): Promise<WeeklyReviewData> {
  const todayMid = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const since = new Date(todayMid - 14 * DAY);
  const thisWeekStart = new Date(todayMid - 7 * DAY);
  const daysAgoOf = (d: Date) =>
    Math.round(
      (todayMid -
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())) /
        DAY,
    );

  const [stores, metrics, ads, productAgg] = await Promise.all([
    prisma.store.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, currency: true },
    }),
    prisma.dailyMetric.findMany({
      where: { productId: null, date: { gte: since } },
      select: {
        storeId: true,
        date: true,
        revenueCents: true,
        profitCents: true,
        refundCents: true,
        orders: true,
      },
    }),
    prisma.adSpend.findMany({
      where: { date: { gte: since } },
      select: { storeId: true, date: true, spendCents: true },
    }),
    // Product ranking uses this week only.
    prisma.dailyMetric.groupBy({
      by: ["productId"],
      where: { productId: { not: null }, date: { gte: thisWeekStart } },
      _sum: { profitCents: true, revenueCents: true, refundCents: true },
    }),
  ]);

  const buckets = new Map<string, { thisWeek: Accum; priorWeek: Accum }>();
  for (const s of stores) {
    buckets.set(s.id, { thisWeek: emptyAccum(), priorWeek: emptyAccum() });
  }
  const windowFor = (storeId: string, days: number): Accum | null => {
    const b = buckets.get(storeId);
    if (!b || days < 0 || days >= 14) return null;
    return days < 7 ? b.thisWeek : b.priorWeek;
  };

  for (const m of metrics) {
    const w = windowFor(m.storeId, daysAgoOf(m.date));
    if (!w) continue;
    w.revenueCents += m.revenueCents;
    w.profitBeforeAdsCents += m.profitCents;
    w.refundCents += m.refundCents;
    w.orders += m.orders;
  }
  for (const a of ads) {
    const w = windowFor(a.storeId, daysAgoOf(a.date));
    if (!w) continue;
    w.adSpendCents += a.spendCents;
  }

  const storeWeekly: StoreWeekly[] = stores.map((s) => {
    const b = buckets.get(s.id)!;
    return {
      name: s.name,
      currency: s.currency,
      thisWeek: finish(b.thisWeek),
      priorWeek: finish(b.priorWeek),
    };
  });

  // Resolve product titles for the week's ranking.
  const productIds = productAgg
    .map((p) => p.productId)
    .filter((id): id is string => id !== null);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, title: true, store: { select: { name: true } } },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  const ranked: ProductWeekly[] = productAgg
    .filter((p) => p.productId !== null)
    .map((p) => ({
      title: productMap.get(p.productId as string)?.title ?? "Unknown",
      storeName: productMap.get(p.productId as string)?.store.name ?? "",
      revenueCents: p._sum.revenueCents ?? 0,
      profitCents: p._sum.profitCents ?? 0,
      refundCents: p._sum.refundCents ?? 0,
    }))
    .sort((a, b) => b.profitCents - a.profitCents);

  return {
    periodStart: thisWeekStart,
    periodEnd: new Date(todayMid),
    currency: stores[0]?.currency ?? "USD",
    stores: storeWeekly,
    topProducts: ranked.slice(0, 5),
    // Lowest-profit products beyond the top 5 (so the two lists never overlap).
    worstProducts: ranked.slice(5).slice(-5).reverse(),
  };
}
