import Link from "next/link";

import { prisma } from "@/lib/db";
import { RunReviewButton } from "./run-button";

export const dynamic = "force-dynamic";

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function ReviewsPage() {
  const reviews = await prisma.portfolioReview.findMany({
    orderBy: { createdAt: "desc" },
    take: 12,
  });
  const [latest, ...older] = reviews;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <Link
            href="/"
            className="text-sm text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            ← Dashboard
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Weekly review
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Claude reviews each store&apos;s week and flags what to scale, kill,
            or watch. Runs automatically every Sunday; you can also run it now.
          </p>
        </div>
      </div>

      <RunReviewButton />

      {!latest ? (
        <p className="mt-8 rounded-xl border border-dashed border-zinc-300 p-12 text-center text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          No reviews yet. Generate one once you have a few days of sales data.
        </p>
      ) : (
        <>
          <article className="mt-8 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
            <div className="mb-3 flex items-center justify-between text-xs text-zinc-400">
              <span>
                Week of {fmtDate(latest.periodStart)} – {fmtDate(latest.periodEnd)}
              </span>
              <span>
                {latest.emailedAt ? "emailed" : "not emailed"} ·{" "}
                {fmtDate(latest.createdAt)}
              </span>
            </div>
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
              {latest.content}
            </div>
          </article>

          {older.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Earlier reviews
              </h2>
              <ul className="space-y-2">
                {older.map((r) => (
                  <li
                    key={r.id}
                    className="rounded-xl border border-black/[.08] bg-white p-4 dark:border-white/[.145] dark:bg-zinc-950"
                  >
                    <details>
                      <summary className="cursor-pointer select-none text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        Week of {fmtDate(r.periodStart)} – {fmtDate(r.periodEnd)}
                      </summary>
                      <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                        {r.content}
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
