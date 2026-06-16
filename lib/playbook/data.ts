import { prisma } from "@/lib/db";

import { computeProgress, groupTasks, templateTaskData } from "./template";

/**
 * Load a store's launch checklist, instantiating it on first view (SPEC 4.3).
 *
 * createMany + skipDuplicates (keyed by the @@unique([storeId, key])) makes this
 * idempotent: it backfills any template items the store doesn't have yet without
 * touching ones already there, so existing stores pick up new steps too.
 */
export async function getLaunchPlaybook(storeId: string) {
  await prisma.launchTask.createMany({
    data: templateTaskData(storeId),
    skipDuplicates: true,
  });

  const tasks = await prisma.launchTask.findMany({
    where: { storeId },
    orderBy: { sortOrder: "asc" },
  });

  return { groups: groupTasks(tasks), progress: computeProgress(tasks) };
}
