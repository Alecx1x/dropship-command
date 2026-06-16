import Link from "next/link";

import { getProfitDashboard, type ProfitWindow } from "@/lib/profit/dashboard";
import { marginRatioPct } from "@/lib/profit/profit";
import { formatCents } from "@/lib/format";
import { recomputeMetrics } from "./actions";

export const dynamic = "force-dynamic";

function roasLabel(x: number | null): string {
  return x === null ? "—" : `${x.toFixed(2)}x`;
}

function profitClass(cents: number): string {
  return cents >= 0
    ? "text-green-600 dark:text-green-400"
    : "text-red-600 dark:text-red-400";
}

export default async function ProfitPage() {
  const data = await getProfitDashboard();
  const c = data.currency;
  const profitable =
    data.totals.roas30 !== null &&
    data.totals.breakevenRoas30 !== null &&
    data.totals.roas30 >= data.totals.breakevenRoas30;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <Link
            href="/"
            className="text-sm text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            ← Dashboard
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Profit
          </h1>
          <p className="mt-1 text-xs text-zinc-400">
            Reflects the latest metrics rollup.
          </p>
        </div>
        <form action={recomputeMetrics}>
          <button
            type="submit"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-black/[.04] dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-white/[.06]"
          >
            Recompute
          </button>
        </form>
      </div>

      {/* 30-day totals */}
      <section className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Revenue 30d" value={formatCents(data.totals.revenueCents, c)} />
        <Stat label="Ad spend 30d" value={formatCents(data.totals.adSpendCents, c)} />
        <Stat
          label="Net profit 30d"
          value={formatCents(data.totals.netProfitCents, c)}
          valueClass={profitClass(data.totals.netProfitCents)}
        />
        <Stat
          label="Blended ROAS"
          value={roasLabel(data.totals.roas30)}
          sub={`breakeven ${roasLabel(data.totals.breakevenRoas30)}`}
          valueClass={
            profitable
              ? "text-green-600 dark:text-green-400"
              : "text-zinc-900 dark:text-zinc-50"
          }
        />
      </section>

      {/* Per-store */}
      <h2 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        By store
      </h2>
      <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {data.stores.map((s) => {
          const margin = marginRatioPct(
            s.d30.netProfitCents,
            s.d30.revenueCents,
          );
          const ok =
            s.roas30 !== null &&
            s.breakevenRoas30 !== null &&
            s.roas30 >= s.breakevenRoas30;
          return (
            <div
              key={s.id}
              className="rounded-xl border border-black/[.08] bg-white p-5 dark:border-white/[.145] dark:bg-zinc-950"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-black dark:text-zinc-50">
                  {s.name}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    ok
                      ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                  }`}
                >
                  ROAS {roasLabel(s.roas30)} / be {roasLabel(s.breakevenRoas30)}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <NetProfit label="Today" w={s.today} currency={c} />
                <NetProfit label="7d" w={s.d7} currency={c} />
                <NetProfit label="30d" w={s.d30} currency={c} />
              </div>
              <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                30d net margin {margin === null ? "—" : `${margin.toFixed(0)}%`}
              </div>
            </div>
          );
        })}
      </section>

      {/* Kill / scale list */}
      <h2 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Products — profit ranked (30d)
      </h2>
      {data.products.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 p-12 text-center text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          No product profit yet. Connect a store and sync orders.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                <th className="py-2 pr-4 font-medium">#</th>
                <th className="py-2 pr-4 font-medium">Product</th>
                <th className="py-2 pr-4 font-medium text-right">Revenue 30d</th>
                <th className="py-2 pr-4 font-medium text-right">Refund %</th>
                <th className="py-2 font-medium text-right">Profit 30d</th>
              </tr>
            </thead>
            <tbody>
              {data.products.map((p, i) => (
                <tr
                  key={p.id}
                  className="border-b border-zinc-100 dark:border-zinc-900"
                >
                  <td className="py-2.5 pr-4 text-zinc-400">{i + 1}</td>
                  <td className="py-2.5 pr-4">
                    <div className="font-medium text-black dark:text-zinc-50">
                      {p.title}
                    </div>
                    <div className="text-xs text-zinc-400">{p.storeName}</div>
                  </td>
                  <td className="py-2.5 pr-4 text-right text-zinc-600 dark:text-zinc-300">
                    {formatCents(p.revenueCents, c)}
                  </td>
                  <td className="py-2.5 pr-4 text-right">
                    {(() => {
                      const rate =
                        p.revenueCents > 0
                          ? (p.refundCents / p.revenueCents) * 100
                          : 0;
                      return (
                        <span
                          className={
                            rate >= 5
                              ? "text-red-600 dark:text-red-400"
                              : "text-zinc-500 dark:text-zinc-400"
                          }
                        >
                          {rate.toFixed(0)}%
                        </span>
                      );
                    })()}
                  </td>
                  <td
                    className={`py-2.5 text-right font-medium ${profitClass(p.profitCents)}`}
                  >
                    {formatCents(p.profitCents, c)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  valueClass,
}: {
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-xl border border-black/[.08] bg-white p-4 dark:border-white/[.145] dark:bg-zinc-950">
      <div className="text-xs uppercase tracking-wide text-zinc-400">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${valueClass ?? "text-black dark:text-zinc-50"}`}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-zinc-400">{sub}</div>}
    </div>
  );
}

function NetProfit({
  label,
  w,
  currency,
}: {
  label: string;
  w: ProfitWindow;
  currency: string;
}) {
  return (
    <div>
      <div className="text-xs text-zinc-400">{label}</div>
      <div
        className={`mt-0.5 text-sm font-semibold ${
          w.netProfitCents >= 0
            ? "text-green-600 dark:text-green-400"
            : "text-red-600 dark:text-red-400"
        }`}
      >
        {formatCents(w.netProfitCents, currency)}
      </div>
    </div>
  );
}
