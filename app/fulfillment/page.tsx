import Link from "next/link";

import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/db";
import { markTaskPlaced, markTaskShipped } from "./actions";

export const dynamic = "force-dynamic";

export default async function FulfillmentPage() {
  const session = await auth();
  const isVa = session?.user?.role === "VA";

  const tasks = await prisma.fulfillmentTask.findMany({
    where: { status: { in: ["PENDING", "PLACED"] } },
    orderBy: { createdAt: "asc" },
    take: 100,
    include: {
      order: { select: { orderNumber: true, customerEmail: true } },
      store: { select: { name: true } },
    },
  });

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      {isVa ? (
        // A VA has no dashboard to go back to — offer sign-out instead.
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button
            type="submit"
            className="text-sm text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            Sign out
          </button>
        </form>
      ) : (
        <Link
          href="/"
          className="text-sm text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          ← Dashboard
        </Link>
      )}
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
        Fulfillment{tasks.length > 0 ? ` (${tasks.length} open)` : ""}
      </h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        Place each order with the supplier, then record the tracking number to
        mark it shipped.
      </p>

      {tasks.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-zinc-300 p-12 text-center text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          No open fulfillment tasks.
        </p>
      ) : (
        <ul className="mt-8 space-y-3">
          {tasks.map((t) => (
            <li
              key={t.id}
              className="rounded-xl border border-black/[.08] bg-white p-5 dark:border-white/[.145] dark:bg-zinc-950"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-black dark:text-zinc-50">
                    {t.order.orderNumber}
                  </span>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    {t.status.toLowerCase()}
                  </span>
                  <span className="text-xs text-zinc-400">
                    {t.supplierType.toLowerCase()} · {t.store.name}
                  </span>
                </div>
                {t.supplierUrl && (
                  <a
                    href={t.supplierUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                  >
                    Open supplier ↗
                  </a>
                )}
              </div>
              <p className="mt-1 text-xs text-zinc-400">
                {t.order.customerEmail ?? "no customer email"}
              </p>

              <div className="mt-4 flex flex-wrap items-end gap-3">
                {t.status === "PENDING" && (
                  <form action={markTaskPlaced}>
                    <input type="hidden" name="taskId" value={t.id} />
                    <button
                      type="submit"
                      className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-black/[.04] dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-white/[.06]"
                    >
                      Mark placed
                    </button>
                  </form>
                )}
                <form action={markTaskShipped} className="flex items-end gap-2">
                  <input type="hidden" name="taskId" value={t.id} />
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-zinc-500">Tracking #</span>
                    <input
                      name="trackingNumber"
                      className="w-40 rounded-md border border-zinc-300 bg-transparent px-2 py-1 text-sm dark:border-zinc-700"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-zinc-500">Carrier</span>
                    <input
                      name="carrier"
                      className="w-28 rounded-md border border-zinc-300 bg-transparent px-2 py-1 text-sm dark:border-zinc-700"
                    />
                  </label>
                  <button
                    type="submit"
                    className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-black/[.04] dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-white/[.06]"
                  >
                    Mark shipped
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
