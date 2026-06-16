/**
 * Anomaly-detection thresholds (SPEC 5.6). Global defaults, env-overridable
 * (mirrors lib/guardrails/config.ts). "Pp" values are percentage points, "Pct"
 * values are percentages, "Cents" values are integer cents.
 */
const num = (v: string | undefined, fallback: number): number =>
  v === undefined || v === "" ? fallback : Number(v);

export interface AnomalyConfig {
  /** Days of history loaded as the comparison baseline. */
  baselineDays: number;
  /** Minimum qualifying baseline days before a detector will fire. */
  minBaselineDays: number;
  /** Refund-rate jump (today − baseline), in percentage points, to flag. */
  refundRateJumpPp: number;
  /** Floor on today's refund $ so a single tiny refund can't trip the alert. */
  minRefundCents: number;
  /** Today's refund rate at/above this escalates the alert to HIGH. */
  highRefundRatePct: number;
  /** Revenue drop vs the baseline mean (%) to flag. */
  revenueDropPct: number;
  /** Only stores whose baseline mean daily revenue clears this are eligible. */
  minBaselineRevenueCents: number;
  /** Drop at/above this escalates to HIGH (near-total collapse). */
  severeRevenueDropPct: number;
}

export const anomalyConfig: AnomalyConfig = {
  baselineDays: num(process.env.ANOMALY_BASELINE_DAYS, 14),
  minBaselineDays: num(process.env.ANOMALY_MIN_BASELINE_DAYS, 7),
  refundRateJumpPp: num(process.env.ANOMALY_REFUND_RATE_JUMP_PP, 15),
  minRefundCents: num(process.env.ANOMALY_MIN_REFUND_CENTS, 2000),
  highRefundRatePct: num(process.env.ANOMALY_HIGH_REFUND_RATE_PCT, 30),
  revenueDropPct: num(process.env.ANOMALY_REVENUE_DROP_PCT, 60),
  minBaselineRevenueCents: num(process.env.ANOMALY_MIN_BASELINE_REVENUE_CENTS, 5000),
  severeRevenueDropPct: num(process.env.ANOMALY_SEVERE_REVENUE_DROP_PCT, 85),
};
