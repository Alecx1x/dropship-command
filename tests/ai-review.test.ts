import { describe, it, expect, vi } from "vitest";

import {
  buildReviewPrompt,
  generatePortfolioReview,
  REVIEW_SYSTEM_PROMPT,
  type RunReview,
  type WeeklyReviewData,
} from "../lib/ai/review";

function sampleData(): WeeklyReviewData {
  return {
    periodStart: new Date("2026-06-05T00:00:00Z"),
    periodEnd: new Date("2026-06-12T00:00:00Z"),
    currency: "USD",
    stores: [
      {
        name: "Glow",
        currency: "USD",
        thisWeek: {
          revenueCents: 500000,
          netProfitCents: 120000,
          adSpendCents: 150000,
          orders: 80,
          refundCents: 5000,
          roas: 3.33,
        },
        priorWeek: {
          revenueCents: 250000,
          netProfitCents: 40000,
          adSpendCents: 100000,
          orders: 40,
          refundCents: 2000,
          roas: 2.5,
        },
      },
    ],
    topProducts: [
      {
        title: "Neck Fan",
        storeName: "Glow",
        revenueCents: 300000,
        profitCents: 90000,
        refundCents: 1000,
      },
    ],
    worstProducts: [
      {
        title: "Phone Stand",
        storeName: "Glow",
        revenueCents: 20000,
        profitCents: -15000,
        refundCents: 8000,
      },
    ],
  };
}

describe("buildReviewPrompt", () => {
  it("includes the period, per-store money/ROAS, week-over-week deltas, and product lists", () => {
    const prompt = buildReviewPrompt(sampleData());
    expect(prompt).toContain("2026-06-05 to 2026-06-12");
    expect(prompt).toContain("Glow [USD]");
    expect(prompt).toContain("$5000.00"); // revenue this week
    expect(prompt).toContain("+100%"); // revenue doubled WoW
    expect(prompt).toContain("3.33x");
    expect(prompt).toContain("Neck Fan");
    expect(prompt).toContain("Phone Stand");
    expect(prompt).toContain("-$150.00"); // negative profit formatted
  });

  it("handles an empty portfolio without throwing", () => {
    const prompt = buildReviewPrompt({
      periodStart: new Date("2026-06-05T00:00:00Z"),
      periodEnd: new Date("2026-06-12T00:00:00Z"),
      currency: "USD",
      stores: [],
      topProducts: [],
      worstProducts: [],
    });
    expect(prompt).toContain("no stores connected");
  });
});

describe("generatePortfolioReview", () => {
  it("passes the review system prompt + built user prompt and returns trimmed text", async () => {
    const run: RunReview = vi.fn(async () => "  ## Summary\nGood week.  ");
    const out = await generatePortfolioReview(sampleData(), run);

    expect(out).toBe("## Summary\nGood week.");
    const arg = (run as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(arg.system).toBe(REVIEW_SYSTEM_PROMPT);
    expect(arg.user).toContain("Glow [USD]");
  });

  it("throws if the model returns only whitespace", async () => {
    const run: RunReview = vi.fn(async () => "   ");
    await expect(generatePortfolioReview(sampleData(), run)).rejects.toThrow();
  });
});
