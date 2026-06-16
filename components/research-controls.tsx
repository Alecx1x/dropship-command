"use client";

import { useActionState, useRef } from "react";

import {
  generateListing,
  scoreResearchItem,
  setResearchStatus,
  type ListingState,
  type ScoreState,
} from "@/app/research/actions";
import type { ResearchStatus } from "@/lib/generated/prisma/enums";

/** Score / re-score one item with Claude, with pending + error feedback. */
export function ScoreButton({ id, scored }: { id: string; scored: boolean }) {
  const [state, formAction, isPending] = useActionState<ScoreState, FormData>(
    scoreResearchItem,
    undefined,
  );

  return (
    <form action={formAction} className="inline-flex flex-col items-end gap-1">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-black/[.04] disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-white/[.06]"
      >
        {isPending ? "Scoring…" : scored ? "Re-score" : "Score with AI"}
      </button>
      {state && "error" in state && (
        <span className="max-w-[12rem] text-right text-xs text-red-600 dark:text-red-400">
          {state.error}
        </span>
      )}
    </form>
  );
}

/** Generate / regenerate listing copy with Claude, with pending + error feedback. */
export function GenerateListingButton({
  id,
  exists,
}: {
  id: string;
  exists: boolean;
}) {
  const [state, formAction, isPending] = useActionState<ListingState, FormData>(
    generateListing,
    undefined,
  );

  return (
    <form action={formAction} className="inline-flex flex-col items-start gap-1">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {isPending
          ? "Generating…"
          : exists
            ? "Regenerate with AI"
            : "Generate with AI"}
      </button>
      {state && "error" in state && (
        <span className="text-xs text-red-600 dark:text-red-400">
          {state.error}
        </span>
      )}
    </form>
  );
}

const STATUSES: ResearchStatus[] = ["IDEA", "TESTING", "LIVE", "KILLED"];

/** Status dropdown that submits on change (no extra button). */
export function StatusSelect({
  id,
  status,
}: {
  id: string;
  status: ResearchStatus;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={setResearchStatus}>
      <input type="hidden" name="id" value={id} />
      <select
        name="status"
        defaultValue={status}
        onChange={() => formRef.current?.requestSubmit()}
        className="rounded-md border border-zinc-300 bg-transparent px-2 py-1 text-xs text-zinc-700 outline-none dark:border-zinc-700 dark:text-zinc-300"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </form>
  );
}
