/**
 * Guardrail thresholds (SPEC 2.4). Global defaults for now, overridable via env;
 * per-store config can come later. Margin floor is a percentage; the reprice
 * multiplier is applied to COGS to suggest a new price.
 */
export const GUARDRAIL_MARGIN_FLOOR_PCT = Number(
  process.env.GUARDRAIL_MARGIN_FLOOR_PCT ?? "25",
);

export const GUARDRAIL_REPRICE_MULTIPLIER = Number(
  process.env.GUARDRAIL_REPRICE_MULTIPLIER ?? "3",
);
