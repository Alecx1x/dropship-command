import Link from "next/link";

import { prisma } from "@/lib/db";

/** "Fulfillment" nav link with an open-task count badge (SPEC 2.6). */
export async function FulfillmentBadge() {
  const count = await prisma.fulfillmentTask.count({
    where: { status: { in: ["PENDING", "PLACED"] } },
  });

  return (
    <Link
      href="/fulfillment"
      className="relative rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-black/[.04] dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-white/[.06]"
    >
      Fulfillment
      {count > 0 && (
        <span className="absolute -right-2 -top-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-500 px-1 text-xs font-semibold text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
