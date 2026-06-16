import { describe, it, expect, vi } from "vitest";

import {
  buildScoringPrompt,
  marginMultiple,
  parseScoreResult,
  scoreProduct,
  SCORE_TOOL,
  SCORING_SYSTEM_PROMPT,
  type RunScoring,
} from "../lib/ai/score";

describe("marginMultiple", () => {
  it("computes price ÷ cost", () => {
    expect(marginMultiple(800, 2995)).toBeCloseTo(3.74, 2);
  });

  it("returns null when cost or price is missing or zero", () => {
    expect(marginMultiple(null, 2995)).toBeNull();
    expect(marginMultiple(800, null)).toBeNull();
    expect(marginMultiple(0, 2995)).toBeNull();
    expect(marginMultiple(800, 0)).toBeNull();
  });
});

describe("buildScoringPrompt", () => {
  it("includes title, niche, money, computed multiple, and evidence", () => {
    const prompt = buildScoringPrompt({
      title: "Neck Fan",
      niche: "summer gadgets",
      supplierCostCents: 800,
      estPriceCents: 2995,
      evidence: "Running 6 weeks in Meta Ad Library",
    });
    expect(prompt).toContain("Neck Fan");
    expect(prompt).toContain("summer gadgets");
    expect(prompt).toContain("$8.00");
    expect(prompt).toContain("$29.95");
    expect(prompt).toContain("3.74x");
    expect(prompt).toContain("Meta Ad Library");
    expect(prompt).toContain("submit_score");
  });

  it("degrades gracefully when fields are missing", () => {
    const prompt = buildScoringPrompt({ title: "Mystery Widget" });
    expect(prompt).toContain("unspecified");
    expect(prompt).toContain("unknown");
    expect(prompt).toContain("(none provided)");
  });
});

function rawScore(overall: number) {
  return {
    overallScore: overall,
    rationale: "Solid problem-solver with thin margin evidence.",
    criteria: {
      problemSolving: { score: 80, note: "Solves a real summer comfort problem." },
      wowFactor: { score: 70, note: "Mild scroll-stopper." },
      margin: { score: 60, note: "3.7x is acceptable." },
      shippability: { score: 75, note: "Light, has a battery — check shipping." },
      competition: { score: 50, note: "Somewhat saturated." },
      seasonality: { score: 30, note: "Summer only." },
    },
  };
}

describe("parseScoreResult", () => {
  it("returns the overall score and a rationale containing every criterion", () => {
    const result = parseScoreResult(rawScore(64));
    expect(result.score).toBe(64);
    expect(result.rationale).toContain("thin margin evidence");
    expect(result.rationale).toContain("Problem-solving value (80)");
    expect(result.rationale).toContain("Year-round demand (30)");
    expect(result.rationale).toContain("Summer only.");
  });

  it("clamps and rounds out-of-range / non-integer scores", () => {
    const result = parseScoreResult(rawScore(140));
    expect(result.score).toBe(100);
    expect(parseScoreResult(rawScore(-10)).score).toBe(0);
    expect(parseScoreResult(rawScore(72.6)).score).toBe(73);
  });

  it("coerces numeric strings the model sometimes returns", () => {
    const raw = rawScore(64);
    // @ts-expect-error — simulate a model returning the score as a string
    raw.overallScore = "88";
    expect(parseScoreResult(raw).score).toBe(88);
  });

  it("throws on a fundamentally wrong shape", () => {
    expect(() => parseScoreResult({ nope: true })).toThrow();
    expect(() => parseScoreResult(null)).toThrow();
  });
});

describe("scoreProduct", () => {
  it("passes the system prompt + tool to the runner and returns parsed output", async () => {
    const run: RunScoring = vi.fn(async () => rawScore(64));
    const result = await scoreProduct(
      { title: "Neck Fan", supplierCostCents: 800, estPriceCents: 2995 },
      run,
    );

    expect(result.score).toBe(64);
    expect(run).toHaveBeenCalledOnce();
    const arg = (run as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(arg.system).toBe(SCORING_SYSTEM_PROMPT);
    expect(arg.tool).toBe(SCORE_TOOL);
    expect(arg.user).toContain("Neck Fan");
  });
});
