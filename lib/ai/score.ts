import { z } from "zod";

/**
 * Product research scoring (SPEC 4.1).
 *
 * Given a candidate product (title, niche, cost, target price, and pasted
 * evidence such as ad-library notes or trend data), Claude returns a 0–100
 * score plus a rationale across the six-criterion filter the owner uses to pick
 * winners (GETTING_STARTED.md B1):
 *
 *   1. Problem-solving value   — solves a real problem
 *   2. Wow factor              — stops a scroll / earns a search
 *   3. Margin (≥ 3x markup)    — after shipping, or ad costs eat the margin
 *   4. Shippability & compliance — light, unbreakable, no sizing, no landmines
 *   5. Competition             — low saturation is better
 *   6. Seasonality             — year-round demand beats a spike
 *
 * WHY a forced tool call: we ask Claude to return its answer by calling the
 * `submit_score` tool, so the result arrives as structured JSON (not prose we'd
 * have to regex). We still validate it with zod and clamp every number, because
 * "external response → zod" is a hard rule (CLAUDE.md) and models occasionally
 * return a 105 or an integer-as-string.
 *
 * This module is deliberately free of any Anthropic SDK import so the prompt
 * building and response parsing are pure and unit-testable. The actual network
 * call is injected as a `RunScoring` function (see lib/ai/anthropic.ts).
 */

/** The six scoring criteria, in display order. Keys match the tool schema. */
export const RUBRIC = [
  { key: "problemSolving", label: "Problem-solving value" },
  { key: "wowFactor", label: "Wow factor / scroll-stopping" },
  { key: "margin", label: "Margin (≥3x markup)" },
  { key: "shippability", label: "Shippability & compliance" },
  { key: "competition", label: "Competition (low saturation)" },
  { key: "seasonality", label: "Year-round demand" },
] as const;

export type CriterionKey = (typeof RUBRIC)[number]["key"];

export interface ProductForScoring {
  title: string;
  niche?: string | null;
  supplierCostCents?: number | null;
  estPriceCents?: number | null;
  /** Free-text evidence: ad-library notes, trend data, competitor links, etc. */
  evidence?: string | null;
}

export interface ScoreResult {
  /** Overall product score, 0–100. */
  score: number;
  /** Human-readable rationale (overall + per-criterion), stored on the item. */
  rationale: string;
}

/**
 * Markup multiple (sell price ÷ landed cost), or null if either side is unknown
 * or cost is zero. The rubric's hard "≥ 3x" rule is arithmetic, so we compute it
 * ourselves and hand Claude the fact rather than hoping it does the division.
 */
export function marginMultiple(
  costCents?: number | null,
  priceCents?: number | null,
): number | null {
  if (!costCents || !priceCents || costCents <= 0 || priceCents <= 0) {
    return null;
  }
  return priceCents / costCents;
}

function dollars(cents?: number | null): string {
  return cents == null ? "unknown" : `$${(cents / 100).toFixed(2)}`;
}

/** Build the user-message text describing the product to be scored. */
export function buildScoringPrompt(p: ProductForScoring): string {
  const mult = marginMultiple(p.supplierCostCents, p.estPriceCents);
  const marginLine =
    mult == null
      ? "Markup multiple: unknown (cost and/or target price not provided)"
      : `Markup multiple: ${mult.toFixed(2)}x (target price ÷ landed cost)`;

  return [
    `Title: ${p.title}`,
    `Niche: ${p.niche?.trim() || "unspecified"}`,
    `Supplier landed cost: ${dollars(p.supplierCostCents)}`,
    `Target sell price: ${dollars(p.estPriceCents)}`,
    marginLine,
    "",
    "Evidence (owner-supplied notes; may be empty):",
    p.evidence?.trim() || "(none provided)",
    "",
    "Score this product by calling the submit_score tool.",
  ].join("\n");
}

