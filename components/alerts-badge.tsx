import Link from "next/link";

import { prisma } from "@/lib/db";

/** "Alerts" nav link with an unread-count badge (SPEC 2.5). Server component. */
export async function AlertsBadge() {
  const count = await prisma.alert.count({ where: { readAt: null } });

  return (
    <Link
      href="/alerts"
      className="relative rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-black/[.04] dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-white/[.06]"
    >
      Alerts
      {count > 0 && (
        <span className="absolute -right-2 -top-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-semibold text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
