import { describe, it, expect } from "vitest";

import { anomalyConfig, type AnomalyConfig } from "../../lib/anomaly/config";
import {
  detectAnomalies,
  detectRefundSpike,
  detectRevenueDrop,
  refundRatePct,
  type DailyPoint,
} from "../../lib/anomaly/detect";

const CFG: AnomalyConfig = anomalyConfig;

/** Build a baseline of `n` identical days. */
function days(
  n: number,
  revenueCents: number,
  refundCents = 0,
  orders = 5,
): DailyPoint[] {
  return Array.from({ length: n }, (_, i) => ({
    date: new Date(2026, 0, i + 1),
    orders,
    revenueCents,
    refundCents,
  }));
}

function point(revenueCents: number, refundCents = 0, orders = 5): DailyPoint {
  return { date: new Date(2026, 1, 1), orders, revenueCents, refundCents };
}

describe("refundRatePct", () => {
  it("is refund / revenue as a percentage", () => {
    expect(refundRatePct(point(10000, 2000))).toBeCloseTo(20, 5);
  });
  it("is null when there was no revenue", () => {
    expect(refundRatePct(point(0, 0))).toBeNull();
  });
});

describe("detectRefundSpike", () => {
  // Baseline ~2% refund rate ($100 revenue, $2 refund) for 14 days.
  const baseline = days(14, 10000, 200);

  it("flags HIGH when today's refund rate spikes well past baseline", () => {
    // $100 revenue, $35 refunded → 35% (>= highRefundRatePct 30).
    const a = detectRefundSpike(baseline, point(10000, 3500), CFG);
    expect(a?.kind).toBe("REFUND_SPIKE");
    expect(a?.severity).toBe("HIGH");
    expect(a?.todayRefundRatePct).toBeCloseTo(35, 5);
    expect(a?.baselineRefundRatePct).toBeCloseTo(2, 5);
  });

  it("flags MEDIUM for a real jump that stays under the HIGH rate", () => {
    // $200 revenue, $40 refunded → 20% (>= +15pp jump, < 30%).
    const a = detectRefundSpike(baseline, point(20000, 4000), CFG);
    expect(a?.severity).toBe("MEDIUM");
  });

  it("does not flag when the jump is below the threshold", () => {
    // 5% is only +3pp over baseline.
    expect(detectRefundSpike(baseline, point(10000, 500), CFG)).toBeNull();
  });

  it("ignores a high rate when the refund $ is tiny (noise floor)", () => {
    // 100% rate but only $5 refunded — below minRefundCents ($20).
    expect(detectRefundSpike(baseline, point(500, 500), CFG)).toBeNull();
  });

  it("does not flag without enough baseline days", () => {
    expect(detectRefundSpike(days(3, 10000, 200), point(10000, 3500), CFG)).toBeNull();
  });

  it("does not flag when today had no revenue", () => {
    expect(detectRefundSpike(baseline, point(0, 0), CFG)).toBeNull();
  });
});

describe("detectRevenueDrop", () => {
  // Baseline $100/day for 14 days (well above the $50 minimum).
  const baseline = days(14, 10000);

  it("flags HIGH on a near-total collapse to $0", () => {
    const a = detectRevenueDrop(baseline, point(0), CFG);
    expect(a?.kind).toBe("REVENUE_DROP");
    expect(a?.severity).toBe("HIGH");
    expect(a?.dropPct).toBeCloseTo(100, 5);
    expect(a?.baselineRevenueCents).toBe(10000);
  });

  it("flags MEDIUM on a steep-but-partial drop", () => {
    // $30 vs $100 baseline → 70% drop (>= 60%, < 85%).
    const a = detectRevenueDrop(baseline, point(3000), CFG);
    expect(a?.severity).toBe("MEDIUM");
  });

  it("does not flag a drop shallower than the threshold", () => {
    // $50 vs $100 → 50% drop, under the 60% floor.
    expect(detectRevenueDrop(baseline, point(5000), CFG)).toBeNull();
  });

  it("does not flag stores below the baseline-revenue floor", () => {
    // $10/day baseline is under the $50 minimum — too small to judge.
    expect(detectRevenueDrop(days(14, 1000), point(0), CFG)).toBeNull();
  });

  it("does not flag without enough baseline days", () => {
    expect(detectRevenueDrop(days(3, 10000), point(0), CFG)).toBeNull();
  });
});

describe("detectAnomalies", () => {
  it("returns both detectors when both trip on the same day", () => {
    // Baseline: $100/day, 2% refunds. Today: revenue cratered to $30 (70% drop)
    // with a $25 refund on it (83% rate) → both a drop and a refund spike.
    const baseline = days(14, 10000, 200);
    const found = detectAnomalies(baseline, point(3000, 2500), CFG);
    const kinds = found.map((a) => a.kind).sort();
    expect(kinds).toEqual(["REFUND_SPIKE", "REVENUE_DROP"]);
  });

  it("returns nothing on a healthy, steady day", () => {
    const baseline = days(14, 10000, 200);
    expect(detectAnomalies(baseline, point(10500, 210), CFG)).toEqual([]);
  });
});
