import Link from "next/link";

import { ResearchForm } from "@/components/research-form";
import { ScoreButton, StatusSelect } from "@/components/research-controls";
import { marginMultiple } from "@/lib/ai/score";
import { prisma } from "@/lib/db";
import { formatCents } from "@/lib/format";
import { deleteResearchItem } from "./actions";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ title?: string; url?: string; niche?: string }>;

export default async function ResearchPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const prefill = await searchParams;
  const items = await prisma.researchItem.findMany({
    orderBy: [{ score: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
  });

  const base = process.env.APP_URL ?? "https://your-app-url";
  const bookmarklet = `javascript:(()=>{window.open('${base}/research?title='+encodeURIComponent(document.title)+'&url='+encodeURIComponent(location.href),'_blank')})();`;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-6">
        <Link
          href="/"
          className="text-sm text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          ← Dashboard
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Product research
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Capture candidates, then score each one with Claude against the
          six-point filter (problem, wow, margin, shippability, competition,
          seasonality).
        </p>
      </div>

      <ResearchForm
        defaultTitle={prefill.title ?? ""}
        defaultUrl={prefill.url ?? ""}
        defaultNiche={prefill.niche ?? ""}
      />

      <details className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
        <summary className="cursor-pointer select-none">
          Quick add from any page (bookmarklet)
        </summary>
        <p className="mt-2">
          Create a new browser bookmark and paste this as its URL. Then click it
          on any product/ad page to open this form prefilled with the page title
          and link:
        </p>
        <code className="mt-2 block overflow-x-auto rounded-md bg-zinc-100 p-3 font-mono text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          {bookmarklet}
        </code>
      </details>

      <h2 className="mb-3 mt-8 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Pipeline ({items.length})
      </h2>

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 p-12 text-center text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          No candidates yet. Add one above to start the pipeline.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => {
            const mult = marginMultiple(
              item.supplierCostCents,
              item.estPriceCents,
            );
            return (
              <li
                key={item.id}
                className="rounded-xl border border-black/[.08] bg-white p-5 dark:border-white/[.145] dark:bg-zinc-950"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <ScoreBadge score={item.score} />
                      <span className="truncate font-medium text-black dark:text-zinc-50">
                        {item.sourceUrl ? (
                          <a
                            href={item.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:underline"
                          >
                            {item.title}
                          </a>
                        ) : (
                          item.title
                        )}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {item.niche && <span>{item.niche}</span>}
                      {item.supplierCostCents != null && (
                        <span>cost {formatCents(item.supplierCostCents)}</span>
                      )}
                      {item.estPriceCents != null && (
                        <span>price {formatCents(item.estPriceCents)}</span>
                      )}
                      {mult != null && (
                        <span
                          className={
                            mult >= 3
                              ? "text-green-600 dark:text-green-400"
                              : "text-amber-600 dark:text-amber-400"
                          }
                        >
                          {mult.toFixed(1)}x markup
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Link
                      href={`/research/${item.id}/listing`}
                      className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-black/[.04] dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-white/[.06]"
                    >
                      Listing
                    </Link>
                    <StatusSelect id={item.id} status={item.status} />
                    <ScoreButton id={item.id} scored={item.score != null} />
                  </div>
                </div>

                {item.scoreRationale && (
                  <details className="mt-3">
                    <summary className="cursor-pointer select-none text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200">
                      Why this score
                    </summary>
                    <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-zinc-700 dark:text-zinc-300">
                      {item.scoreRationale}
                    </pre>
                  </details>
                )}

                <form action={deleteResearchItem} className="mt-3">
                  <input type="hidden" name="id" value={item.id} />
                  <button
                    type="submit"
                    className="text-xs text-zinc-400 hover:text-red-600 dark:hover:text-red-400"
                  >
                    Remove
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) {
    return (
      <span className="inline-flex h-7 w-9 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-xs font-semibold text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500">
        —
      </span>
    );
  }
  const cls =
    score >= 70
      ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
      : score >= 40
        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
        : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300";
  return (
    <span
      className={`inline-flex h-7 w-9 shrink-0 items-center justify-center rounded-md text-xs font-semibold ${cls}`}
    >
      {score}
    </span>
  );
}
