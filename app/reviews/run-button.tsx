"use client";

import { useActionState } from "react";

import { runWeeklyReviewNow } from "./actions";

export function RunReviewButton() {
  const [state, formAction, isPending] = useActionState(
    runWeeklyReviewNow,
    undefined,
  );

  return (
    <form action={formAction} className="flex items-center gap-3">
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {isPending ? "Generating…" : "Generate this week's review"}
      </button>
      {state && "error" in state && (
        <span className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </span>
      )}
      {state && "ok" in state && (
        <span className="text-sm text-green-600 dark:text-green-400">
          Done{state.emailed ? " · emailed" : " · saved (email not configured)"}
        </span>
      )}
    </form>
  );
}
