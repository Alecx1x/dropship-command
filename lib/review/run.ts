import { runReviewWithClaude } from "../ai/anthropic";
import { generatePortfolioReview } from "../ai/review";
import { prisma } from "../db";
import { sendEmail } from "../notify/email";
import { gatherWeeklyReviewData } from "./data";

/**
 * Generate, save, and email the weekly portfolio review (SPEC 4.4). Shared by
 * the Sunday cron (workers) and the manual "run now" action. Emailing reuses the
 * Resend helper (2.5) and no-ops cleanly if email isn't configured — the review
 * is still saved and viewable in the app either way.
 */
export async function runWeeklyReview(
  now: Date = new Date(),
): Promise<{ id: string; emailed: boolean }> {
  const data = await gatherWeeklyReviewData(now);
  const content = await generatePortfolioReview(data, runReviewWithClaude);

  const review = await prisma.portfolioReview.create({
    data: {
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      content,
    },
  });

  const subject = `Weekly portfolio review — week of ${data.periodStart
    .toISOString()
    .slice(0, 10)}`;
  const emailed = await sendEmail(subject, content);
  if (emailed) {
    await prisma.portfolioReview.update({
      where: { id: review.id },
      data: { emailedAt: new Date() },
    });
  }

  return { id: review.id, emailed };
}
