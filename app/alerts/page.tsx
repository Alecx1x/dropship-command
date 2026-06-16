import Link from "next/link";

import { prisma } from "@/lib/db";
import { markAlertRead, markAllAlertsRead } from "./actions";

export const dynamic = "force-dynamic";

const SEVERITY_STYLES: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  HIGH: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  MEDIUM: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  LOW: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
};

export default async function AlertsPage() {
  const alerts = await prisma.alert.findMany({
    orderBy: [{ readAt: "asc" }, { createdAt: "desc" }],
    take: 100,
    include: { store: { select: { name: true } } },
  });
  const unread = alerts.filter((a) => a.readAt === null).length;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            href="/"
            className="text-sm text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            ← Dashboard
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Alerts{unread > 0 ? ` (${unread} unread)` : ""}
          </h1>
        </div>
        {unread > 0 && (
          <form action={markAllAlertsRead}>
            <button
              type="submit"
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-black/[.04] dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-white/[.06]"
            >
              Mark all read
            </button>
          </form>
        )}
      </div>

      {alerts.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 p-12 text-center text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          No alerts. You&apos;re all caught up.
        </p>
      ) : (
        <ul className="space-y-2">
          {alerts.map((a) => {
            const isUnread = a.readAt === null;
            return (
              <li
                key={a.id}
                className={`flex items-start justify-between gap-4 rounded-xl border p-4 ${
                  isUnread
                    ? "border-black/[.12] bg-white dark:border-white/20 dark:bg-zinc-950"
                    : "border-black/[.06] bg-zinc-50/50 dark:border-white/[.08] dark:bg-zinc-950/40"
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        SEVERITY_STYLES[a.severity] ?? SEVERITY_STYLES.LOW
                      }`}
                    >
                      {a.severity.toLowerCase()}
                    </span>
                    <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      {a.kind}
                    </span>
                    {a.store?.name && (
                      <span className="text-xs text-zinc-400">· {a.store.name}</span>
                    )}
                    {isUnread && (
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                    )}
                  </div>
                  <p
                    className={`mt-1 text-sm ${
                      isUnread
                        ? "text-black dark:text-zinc-50"
                        : "text-zinc-500 dark:text-zinc-400"
                    }`}
                  >
                    {a.message}
                  </p>
                  <p className="mt-1 text-xs text-zinc-400">
                    {a.createdAt.toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                {isUnread && (
                  <form action={markAlertRead}>
                    <input type="hidden" name="alertId" value={a.id} />
                    <button
                      type="submit"
                      className="shrink-0 rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-black/[.04] dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-white/[.06]"
                    >
                      Mark read
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
