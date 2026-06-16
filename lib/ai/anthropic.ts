import Anthropic from "@anthropic-ai/sdk";

import {
  ANTHROPIC_MODEL,
  LISTING_MAX_TOKENS,
  REVIEW_MAX_TOKENS,
  SCORING_MAX_TOKENS,
} from "./constants";
import type { RunScoring } from "./score";
import type { RunListing } from "./listing";
import type { RunReview } from "./review";

/**
 * Anthropic SDK access, isolated here so the rest of lib/ai stays SDK-agnostic
 * and unit-testable.
 *
 * Resilience (CLAUDE.md rule 5): the SDK retries 429/5xx/overloaded responses
 * with exponential backoff out of the box; we bump `maxRetries` to 3. The client
 * is created lazily and cached so we don't read env or open a client at import
 * time (keeps `npm run build` and tests from needing a key).
 */
let client: Anthropic | null = null;

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set.");
  }
  client ??= new Anthropic({ apiKey, maxRetries: 3 });
  return client;
}

/**
 * Force a single tool call and return its raw input object for the caller's zod
 * layer to validate. Shared by every lib/ai feature that wants structured JSON.
 */
async function forceToolCall(
  system: string,
  user: string,
  tool: { name: string },
  maxTokens: number,
): Promise<unknown> {
  const message = await getClient().messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: maxTokens,
    system,
    tools: [tool as unknown as Anthropic.Tool],
    tool_choice: { type: "tool", name: tool.name },
    messages: [{ role: "user", content: user }],
  });

  const block = message.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") {
    throw new Error("Claude did not return a tool_use block.");
  }
  return block.input;
}

/** Real model runner for product scoring (SPEC 4.1). */
export const runScoringWithClaude: RunScoring = ({ system, user, tool }) =>
  forceToolCall(system, user, tool, SCORING_MAX_TOKENS);

/** Real model runner for listing-copy generation (SPEC 4.2). */
export const runListingWithClaude: RunListing = ({ system, user, tool }) =>
  forceToolCall(system, user, tool, LISTING_MAX_TOKENS);

/** Real model runner for the weekly portfolio review (SPEC 4.4) — plain text. */
export const runReviewWithClaude: RunReview = async ({ system, user }) => {
  const message = await getClient().messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: REVIEW_MAX_TOKENS,
    system,
    messages: [{ role: "user", content: user }],
  });
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
};
