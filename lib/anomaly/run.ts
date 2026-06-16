import { createAlert } from "../alerts/create";
import { prisma } from "../db";
import { formatCents } from "../format";
import { anomalyConfig, type AnomalyConfig } from "./config";
import { detectAnomalies, type Anomaly, type DailyPoint } from "./detect";

/**
 * Anomaly-detection sweep (SPEC 5.6). For each active store, compare the most
 * recent *complete* day against a trailing baseline and raise alerts for
 * refund-rate spikes and revenue drops. Runs after the nightly metrics rollup
 * (workers/index.ts) so it reads fresh DailyMetric rows. Deduped: one open alert
 * per (store, kind, day) so a re-run doesn't double-fire.
 */

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
// DailyMetric.date is a Prisma `@db.Date`, which round-trips as UTC midnight.
// Key and stamp by UTC calendar components so generated day boundaries (anchored
// on the local "now") and DB-read dates bucket to the same calendar day.
// (Assumes the worker's timezone is at or behind UTC, which holds for the US
// deployment — the same assumption the nightly rollup already bakes in.)
function dayKey(d: Date): string {
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
}
function isoDate(d: Date): string {
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${d.getUTCFullYear()}-${m}-${day}`;
}

interface MetricRow {
  date: Date;
  orders: number;
  revenueCents: number;
  refundCents: number;
}

/**
 * Build a dense, zero-filled daily series ending on `targetDay`. The rollup
 * writes no DailyMetric row for a zero-order day, so a revenue collapse shows up
 * as a *missing* day — we materialize those as zero points, or the drop detector
 * would never see the cliff.
 */
export function denseSeries(
  rows: MetricRow[],
  targetDay: Date,
  baselineDays: number,
): { baseline: DailyPoint[]; today: DailyPoint } {
  const byDay = new Map<string, DailyPoint>();
  for (const r of rows) {
    byDay.set(dayKey(r.date), {
      date: startOfDay(r.date),
      orders: r.orders,
      revenueCents: r.revenueCents,
      refundCents: r.refundCents,
    });
  }
  const at = (d: Date): DailyPoint =>
    byDay.get(dayKey(d)) ?? {
      date: startOfDay(d),
      orders: 0,
      revenueCents: 0,
      refundCents: 0,
    };

  const baseline: DailyPoint[] = [];
  for (let i = baselineDays; i >= 1; i--) baseline.push(at(addDays(targetDay, -i)));
  return { baseline, today: at(targetDay) };
}

/** Owner-facing alert text. Money is formatted here (run side) per currency. */
function messageFor(a: Anomaly, dateStamp: string, currency: string): string {
  if (a.kind === "REFUND_SPIKE") {
    return (
      `${dateStamp}: refund rate ${a.todayRefundRatePct.toFixed(0)}% ` +
      `(${formatCents(a.todayRefundCents, currency)} refunded on ` +
      `${formatCents(a.todayRevenueCents, currency)} revenue) vs a ` +
      `${a.baselineRefundRatePct.toFixed(0)}% baseline. ` +
      `Check for a product-quality, sizing, or fulfillment problem.`
    );
  }
  return (
    `${dateStamp}: revenue ${formatCents(a.todayRevenueCents, currency)} is ` +
    `${a.dropPct.toFixed(0)}% below the ` +
    `${formatCents(a.baselineRevenueCents, currency)}/day baseline. ` +
    `Check the storefront, checkout, payment provider, and ad-account status.`
  );
}

export async function runAnomalyDetection(
  now: Date = new Date(),
  cfg: AnomalyConfig = anomalyConfig,
): Promise<{ storesChecked: number; alertsCreated: number }> {
  const targetDay = addDays(startOfDay(now), -1); // most recent complete day
  const windowStart = addDays(targetDay, -cfg.baselineDays);
  const dateStamp = isoDate(targetDay);

  const stores = await prisma.store.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, currency: true },
  });

  let alertsCreated = 0;
  for (const store of stores) {
    const rows = await prisma.dailyMetric.findMany({
      where: {
        storeId: store.id,
        productId: null, // store-level rollup rows only
        date: { gte: windowStart, lte: targetDay },
      },
      select: { date: true, orders: true, revenueCents: true, refundCents: true },
    });

    const { baseline, today } = denseSeries(rows, targetDay, cfg.baselineDays);

    for (const a of detectAnomalies(baseline, today, cfg)) {
      // Dedupe: skip if there's already an open alert of this kind for this day.
      const existing = await prisma.alert.findFirst({
        where: {
          storeId: store.id,
          kind: a.kind,
          readAt: null,
          message: { startsWith: `${dateStamp}:` },
        },
        select: { id: true },
      });
      if (existing) continue;

      await createAlert({
        storeId: store.id,
        severity: a.severity,
        kind: a.kind,
        message: messageFor(a, dateStamp, store.currency),
      });
      alertsCreated += 1;
    }
  }

  return { storesChecked: stores.length, alertsCreated };
}
