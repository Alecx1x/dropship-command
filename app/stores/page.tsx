import Link from "next/link";

import { prisma } from "@/lib/db";
import { importStoreProductsAction, syncStoreOrders } from "./actions";

export const dynamic = "force-dynamic";

export default async function StoresPage() {
  const stores = await prisma.store.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { products: true, orders: true } } },
  });

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <Link
            href="/"
            className="text-sm text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            ← Home
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Stores
          </h1>
        </div>
        <Link
          href="/stores/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Connect a store
        </Link>
      </div>

      {stores.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
          <p className="text-zinc-600 dark:text-zinc-400">
            No stores connected yet.
          </p>
          <Link
            href="/stores/new"
            className="mt-3 inline-block text-sm font-medium text-zinc-900 underline dark:text-zinc-100"
          >
            Connect your first store
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {stores.map((store) => (
            <li
              key={store.id}
              className="flex items-center justify-between rounded-xl border border-black/[.08] bg-white p-5 dark:border-white/[.145] dark:bg-zinc-950"
            >
              <div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/stores/${store.id}`}
                    className="font-medium text-black hover:underline dark:text-zinc-50"
                  >
                    {store.name}
                  </Link>
                  <StatusBadge status={store.status} />
                </div>
                <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                  {store.shopDomain} · {store.currency}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right text-sm text-zinc-500 dark:text-zinc-400">
                  <Link
                    href={`/stores/${store.id}/products`}
                    className="block hover:text-zinc-800 hover:underline dark:hover:text-zinc-200"
                  >
                    {store._count.products} products
                  </Link>
                  <div>{store._count.orders} orders</div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <form action={importStoreProductsAction}>
                    <input type="hidden" name="storeId" value={store.id} />
                    <button
                      type="submit"
                      className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-black/[.04] dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-white/[.06]"
                    >
                      Import products
                    </button>
                  </form>
                  <form action={syncStoreOrders}>
                    <input type="hidden" name="storeId" value={store.id} />
                    <button
                      type="submit"
                      className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-black/[.04] dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-white/[.06]"
                    >
                      Sync orders
                    </button>
                  </form>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    PAUSED: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    ARCHIVED: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? styles.ARCHIVED}`}
    >
      {status.toLowerCase()}
    </span>
  );
}
