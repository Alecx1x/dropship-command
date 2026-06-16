import { prisma } from "../db";

/**
 * Count sync runs that failed in the last 24h (SPEC 2.7). Drives the dashboard's
 * red "sync health" banner. Uses startedAt so a run that died without writing
 * finishedAt still counts.
 */
export async function recentSyncFailureCount(
  now: Date = new Date(),
): Promise<number> {
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return prisma.syncLog.count({
    where: { ok: false, startedAt: { gte: since } },
  });
}
