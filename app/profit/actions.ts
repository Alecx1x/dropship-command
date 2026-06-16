"use server";

import { revalidatePath } from "next/cache";

import { metricsRollupQueue } from "@/workers/queues";

/** Enqueue a recompute of the daily profit metrics (SPEC 3.3). */
export async function recomputeMetrics(): Promise<void> {
  try {
    await metricsRollupQueue().add(
      "run",
      {},
      { removeOnComplete: 10, removeOnFail: 10 },
    );
  } catch (err) {
    console.error("Failed to enqueue metrics rollup:", err);
  }
  revalidatePath("/profit");
}
