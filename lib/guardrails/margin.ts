/**
 * Pure margin-guardrail math (SPEC 2.4). All money is integer cents.
 */

/** Cost of goods sold = unit cost + supplier shipping. */
export function cogsCents(p: { costCents: number; shipCostCents: number }): number {
  return p.costCents + p.shipCostCents;
}

/** Gross margin as a percentage, or null if price is unknown/zero. */
export function marginPct(priceCents: number, cogs: number): number | null {
  if (priceCents <= 0) return null;
  return ((priceCents - cogs) / priceCents) * 100;
}

/**
 * Suggest a new price = COGS × multiplier, rounded to a psychological ".95"
 * ending (e.g. COGS $10 × 3 = $30 → $29.95).
 */
export function suggestRepriceCents(cogs: number, multiplier: number): number {
  const target = cogs * multiplier;
  const whole = Math.max(1, Math.round(target / 100));
  return whole * 100 - 5;
}

export interface MarginVerdict {
  marginPct: number | null;
  breached: boolean;
  suggestedPriceCents: number;
}

/** Evaluate a product's margin against the floor and suggest a reprice. */
export function evaluateMargin(
  priceCents: number,
  cogs: number,
  floorPct: number,
  multiplier: number,
): MarginVerdict {
  const m = marginPct(priceCents, cogs);
  return {
    marginPct: m,
    breached: m !== null && m < floorPct,
    suggestedPriceCents: suggestRepriceCents(cogs, multiplier),
  };
}
