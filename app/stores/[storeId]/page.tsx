import Link from "next/link";
import type { Prisma } from "@/lib/generated/prisma/client";

import { prisma } from "@/lib/db";
import { formatCents } from "@/lib/format";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;
const NONE = "__none__"; // sentinel for "no fulfillment status" (null)

interface SearchParams {
  page?: string;
  financial?: string;
  fulfillment?: string;
  q?: string;
}

export default async function StoreOrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ storeId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { storeId } = await params;
  const sp = await searchParams;

  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const financial = sp.financial ?? "";
  const fulfillment = sp.fulfillment ?? "";
  const q = (sp.q ?? "").trim();

  const where: Prisma.OrderWhereInput = { storeId };
  if (financial) where.financialStatus = financial;
  if (fulfillment === NONE) where.fulfillmentStatus = null;
  else if (fulfillment) where.fulfillmentStatus = fulfillment;
  if (q) {
    where.OR = [
      { orderNumber: { contains: q, mode: "insensitive" } },
      { customerEmail: { contains: q, mode: "insensitive" } },
    ];
  }

  const [total, orders, financialValues, fulfillmentValues, store] =
    await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        orderBy: { placedAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: { _count: { select: { items: true } } },
      }),
      prisma.order.findMany({
        where: { storeId },
        select: { financialStatus: true },
        distinct: ["financialStatus"],
        orderBy: { financialStatus: "asc" },
      }),
      prisma.order.findMany({
        where: { storeId },
        select: { fulfillmentStatus: true },
        distinct: ["fulfillmentStatus"],
      }),
      prisma.store.findUnique({
        where: { id: storeId },
        select: { currency: true },
      }),
    ]);

  const currency = store?.currency ?? "USD";
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function hrefFor(nextPage: number): string {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (financial) params.set("financial", financial);
    if (fulfillment) params.set("fulfillment", fulfillment);
    params.set("page", String(nextPage));
    return `/stores/${storeId}?${params.toString()}`;
  }

  return (
    <div>
      {/* Filters (GET form → query params) */}
      <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">Search</span>
          <input
            name="q"
            defaultValue={q}
            placeholder="Order # or email"
            className="w-56 rounded-md border border-zinc-300 bg-transparent px-3 py-1.5 text-sm dark:border-zinc-700"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">Financial</span>
          <select
            name="financial"
            defaultValue={financial}
            className="rounded-md border border-zinc-300 bg-transparent px-3 py-1.5 text-sm dark:border-zinc-700"
          >
            <option value="">Any</option>
            {financialValues.map((v) => (
              <option key={v.financialStatus} value={v.financialStatus}>
                {v.financialStatus}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">Fulfillment</span>
          <select
            name="fulfillment"
            defaultValue={fulfillment}
            className="rounded-md border border-zinc-300 bg-transparent px-3 py-1.5 text-sm dark:border-zinc-700"
          >
            <option value="">Any</option>
            {fulfillmentValues.map((v) => (
              <option
                key={v.fulfillmentStatus ?? NONE}
                value={v.fulfillmentStatus ?? NONE}
              >
                {v.fulfillmentStatus ?? "unfulfilled"}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-md border border-zinc-300 px-4 py-1.5 text-sm font-medium text-zinc-700 hover:bg-black/[.04] dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-white/[.06]"
        >
          Filter
        </button>
      </form>

      {orders.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 p-12 text-center text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          No orders match. Use “Sync orders” on the Stores page to backfill.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                  <th className="py-2 pr-4 font-medium">Order</th>
                  <th className="py-2 pr-4 font-medium">Date</th>
                  <th className="py-2 pr-4 font-medium">Financial</th>
                  <th className="py-2 pr-4 font-medium">Fulfillment</th>
                  <th className="py-2 pr-4 font-medium">Customer</th>
                  <th className="py-2 pr-4 font-medium">Items</th>
                  <th className="py-2 font-medium text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr
                    key={o.id}
                    className="border-b border-zinc-100 dark:border-zinc-900"
                  >
                    <td className="py-2.5 pr-4 font-medium text-black dark:text-zinc-50">
                      {o.orderNumber}
                    </td>
                    <td className="py-2.5 pr-4 text-zinc-600 dark:text-zinc-300">
                      {o.placedAt.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="py-2.5 pr-4 text-zinc-600 dark:text-zinc-300">
                      {o.financialStatus}
                    </td>
                    <td className="py-2.5 pr-4 text-zinc-600 dark:text-zinc-300">
                      {o.fulfillmentStatus ?? "unfulfilled"}
                    </td>
                    <td className="py-2.5 pr-4 text-zinc-600 dark:text-zinc-300">
                      {o.customerEmail ?? "—"}
                    </td>
                    <td className="py-2.5 pr-4 text-zinc-600 dark:text-zinc-300">
                      {o._count.items}
                    </td>
                    <td className="py-2.5 text-right font-medium text-black dark:text-zinc-50">
                      {formatCents(o.revenueCents, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="mt-4 flex items-center justify-between text-sm text-zinc-500 dark:text-zinc-400">
            <span>
              {total} order{total === 1 ? "" : "s"} · page {page} of {totalPages}
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
