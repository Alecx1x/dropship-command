import Link from "next/link";

import { auth, signOut } from "@/auth";
import { AlertsBadge } from "@/components/alerts-badge";
import { FulfillmentBadge } from "@/components/fulfillment-badge";
import { RevenueChart } from "@/components/revenue-chart";
import { getDashboardData } from "@/lib/dashboard/data";
import { type StoreMetrics } from "@/lib/dashboard/metrics";
import { formatCents } from "@/lib/format";
import { recentSyncFailureCount } from "@/lib/sync/health";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await auth();
  const data = await getDashboardData();
  const syncFailures = await recentSyncFailureCount();

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Portfolio
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {session?.user?.email}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Link
            href="/guide"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-black/[.04] dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-white/[.06]"
          >
            Guide
          </Link>
          <Link
            href="/research"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-black/[.04] dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-white/[.06]"
          >
            Research
          </Link>
          <Link
            href="/reviews"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-black/[.04] dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-white/[.06]"
          >
            Review
          </Link>
          <Link
            href="/profit"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-black/[.04] dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-white/[.06]"
          >
            Profit
          </Link>
          <Link
            href="/sync"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-black/[.04] dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-white/[.06]"
          >
            Sync
          </Link>
          <FulfillmentBadge />
          <AlertsBadge />
          <Link
            href="/stores"
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Stores
          </Link>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-black/[.04] dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-white/[.06]"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      {syncFailures > 0 && (
        <Link
          href="/sync?status=failed"
          className="mb-6 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
        >
          <span>
            {syncFailures} sync{syncFailures === 1 ? "" : "s"} failed in the last
            24 hours.
          </span>
          <span className="font-medium">Review →</span>
        </Link>
      )}

      {data.stores.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
          <p className="text-zinc-600 dark:text-zinc-400">
            No stores connected yet.
          </p>
          <Link
            href="/stores/new"
            className="mt-3 inline-block text-sm font-medium underline"
          >
            Connect your first store
          </Link>
        </div>
      ) : (
        <>
          {/* Combined totals */}
          <section className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Revenue today" value={formatCents(data.totals.revenueTodayCents, data.currency)} />
            <Stat label="Revenue 7d" value={formatCents(data.totals.revenue7dCents, data.currency)} />
            <Stat label="Revenue 30d" value={formatCents(data.totals.revenue30dCents, data.currency)} />
            <Stat label="Orders 30d" value={String(data.totals.orders30d)} />
          </section>

          {/* Revenue over time */}
          <section className="mb-8 rounded-xl border border-black/[.08] bg-white p-5 dark:border-white/[.145] dark:bg-zinc-950">
            <h2 className="mb-4 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Revenue — last 30 days
            </h2>
            <RevenueChart
              data={data.series}
              stores={data.stores.map((s) => ({ id: s.id, name: s.name }))}
            />
          </section>

          {/* Per-store cards */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {data.stores.map((store) => (
              <StoreCard key={store.id} store={store} />
            ))}
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-black/[.08] bg-white p-4 dark:border-white/[.145] dark:bg-zinc-950">
      <div className="text-xs uppercase tracking-wide text-zinc-400">{label}</div>
      <div className="mt-1 text-xl font-semibold text-black dark:text-zinc-50">
        {value}
      </div>
    </div>
  );
}

function StoreCard({ store }: { store: StoreMetrics }) {
  return (
    <Link
      href={`/stores/${store.id}`}
      className="block rounded-xl border border-black/[.08] bg-white p-5 transition-colors hover:border-zinc-300 dark:border-white/[.145] dark:bg-zinc-950 dark:hover:border-zinc-700"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SyncDot sync={store.sync} />
          <span className="font-medium text-black dark:text-zinc-50">
            {store.name}
          </span>
        </div>
        <span className="text-xs text-zinc-400">{store.shopDomain}</span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Mini label="Today" value={formatCents(store.revenueTodayCents, store.currency)} />
        <Mini label="7d" value={formatCents(store.revenue7dCents, store.currency)} />
        <Mini label="30d" value={formatCents(store.revenue30dCents, store.currency)} />
      </div>
      <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
        {store.orders30d} orders · last 30 days
      </div>
    </Link>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-zinc-400">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-black dark:text-zinc-50">
        {value}
      </div>
    </div>
  );
}

function SyncDot({ sync }: { sync: StoreMetrics["sync"] }) {
  const color =
    sync === null
      ? "bg-zinc-300 dark:bg-zinc-600"
      : sync.ok
        ? "bg-green-500"
        : "bg-red-500";
  const title =
    sync === null
      ? "Never synced"
      : sync.ok
        ? `Last ${sync.kind.toLowerCase()} sync ok`
        : `Last ${sync.kind.toLowerCase()} sync failed`;
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${color}`}
      title={title}
    />
  );
}
