import { prisma } from "../db";
import { breakevenRoas, roas } from "./profit";

/**
 * Profit dashboard data (SPEC 3.3): per-store profit/margin/ROAS over
 * today/7d/30d from DailyMetric (3.1) + AdSpend (3.2), plus a 30-day
 * profit-ranked product list (the kill/scale list). Reflects the latest rollup;
 * the nightly job and a manual recompute keep DailyMetric fresh.
 */

export interface ProfitWindow {
  revenueCents: number;
  profitBeforeAdsCents: number; // revenue − COGS − fees − refunds
  adSpendCents: number;
  netProfitCents: number; // profitBeforeAds − adSpend
}

export interface StoreProfit {
  id: string;
  name: string;
  currency: string;
  today: ProfitWindow;
  d7: ProfitWindow;
  d30: ProfitWindow;
  roas30: number | null;
  breakevenRoas30: number | null;
}

export interface ProductProfit {
  id: string;
  title: string;
  storeName: string;
  revenueCents: number;
  profitCents: number;
  refundCents: number;
}

export interface ProfitDashboard {
  stores: StoreProfit[];
  totals: ProfitWindow & { roas30: number | null; breakevenRoas30: number | null };
  products: ProductProfit[];
  currency: string;
}

function emptyWindow(): ProfitWindow {
  return {
    revenueCents: 0,
    profitBeforeAdsCents: 0,
    adSpendCents: 0,
    netProfitCents: 0,
  };
}

/** UTC-midnight epoch of a calendar day, robust to timezone for day diffing. */
function utcMid(y: number, m: number, d: number): number {
  return Date.UTC(y, m, d);
}

export async function getProfitDashboard(
  now: Date = new Date(),
): Promise<ProfitDashboard> {
  const todayMid = utcMid(now.getFullYear(), now.getMonth(), now.getDate());
  const daysAgoOf = (d: Date) =>
    Math.round(
      (todayMid - utcMid(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())) /
        86_400_000,
    );

  // Pull ~31 days with margin; bucket precisely in JS.
  const since = new Date(todayMid - 31 * 86_400_000);

  const [stores, metrics, ads, productAgg] = await Promise.all([
    prisma.store.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, currency: true },
    }),
    prisma.dailyMetric.findMany({
      where: { productId: null, date: { gte: since } },
      select: { storeId: true, date: true, revenueCents: true, profitCents: true },
    }),
    prisma.adSpend.findMany({
      where: { date: { gte: since } },
      select: { storeId: true, date: true, spendCents: true },
    }),
    prisma.dailyMetric.groupBy({
      by: ["productId"],
      where: { productId: { not: null }, date: { gte: since } },
      _sum: { profitCents: true, revenueCents: true, refundCents: true },
    }),
  ]);

  const byStore = new Map<
    string,
    { today: ProfitWindow; d7: ProfitWindow; d30: ProfitWindow }
  >();
  for (const s of stores) {
    byStore.set(s.id, {
      today: emptyWindow(),
      d7: emptyWindow(),
      d30: emptyWindow(),
    });
  }

  const addToWindows = (
    storeId: string,
    days: number,
    apply: (w: ProfitWindow) => void,
  ) => {
    const b = byStore.get(storeId);
    if (!b || days < 0) return;
    if (days < 30) apply(b.d30);
    if (days < 7) apply(b.d7);
    if (days === 0) apply(b.today);
  };

  for (const m of metrics) {
    addToWindows(m.storeId, daysAgoOf(m.date), (w) => {
      w.revenueCents += m.revenueCents;
      w.profitBeforeAdsCents += m.profitCents;
    });
  }
  for (const a of ads) {
    addToWindows(a.storeId, daysAgoOf(a.date), (w) => {
      w.adSpendCents += a.spendCents;
    });
  }

  const finishWindow = (w: ProfitWindow): ProfitWindow => ({
    ...w,
    netProfitCents: w.profitBeforeAdsCents - w.adSpendCents,
  });

  const storeProfits: StoreProfit[] = stores.map((s) => {
    const b = byStore.get(s.id)!;
    const today = finishWindow(b.today);
    const d7 = finishWindow(b.d7);
    const d30 = finishWindow(b.d30);
    return {
      id: s.id,
      name: s.name,
      currency: s.currency,
      today,
      d7,
      d30,
      roas30: roas(d30.revenueCents, d30.adSpendCents),
      breakevenRoas30: breakevenRoas(d30.profitBeforeAdsCents, d30.revenueCents),
    };
  });

  // Combined totals (sum of 30d windows).
  const totalsBase = storeProfits.reduce<ProfitWindow>((acc, s) => {
    acc.revenueCents += s.d30.revenueCents;
    acc.profitBeforeAdsCents += s.d30.profitBeforeAdsCents;
    acc.adSpendCents += s.d30.adSpendCents;
    return acc;
  }, emptyWindow());
  const totals = {
    ...finishWindow(totalsBase),
    roas30: roas(totalsBase.revenueCents, totalsBase.adSpendCents),
    breakevenRoas30: breakevenRoas(
      totalsBase.profitBeforeAdsCents,
      totalsBase.revenueCents,
    ),
  };

  // Per-product 30d ranking.
  const productIds = productAgg
    .map((p) => p.productId)
    .filter((id): id is string => id !== null);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, title: true, store: { select: { name: true } } },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  const productProfits: ProductProfit[] = productAgg
    .filter((p) => p.productId !== null)
    .map((p) => ({
      id: p.productId as string,
      title: productMap.get(p.productId as string)?.title ?? "Unknown",
      storeName: productMap.get(p.productId as string)?.store.name ?? "",
      revenueCents: p._sum.revenueCents ?? 0,
      profitCents: p._sum.profitCents ?? 0,
      refundCents: p._sum.refundCents ?? 0,
    }))
    .sort((a, b) => b.profitCents - a.profitCents);

  return {
    stores: storeProfits,
    totals,
    products: productProfits,
    currency: stores[0]?.currency ?? "USD",
  };
}
