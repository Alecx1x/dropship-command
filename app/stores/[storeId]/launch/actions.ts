"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";

/**
 * Toggle a launch checklist item done/undone (SPEC 4.3). Scoped by storeId for
 * tenant isolation (CLAUDE.md rule 1) via updateMany's compound where. The
 * checkbox submits a `done` field only when checked, so its absence = unchecked.
 */
export async function toggleLaunchTask(formData: FormData): Promise<void> {
  const storeId = String(formData.get("storeId") ?? "");
  const taskId = String(formData.get("taskId") ?? "");
  if (!storeId || !taskId) return;

  const done = formData.get("done") != null;

  await prisma.launchTask.updateMany({
    where: { id: taskId, storeId },
    data: { done, completedAt: done ? new Date() : null },
  });

  revalidatePath(`/stores/${storeId}/launch`);
}
