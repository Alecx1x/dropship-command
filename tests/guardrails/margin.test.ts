import { describe, it, expect } from "vitest";

import {
  cogsCents,
  evaluateMargin,
  marginPct,
  suggestRepriceCents,
} from "../../lib/guardrails/margin";

describe("margin guardrail math", () => {
  it("computes COGS and margin percentage", () => {
    expect(cogsCents({ costCents: 480, shipCostCents: 220 })).toBe(700);
    expect(marginPct(2999, 700)).toBeCloseTo(76.66, 1);
    expect(marginPct(0, 700)).toBeNull();
  });

  it("suggests a reprice ending in .95", () => {
    expect(suggestRepriceCents(1000, 3)).toBe(2995); // $10 × 3 = $30 → $29.95
    expect(suggestRepriceCents(700, 3)).toBe(2095); // $7 × 3 = $21 → $20.95
    expect(suggestRepriceCents(333, 3)).toBe(995); // ~$9.99 → $9.95
  });

  it("flags a breach when margin is below the floor", () => {
    // COGS $28 vs price $29.99 → ~6.6% margin, floor 25% → breached.
    const v = evaluateMargin(2999, 2800, 25, 3);
    expect(v.breached).toBe(true);
    expect(v.marginPct).toBeCloseTo(6.64, 1);
    expect(v.suggestedPriceCents).toBe(8395); // $28 × 3 = $84 → $83.95
  });

  it("does not flag a healthy margin", () => {
    const v = evaluateMargin(2999, 700, 25, 3);
    expect(v.breached).toBe(false);
  });

  it("treats unknown price (zero) as not breached", () => {
    const v = evaluateMargin(0, 700, 25, 3);
    expect(v.breached).toBe(false);
    expect(v.marginPct).toBeNull();
  });
});
