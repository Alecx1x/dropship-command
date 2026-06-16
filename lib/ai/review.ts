/**
 * Weekly portfolio review generation (SPEC 4.4).
 *
 * Claude receives each store's this-week-vs-prior-week metrics and the week's
 * best/worst products, and writes a concise markdown review: what to scale, what
 * to kill, and any anomalies. Like the rest of lib/ai this module imports no
 * SDK — prompt building is pure and unit-tested; the call is injected.
 *
 * Unlike scoring/listing this asks for prose, not a tool call, so the runner
 * returns plain text (lib/ai/anthropic.ts → runReviewWithClaude).
 */

export interface WeeklyWindow {
  revenueCents: number;
  netProfitCents: number; // profit before ads − ad spend
  adSpendCents: number;
  orders: number;
  refundCents: number;
  roas: number | null;
}

export interface StoreWeekly {
  name: string;
  currency: string;
  thisWeek: WeeklyWindow;
  priorWeek: WeeklyWindow;
}

export interface ProductWeekly {
  title: string;
  storeName: string;
  revenueCents: number;
  profitCents: number;
  refundCents: number;
}

export interface WeeklyReviewData {
  periodStart: Date;
  periodEnd: Date;
  currency: string;
  stores: StoreWeekly[];
  topProducts: ProductWeekly[];
  worstProducts: ProductWeekly[];
}

function usd(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
}

function roasLabel(r: number | null): string {
  return r === null ? "n/a" : `${r.toFixed(2)}x`;
}

/** Week-over-week change as a signed percentage string, or "n/a" with no base. */
function delta(curr: number, prior: number): string {
  if (prior === 0) return curr === 0 ? "0%" : "n/a";
  const pct = Math.round(((curr - prior) / Math.abs(prior)) * 100);
  return `${pct >= 0 ? "+" : ""}${pct}%`;
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Build the user message: a compact, factual dump of the week's numbers. */
export function buildReviewPrompt(data: WeeklyReviewData): string {
  const lines: string[] = [
    `Reporting period: ${isoDay(data.periodStart)} to ${isoDay(data.periodEnd)} (this week vs the prior 7 days).`,
    "",
    "PER STORE:",
  ];

  if (data.stores.length === 0) {
    lines.push("(no stores connected)");
  }

  for (const s of data.stores) {
    const t = s.thisWeek;
    const p = s.priorWeek;
    lines.push(
      `- ${s.name} [${s.currency}]`,
      `    Revenue: ${usd(t.revenueCents)} (prior ${usd(p.revenueCents)}, ${delta(t.revenueCents, p.revenueCents)})`,
      `    Net profit: ${usd(t.netProfitCents)} (prior ${usd(p.netProfitCents)})`,
      `    Ad spend: ${usd(t.adSpendCents)} | ROAS: ${roasLabel(t.roas)} (prior ${roasLabel(p.roas)})`,
      `    Orders: ${t.orders} (prior ${p.orders}) | Refunds: ${usd(t.refundCents)}`,
    );
  }

  if (data.topProducts.length > 0) {
    lines.push("", "TOP PRODUCTS THIS WEEK (by profit):");
    data.topProducts.forEach((pr, i) =>
      lines.push(
        `  ${i + 1}. ${pr.title} (${pr.storeName}): profit ${usd(pr.profitCents)} on revenue ${usd(pr.revenueCents)}`,
      ),
    );
  }

  if (data.worstProducts.length > 0) {
    lines.push("", "WEAKEST PRODUCTS THIS WEEK (by profit):");
    data.worstProducts.forEach((pr, i) =>
      lines.push(
        `  ${i + 1}. ${pr.title} (${pr.storeName}): profit ${usd(pr.profitCents)} on revenue ${usd(pr.revenueCents)}, refunds ${usd(pr.refundCents)}`,
      ),
    );
  }

  lines.push(
    "",
    "Write the weekly review now using only the numbers above.",
  );
  return lines.join("\n");
}

export const REVIEW_SYSTEM_PROMPT = `You are a portfolio analyst for a multi-store dropshipping operator. Write a concise weekly review in markdown with these sections:

## Summary — 2–3 sentences on overall portfolio health this week.
## Scale — products/stores that are profitable and improving; say what to push and why.
## Kill or fix — products/stores losing money, with ROAS below breakeven, or with high refunds; be decisive.
## Anomalies — notable week-over-week swings (big revenue/profit moves, refund spikes, sudden drops).
## Next actions — a short, prioritized checklist.

Tie every recommendation to the specific numbers provided. Do not invent data or metrics that aren't given. Money is already in each store's currency. Be decisive and brief — the operator wants decisions, not filler. If there's no data, say so plainly.`;

/** Network-call seam returning the model's text (real impl in anthropic.ts). */
export type RunReview = (args: {
  system: string;
  user: string;
}) => Promise<string>;

/** Generate the weekly review markdown using an injected text runner. */
export async function generatePortfolioReview(
  data: WeeklyReviewData,
  run: RunReview,
): Promise<string> {
  const text = await run({
    system: REVIEW_SYSTEM_PROMPT,
    user: buildReviewPrompt(data),
  });
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Empty review returned from the model.");
  return trimmed;
}
