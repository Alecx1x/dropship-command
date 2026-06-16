import Link from "next/link";
import { notFound } from "next/navigation";

import { GenerateListingButton } from "@/components/research-controls";
import type { RsaAssetSet } from "@/lib/ai/listing";
import { prisma } from "@/lib/db";
import { formatCents } from "@/lib/format";
import { approveListing } from "../../actions";

export const dynamic = "force-dynamic";

export default async function ListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = await prisma.researchItem.findUnique({
    where: { id },
    include: { listingDraft: true },
  });
  if (!item) notFound();

  const draft = item.listingDraft;
  const rsaSets = (draft?.rsaSets as unknown as RsaAssetSet[] | null) ?? [];
  const approved = draft?.status === "APPROVED";

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link
        href="/research"
        className="text-sm text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
      >
        ← Research
      </Link>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
        Listing copy
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        {item.title}
        {item.estPriceCents != null && (
          <span className="text-zinc-400">
            {" "}
            · target {formatCents(item.estPriceCents)}
          </span>
        )}
      </p>

      <div className="mt-5 flex items-center gap-3">
        <GenerateListingButton id={item.id} exists={draft != null} />
        {draft &&
          (approved ? (
            <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">
              Approved
            </span>
          ) : (
            <form action={approveListing}>
              <input type="hidden" name="id" value={item.id} />
              <button
                type="submit"
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-black/[.04] dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-white/[.06]"
              >
                Approve
              </button>
            </form>
          ))}
      </div>

      {!draft ? (
        <p className="mt-8 rounded-xl border border-dashed border-zinc-300 p-12 text-center text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          No copy yet. Generate a draft, review it, then approve before
          publishing.
        </p>
      ) : (
        <div className="mt-8 space-y-8">
          <Section title="Product title">
            <p className="text-black dark:text-zinc-50">{draft.title}</p>
          </Section>

          <Section title="Description">
            <p className="whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
              {draft.description}
            </p>
          </Section>

          <Section title="Ad angles">
            <ul className="list-disc space-y-1 pl-5 text-zinc-700 dark:text-zinc-300">
              {draft.adAngles.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </Section>

          <Section title="Google responsive search ads">
            <div className="space-y-4">
              {rsaSets.map((set, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-black/[.08] bg-white p-4 dark:border-white/[.145] dark:bg-zinc-950"
                >
                  <div className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
                    Set {i + 1}
                  </div>
                  <div className="text-xs text-zinc-400">Headlines (≤30)</div>
                  <ul className="mb-3 space-y-0.5">
                    {set.headlines.map((h, j) => (
                      <li key={j} className="flex justify-between gap-3 text-sm">
                        <span className="text-zinc-700 dark:text-zinc-300">{h}</span>
                        <span className="text-zinc-400">{h.length}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="text-xs text-zinc-400">Descriptions (≤90)</div>
                  <ul className="space-y-0.5">
                    {set.descriptions.map((d, j) => (
                      <li key={j} className="flex justify-between gap-3 text-sm">
                        <span className="text-zinc-700 dark:text-zinc-300">{d}</span>
                        <span className="text-zinc-400">{d.length}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Section>

          <p className="text-xs text-zinc-400">
            Drafts are for review only — nothing is published to Shopify or Google
            from here. Approve to mark it ready.
          </p>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {title}
      </h2>
      {children}
    </section>
  );
}
