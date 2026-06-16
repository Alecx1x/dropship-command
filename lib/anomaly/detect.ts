/**
 * Pure anomaly detection (SPEC 5.6). Given a store's recent daily metrics, flag
 * refund-rate spikes and revenue drops against a trailing baseline. No DB, no
 * SDK import — unit-tested in isolation; the sweep (lib/anomaly/run.ts) feeds it
 * a dense daily series and formats the alerts.
 *
 * SPEC 5.6 names "conversion-rate or refund-rate spikes". True conversion rate
 * needs per-session traffic data this app doesn't ingest (storefront analytics
 * are out of scope for v1), so the revenue-drop detector is the available
 * proxy: a sudden revenue cliff on a store that *was* selling is the same
 * early-warning signal a conversion-rate collapse would surface — a broken
 * checkout, a paused/disapproved ad account, or a payment-provider outage.
 */
import type { AnomalyConfig } from "./config";

export interface DailyPoint {
  date: Date;
  orders: number;
  revenueCents: number;
  refundCents: number;
}

export type AnomalySeverity = "MEDIUM" | "HIGH";

export interface RefundSpike {
  kind: "REFUND_SPIKE";
  severity: AnomalySeverity;
  todayRefundRatePct: number;
  baselineRefundRatePct: number;
  todayRefundCents: number;
  todayRevenueCents: number;
}

export interface RevenueDrop {
  kind: "REVENUE_DROP";
  severity: AnomalySeverity;
  todayRevenueCents: number;
  baselineRevenueCents: number;
  dropPct: number;
}

export type Anomaly = RefundSpike | RevenueDrop;

/** Refund as a % of revenue, or null when there was no revenue that day. */
export function refundRatePct(p: DailyPoint): number | null {
  if (p.revenueCents <= 0) return null;
  return (p.refundCents / p.revenueCents) * 100;
}

function mean(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/**
 * Flag a refund-rate spike: today's refund rate is well above the baseline mean
 * AND the refund $ is large enough to matter. Requires enough baseline days
 * with revenue (a refund rate is undefined on a zero-revenue day) so a brand-new
 * store with thin history doesn't get false alarms.
 */
export function detectRefundSpike(
  baseline: DailyPoint[],
  today: DailyPoint,
  cfg: AnomalyConfig,
): RefundSpike | null {
  const todayRate = refundRatePct(today);
  if (todayRate === null) return null; // no revenue today → nothing to rate
  if (today.refundCents < cfg.minRefundCents) return null;

  const baseRates = baseline
    .map(refundRatePct)
    .filter((r): r is number => r !== null);
  if (baseRates.length < cfg.minBaselineDays) return null;

  const baseRate = mean(baseRates);
  if (todayRate - baseRate < cfg.refundRateJumpPp) return null;

  return {
    kind: "REFUND_SPIKE",
    severity: todayRate >= cfg.highRefundRatePct ? "HIGH" : "MEDIUM",
    todayRefundRatePct: todayRate,
    baselineRefundRatePct: baseRate,
    todayRefundCents: today.refundCents,
    todayRevenueCents: today.revenueCents,
  };
}

/**
 * Flag a revenue drop: today's revenue is far below the baseline mean. Only
 * stores whose baseline mean clears `minBaselineRevenueCents` are eligible, so a
 * store that never had meaningful sales can't trigger a "drop". The baseline is
 * a dense (zero-filled) series, so a true sales day plus a collapse to $0 both
 * count honestly.
 */
export function detectRevenueDrop(
  baseline: DailyPoint[],
  today: DailyPoint,
  cfg: AnomalyConfig,
): RevenueDrop | null {
  if (baseline.length < cfg.minBaselineDays) return null;

  const baseMean = mean(baseline.map((p) => p.revenueCents));
  if (baseMean < cfg.minBaselineRevenueCents) return null; // too small to judge

  const dropPct = ((baseMean - today.revenueCents) / baseMean) * 100;
  if (dropPct < cfg.revenueDropPct) return null;

  return {
    kind: "REVENUE_DROP",
    severity: dropPct >= cfg.severeRevenueDropPct ? "HIGH" : "MEDIUM",
    todayRevenueCents: today.revenueCents,
    baselineRevenueCents: Math.round(baseMean),
    dropPct,
  };
}

/**
 * Run all detectors for one store's series. `today` is the latest *complete*
 * day; `baseline` is the dense run of days before it.
 */
export function detectAnomalies(
  baseline: DailyPoint[],
  today: DailyPoint,
  cfg: AnomalyConfig,
): Anomaly[] {
  return [
    detectRefundSpike(baseline, today, cfg),
    detectRevenueDrop(baseline, today, cfg),
  ].filter((a): a is Anomaly => a !== null);
}
