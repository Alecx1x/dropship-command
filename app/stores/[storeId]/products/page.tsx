import { prisma } from "@/lib/db";
import { updateProductCogs } from "../../actions";

export const dynamic = "force-dynamic";

function dollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

function marginPct(priceCents: number, cogsCents: number): number | null {
  if (priceCents <= 0) return null;
  return Math.round(((priceCents - cogsCents) / priceCents) * 100);
}

export default async function StoreProductsPage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;

  const products = await prisma.product.findMany({
    where: { storeId },
    orderBy: { title: "asc" },
  });

  return (
    <div>
      <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
        Enter COGS (unit cost + supplier shipping) for products without a
        supplier link. Margin updates on save.
      </p>

      {products.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 p-12 text-center text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          No products yet. Use “Import products” on the Stores page.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                <th className="py-2 pr-4 font-medium">Product</th>
                <th className="py-2 pr-4 font-medium">Price</th>
                <th className="py-2 pr-4 font-medium">Unit cost</th>
                <th className="py-2 pr-4 font-medium">Ship cost</th>
                <th className="py-2 pr-4 font-medium">Margin</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const margin = marginPct(p.priceCents, p.costCents + p.shipCostCents);
                return (
                  <tr
                    key={p.id}
                    className="border-b border-zinc-100 dark:border-zinc-900"
                  >
                    <td className="py-3 pr-4">
                      <div className="font-medium text-black dark:text-zinc-50">
                        {p.title}
                      </div>
                      <div className="text-xs text-zinc-400">
                        {p.niche ?? "—"} · {p.status.toLowerCase()}
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-zinc-600 dark:text-zinc-300">
                      ${dollars(p.priceCents)}
                    </td>
                    <form action={updateProductCogs} className="contents">
                      <input type="hidden" name="productId" value={p.id} />
                      <input type="hidden" name="storeId" value={storeId} />
                      <td className="py-3 pr-4">
                        <input
                          name="costDollars"
                          type="number"
                          step="0.01"
                          min="0"
                          defaultValue={dollars(p.costCents)}
                          className="w-24 rounded-md border border-zinc-300 bg-transparent px-2 py-1 text-sm dark:border-zinc-700"
                        />
                      </td>
                      <td className="py-3 pr-4">
                        <input
                          name="shipDollars"
                          type="number"
                          step="0.01"
                          min="0"
                          defaultValue={dollars(p.shipCostCents)}
                          className="w-24 rounded-md border border-zinc-300 bg-transparent px-2 py-1 text-sm dark:border-zinc-700"
                        />
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={
                            margin === null
                              ? "text-zinc-400"
                              : margin < 30
                                ? "text-red-600 dark:text-red-400"
                                : "text-green-600 dark:text-green-400"
                          }
                        >
                          {margin === null ? "—" : `${margin}%`}
                        </span>
                      </td>
                      <td className="py-3">
                        <button
                          type="submit"
                          className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-black/[.04] dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-white/[.06]"
                        >
                          Save
                        </button>
                      </td>
                    </form>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
