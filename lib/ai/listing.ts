import { z } from "zod";

/**
 * Listing copy generation (SPEC 4.2).
 *
 * For a research candidate being tested, Claude drafts the store-listing and ad
 * assets the owner needs to launch a test: a product title, a description, five
 * distinct ad angles, and three Google Responsive Search Ad (RSA) asset sets.
 * Nothing here publishes anything — the output is a DRAFT the owner reviews and
 * approves first (enforced by ListingDraft.status).
 *
 * Like lib/ai/score.ts this module imports no SDK: prompt building and parsing
 * are pure and unit-tested; the network call is injected (lib/ai/anthropic.ts).
 *
 * The Google RSA character limits are hard platform rules — Google truncates or
 * rejects assets over them — so we enforce them on the way out rather than trust
 * the model to count characters.
 */

export const MAX_AD_ANGLES = 5;
export const MAX_RSA_SETS = 3;
export const RSA_HEADLINE_MAX = 30; // Google RSA headline limit
export const RSA_DESCRIPTION_MAX = 90; // Google RSA description limit
const HEADLINES_PER_SET = 5;
const DESCRIPTIONS_PER_SET = 2;
const TITLE_MAX = 70; // sensible product-title / SEO cap

export interface ListingProductInput {
  title: string;
  niche?: string | null;
  estPriceCents?: number | null;
  /** Optional context: prior score rationale, source notes, etc. */
  evidence?: string | null;
}

export interface RsaAssetSet {
  headlines: string[]; // each ≤ RSA_HEADLINE_MAX chars
  descriptions: string[]; // each ≤ RSA_DESCRIPTION_MAX chars
}

export interface ListingCopy {
  title: string;
  description: string;
  adAngles: string[];
  rsaSets: RsaAssetSet[];
}

function dollars(cents?: number | null): string {
  return cents == null ? "unknown" : `$${(cents / 100).toFixed(2)}`;
}

/** Build the user-message text describing what to write. */
export function buildListingPrompt(p: ListingProductInput): string {
  return [
    `Product: ${p.title}`,
    `Niche: ${p.niche?.trim() || "unspecified"}`,
    `Target sell price: ${dollars(p.estPriceCents)}`,
    "",
    "Context (owner notes; may be empty):",
    p.evidence?.trim() || "(none provided)",
    "",
    "Write the listing assets by calling the submit_listing tool:",
    `- title: a compelling product title (≤ ${TITLE_MAX} characters).`,
    "- description: 2–3 short paragraphs, benefit-led and honest.",
    `- adAngles: exactly ${MAX_AD_ANGLES} distinct marketing angles (one sentence each).`,
    `- rsaSets: exactly ${MAX_RSA_SETS} Google Responsive Search Ad sets, each with`,
    `  ${HEADLINES_PER_SET} headlines (≤ ${RSA_HEADLINE_MAX} chars each) and`,
    `  ${DESCRIPTIONS_PER_SET} descriptions (≤ ${RSA_DESCRIPTION_MAX} chars each).`,
    "Stay within the character limits and avoid medical claims, superlatives you",
    "can't back up, and trademarked/brand names.",
  ].join("\n");
}

export const LISTING_SYSTEM_PROMPT = `You are a direct-response e-commerce copywriter for dropshipping stores. You write listing copy and Google Search ad assets that are persuasive but honest — benefit-led, concrete, and compliant. Avoid medical or health claims, unverifiable superlatives ("best in the world"), and any trademarked or brand names. Respect Google Responsive Search Ad character limits exactly: headlines ≤30 characters, descriptions ≤90 characters. Make the three RSA sets genuinely different in angle, not reworded copies. Always answer by calling the submit_listing tool.`;

export const LISTING_TOOL = {
  name: "submit_listing",
  description:
    "Submit the generated listing copy: product title, description, ad angles, and Google RSA asset sets.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: `Product title, ≤${TITLE_MAX} chars.` },
      description: {
        type: "string",
        description: "2–3 short benefit-led paragraphs.",
      },
      adAngles: {
        type: "array",
        description: `${MAX_AD_ANGLES} distinct one-sentence marketing angles.`,
        items: { type: "string" },
      },
      rsaSets: {
        type: "array",
        description: `${MAX_RSA_SETS} Google RSA asset sets.`,
        items: {
          type: "object",
          properties: {
            headlines: {
              type: "array",
              description: `${HEADLINES_PER_SET} headlines, each ≤${RSA_HEADLINE_MAX} chars.`,
              items: { type: "string" },
            },
            descriptions: {
              type: "array",
              description: `${DESCRIPTIONS_PER_SET} descriptions, each ≤${RSA_DESCRIPTION_MAX} chars.`,
              items: { type: "string" },
            },
          },
          required: ["headlines", "descriptions"],
        },
      },
    },
    required: ["title", "description", "adAngles", "rsaSets"],
  },
} as const;

// --- Defensive validation + normalization of the model's tool input ------

const rsaSetRaw = z.object({
  headlines: z.array(z.string()).default([]),
  descriptions: z.array(z.string()).default([]),
});

const toolInputSchema = z.object({
  title: z.string().default(""),
  description: z.string().default(""),
  adAngles: z.array(z.string()).default([]),
  rsaSets: z.array(rsaSetRaw).default([]),
});

const truncate = (s: string, max: number): string => {
  const t = s.trim();
  return t.length <= max ? t : t.slice(0, max).trimEnd();
};

const cleanList = (items: string[], max: number, cap: number): string[] =>
  items
    .map((s) => truncate(s, cap))
    .filter((s) => s.length > 0)
    .slice(0, max);

/**
 * Validate + normalize raw tool input into ListingCopy: trims everything, caps
 * counts (≤5 angles, ≤3 RSA sets, fixed headlines/descriptions per set), and
 * enforces Google's per-asset character limits. Throws on a fundamentally wrong
 * shape so callers don't persist garbage.
 */
export function parseListingCopy(raw: unknown): ListingCopy {
  const parsed = toolInputSchema.parse(raw);

  const rsaSets: RsaAssetSet[] = parsed.rsaSets
    .slice(0, MAX_RSA_SETS)
    .map((set) => ({
      headlines: cleanList(set.headlines, HEADLINES_PER_SET, RSA_HEADLINE_MAX),
      descriptions: cleanList(
        set.descriptions,
        DESCRIPTIONS_PER_SET,
        RSA_DESCRIPTION_MAX,
      ),
    }))
    .filter((set) => set.headlines.length > 0);

  return {
    title: truncate(parsed.title, TITLE_MAX),
    description: parsed.description.trim(),
    adAngles: cleanList(parsed.adAngles, MAX_AD_ANGLES, 200),
    rsaSets,
  };
}

/** Network-call seam (real impl in lib/ai/anthropic.ts; tests inject a fake). */
export type RunListing = (args: {
  system: string;
  user: string;
  tool: typeof LISTING_TOOL;
}) => Promise<unknown>;

/** Generate listing copy end-to-end using an injected model runner. */
export async function generateListingCopy(
  product: ListingProductInput,
  run: RunListing,
): Promise<ListingCopy> {
  const raw = await run({
    system: LISTING_SYSTEM_PROMPT,
    user: buildListingPrompt(product),
    tool: LISTING_TOOL,
  });
  return parseListingCopy(raw);
}
