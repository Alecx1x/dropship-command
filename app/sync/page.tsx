import Link from "next/link";
import type { Prisma } from "@/lib/generated/prisma/client";

import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
const KINDS = ["ORDERS", "PRODUCTS", "STOCK", "PRICES", "ADS"] as const;

interface SearchParams {
  page?: string;
  store?: string;
  kind?: string;
  status?: string; // "ok" | "failed"
}

function duration(start: Date, end: Date | null): string {
  if (!end) return "—";
  const ms = end.getTime() - start.getTime();
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default async function SyncHealthPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const store = sp.store ?? "";
  const kind = sp.kind ?? "";
  const status = sp.status ?? "";

  const where: Prisma.SyncLogWhereInput = {};
  if (store) where.storeId = store;
  if (kind) where.kind = kind as (typeof KINDS)[number];
  if (status === "ok") where.ok = true;
  if (status === "failed") where.ok = false;

  const [total, logs, stores] = await Promise.all([
    prisma.syncLog.count({ where }),
    prisma.syncLog.findMany({
      where,
      orderBy: { startedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { store: { select: { name: true } } },
    }),
    prisma.store.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function hrefFor(nextPage: number): string {
    const params = new URLSearchParams();
    if (store) params.set("store", store);
    if (kind) params.set("kind", kind);
    if (status) params.set("status", status);
    params.set("page", String(nextPage));
    return `/sync?${params.toString()}`;
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Link
        href="/"
        className="text-sm text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
      >
        ← Dashboard
      </Link>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
        Sync health
      </h1>

      <form method="get" className="mt-6 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">Store</span>
          <select
            name="store"
            defaultValue={store}
            className="rounded-md border border-zinc-300 bg-transparent px-3 py-1.5 text-sm dark:border-zinc-700"
          >
            <option value="">All</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">Kind</span>
          <select
            name="kind"
            defaultValue={kind}
            className="rounded-md border border-zinc-300 bg-transparent px-3 py-1.5 text-sm dark:border-zinc-700"
          >
            <option value="">All</option>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">Status</span>
          <select
            name="status"
            defaultValue={status}
            className="rounded-md border border-zinc-300 bg-transparent px-3 py-1.5 text-sm dark:border-zinc-700"
          >
            <option value="">All</option>
            <option value="ok">OK</option>
            <option value="failed">Failed</option>
          </select>
        </label>
        <button
          type="submit"
          className="rounded-md border border-zinc-300 px-4 py-1.5 text-sm font-medium text-zinc-700 hover:bg-black/[.04] dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-white/[.06]"
        >
          Filter
        </button>
      </form>

      {logs.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-zinc-300 p-12 text-center text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          No sync runs match.
        </p>
      ) : (
        <>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Kind</th>
                  <th className="py-2 pr-4 font-medium">Store</th>
                  <th className="py-2 pr-4 font-medium">Started</th>
                  <th className="py-2 pr-4 font-medium">Took</th>
                  <th className="py-2 pr-4 font-medium">Items</th>
                  <th className="py-2 font-medium">Error</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr
                    key={l.id}
                    className="border-b border-zinc-100 align-top dark:border-zinc-900"
                  >
                    <td className="py-2.5 pr-4">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          l.ok
                            ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                            : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                        }`}
                      >
                        {l.ok ? "ok" : "failed"}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-zinc-600 dark:text-zinc-300">
                      {l.kind}
                    </td>
                    <td className="py-2.5 pr-4 text-zinc-600 dark:text-zinc-300">
                      {l.store?.name ?? "—"}
                    </td>
                    <td className="py-2.5 pr-4 text-zinc-600 dark:text-zinc-300">
                      {l.startedAt.toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-2.5 pr-4 text-zinc-600 dark:text-zinc-300">
                      {duration(l.startedAt, l.finishedAt)}
                    </td>
                    <td className="py-2.5 pr-4 text-zinc-600 dark:text-zinc-300">
                      {l.itemsTouched}
                    </td>
                    <td className="py-2.5 max-w-xs truncate text-red-600 dark:text-red-400">
                      {l.errorText ?? ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-zinc-500 dark:text-zinc-400">
            <span>
              {total} run{total === 1 ? "" : "s"} · page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={hrefFor(page - 1)}
                  className="rounded-md border border-zinc-300 px-3 py-1 hover:bg-black/[.04] dark:border-zinc-700 dark:hover:bg-white/[.06]"
                >
                  ← Prev
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={hrefFor(page + 1)}
                  className="rounded-md border border-zinc-300 px-3 py-1 hover:bg-black/[.04] dark:border-zinc-700 dark:hover:bg-white/[.06]"
                >
                  Next →
                </Link>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
