"use server";

import { revalidatePath } from "next/cache";

import { runWeeklyReview } from "@/lib/review/run";

export type ReviewState = { error: string } | { ok: true; emailed: boolean } | undefined;

/**
 * Generate this week's portfolio review on demand (SPEC 4.4). Runs inline so it
 * works without the worker process; the Sunday cron runs the same code path.
 */
export async function runWeeklyReviewNow(
  _prev: ReviewState,
  _formData: FormData,
): Promise<ReviewState> {
  try {
    const { emailed } = await runWeeklyReview();
    revalidatePath("/reviews");
    return { ok: true, emailed };
  } catch (err) {
    console.error("Weekly review failed:", err);
    return {
      error:
        err instanceof Error && err.message.includes("ANTHROPIC_API_KEY")
          ? "ANTHROPIC_API_KEY is not set — add it to .env to generate a review."
          : "Review generation failed. Check the server logs and try again.",
    };
  }
}
