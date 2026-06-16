import { AdsCsvImport } from "@/components/ads-csv-import";
import { prisma } from "@/lib/db";
import { formatCents } from "@/lib/format";
import { addAdSpendManual } from "./actions";

export const dynamic = "force-dynamic";

const CHANNELS = ["GOOGLE", "META", "TIKTOK", "OTHER"] as const;

export default async function StoreAdsPage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;

  const [spend, store] = await Promise.all([
    prisma.adSpend.findMany({
      where: { storeId },
      orderBy: [{ date: "desc" }, { channel: "asc" }],
      take: 60,
    }),
    prisma.store.findUnique({ where: { id: storeId }, select: { currency: true } }),
  ]);
  const currency = store?.currency ?? "USD";

  return (
    <div className="space-y-8">
      {/* Add spend */}
      <section className="rounded-xl border border-black/[.08] bg-white p-5 dark:border-white/[.145] dark:bg-zinc-950">
        <h2 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Add ad spend
        </h2>
        <form
          action={addAdSpendManual}
          className="flex flex-wrap items-end gap-3"
        >
          <input type="hidden" name="storeId" value={storeId} />
          <Field label="Date" name="date" type="date" required />
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Channel</span>
            <select
              name="channel"
              className="rounded-md border border-zinc-300 bg-transparent px-3 py-1.5 text-sm dark:border-zinc-700"
            >
              {CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <Field label="Campaign" name="campaign" type="text" />
          <Field label="Spend ($)" name="spend" type="number" step="0.01" required />
          <Field label="Clicks" name="clicks" type="number" />
          <Field label="Impr." name="impressions" type="number" />
          <Field label="Conv." name="conversions" type="number" />
          <button
            type="submit"
            className="rounded-md border border-zinc-300 px-4 py-1.5 text-sm font-medium text-zinc-700 hover:bg-black/[.04] dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-white/[.06]"
          >
            Save
          </button>
        </form>

        <div className="mt-5 border-t border-zinc-100 pt-4 dark:border-zinc-900">
          <h3 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Import CSV
          </h3>
          <AdsCsvImport storeId={storeId} />
        </div>
      </section>

      {/* Recent spend */}
      {spend.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 p-12 text-center text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          No ad spend recorded yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                <th className="py-2 pr-4 font-medium">Date</th>
                <th className="py-2 pr-4 font-medium">Channel</th>
                <th className="py-2 pr-4 font-medium">Campaign</th>
                <th className="py-2 pr-4 font-medium text-right">Spend</th>
                <th className="py-2 pr-4 font-medium text-right">Clicks</th>
                <th className="py-2 pr-4 font-medium text-right">Impr.</th>
                <th className="py-2 font-medium text-right">Conv.</th>
              </tr>
            </thead>
            <tbody>
              {spend.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-zinc-100 dark:border-zinc-900"
                >
                  <td className="py-2.5 pr-4 text-zinc-600 dark:text-zinc-300">
                    {s.date.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  <td className="py-2.5 pr-4 text-zinc-600 dark:text-zinc-300">
                    {s.channel}
                  </td>
                  <td className="py-2.5 pr-4 text-zinc-500">
                    {s.campaignName}
                  </td>
                  <td className="py-2.5 pr-4 text-right font-medium text-black dark:text-zinc-50">
                    {formatCents(s.spendCents, currency)}
                  </td>
                  <td className="py-2.5 pr-4 text-right text-zinc-600 dark:text-zinc-300">
                    {s.clicks}
                  </td>
                  <td className="py-2.5 pr-4 text-right text-zinc-600 dark:text-zinc-300">
                    {s.impressions}
                  </td>
                  <td className="py-2.5 text-right text-zinc-600 dark:text-zinc-300">
                    {s.conversions}
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

function Field({
  label,
  name,
  type,
  step,
  required,
}: {
  label: string;
  name: string;
  type: string;
  step?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-zinc-500">{label}</span>
      <input
        name={name}
        type={type}
        step={step}
        required={required}
        className="w-28 rounded-md border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700"
      />
    </label>
  );
}
