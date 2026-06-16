/**
 * Anthropic model + request constants, pinned in one place (mirrors
 * lib/shopify/constants.ts pinning the Shopify API version).
 *
 * Default is Claude Sonnet 4.6: strong judgment for product scoring at far lower
 * cost than Opus. That matters here because scoring runs once per research item
 * and the owner is cost-conscious until store #3 is profitable (CLAUDE.md owner
 * context). Override with ANTHROPIC_MODEL to use another tier, e.g.
 * "claude-opus-4-8" for the weekly review (Phase 4.4) where quality > cost.
 */
export const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

/** Output-token cap for a scoring call — the rationale is intentionally short. */
export const SCORING_MAX_TOKENS = 1024;

/** Output-token cap for a listing-copy call (title + description + angles + RSA). */
export const LISTING_MAX_TOKENS = 2048;

/** Output-token cap for the weekly portfolio review (a written markdown report). */
export const REVIEW_MAX_TOKENS = 2048;