export const SCORING_SYSTEM_PROMPT = `You are a dropshipping product-research analyst. You score candidate products for a portfolio of stores using a strict, honest filter — most products fail, and a high score should be rare and earned.

Score each product 0–100 overall, plus 0–100 on each of these six criteria:
1. Problem-solving value — does it solve a real, felt problem?
2. Wow factor — does it stop a scroll or earn a deliberate search?
3. Margin — is there a 3x+ markup AFTER shipping? Under 3x, ad costs make it unviable; score this low. Use the markup multiple provided.
4. Shippability & compliance — light, unbreakable, no apparel sizing, ships in ≤12 days, and free of regulatory landmines (no ingestibles/supplements, medical claims, batteries, or trademarked/branded goods).
5. Competition — lower saturation scores higher; if it's in every big-box store with no better variant, score low.
6. Seasonality — steady year-round demand beats a seasonal spike.

Be skeptical and concrete. If evidence is thin, say so and don't inflate the score. Weight margin and shippability heavily — they are the usual silent killers. Keep each note to one or two sentences. Always answer by calling the submit_score tool.`;

/**
 * JSON-schema tool Claude must call. Kept structural (not the SDK's Tool type)
 * so this module stays SDK-agnostic; lib/ai/anthropic.ts adapts it.
 */
export const SCORE_TOOL = {
  name: "submit_score",
  description:
    "Submit the product research score: an overall 0–100 score, a short rationale, and a 0–100 sub-score with a one-line note per criterion.",
  input_schema: {
    type: "object",
    properties: {
      overallScore: {
        type: "number",
        description: "Overall product score, 0–100.",
      },
      rationale: {
        type: "string",
        description: "2–4 sentence overall rationale for the score.",
      },
      criteria: {
        type: "object",
        properties: Object.fromEntries(
          RUBRIC.map(({ key, label }) => [
            key,
            {
              type: "object",
              description: label,
              properties: {
                score: { type: "number", description: "0–100" },
                note: { type: "string", description: "One-line justification." },
              },
              required: ["score", "note"],
            },
          ]),
        ),
        required: RUBRIC.map((c) => c.key),
      },
    },
    required: ["overallScore", "rationale", "criteria"],
  },
} as const;

// --- Defensive validation of the tool input Claude returns ---------------

const criterionRaw = z.object({
  score: z.coerce.number(),
  note: z.string().default(""),
});

const toolInputSchema = z.object({
  overallScore: z.coerce.number(),
  rationale: z.string().default(""),
  criteria: z.object({
    problemSolving: criterionRaw,
    wowFactor: criterionRaw,
    margin: criterionRaw,
    shippability: criterionRaw,
    competition: criterionRaw,
    seasonality: criterionRaw,
  }),
});

const clampScore = (n: number): number => Math.max(0, Math.min(100, Math.round(n)));

/**
 * Validate + normalize the raw tool input into a ScoreResult. Clamps every score
 * to 0–100 and composes a readable rationale (overall paragraph + one bullet per
 * criterion). Throws if the shape is fundamentally wrong (so callers can fail
 * the scoring action rather than persist garbage).
 */
export function parseScoreResult(raw: unknown): ScoreResult {
  const parsed = toolInputSchema.parse(raw);

  const bullets = RUBRIC.map(({ key, label }) => {
    const c = parsed.criteria[key];
    const note = c.note.trim();
    return `• ${label} (${clampScore(c.score)})${note ? `: ${note}` : ""}`;
  });

  const rationale = [parsed.rationale.trim(), "", ...bullets]
    .join("\n")
    .trim();

  return { score: clampScore(parsed.overallScore), rationale };
}

/**
 * Network-call seam: given the system prompt, user text, and tool definition,
 * run the model and return the raw tool-call input object. The real
 * implementation (lib/ai/anthropic.ts) uses the Anthropic SDK; tests inject a
 * fake.
 */
export type RunScoring = (args: {
  system: string;
  user: string;
  tool: typeof SCORE_TOOL;
}) => Promise<unknown>;

/** Score a product end-to-end using an injected model runner. */
export async function scoreProduct(
  product: ProductForScoring,
  run: RunScoring,
): Promise<ScoreResult> {
  const raw = await run({
    system: SCORING_SYSTEM_PROMPT,
    user: buildScoringPrompt(product),
    tool: SCORE_TOOL,
  });
  return parseScoreResult(raw);
}
