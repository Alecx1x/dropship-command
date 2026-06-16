"use client";

import { useActionState } from "react";

import { importAdSpendCsv, type CsvImportState } from "@/app/stores/[storeId]/ads/actions";

export function AdsCsvImport({ storeId }: { storeId: string }) {
  const [state, formAction, isPending] = useActionState<
    CsvImportState | undefined,
    FormData
  >(importAdSpendCsv, undefined);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="storeId" value={storeId} />
      <div className="flex items-center gap-2">
        <input
          type="file"
          name="file"
          accept=".csv,text/csv"
          className="text-sm text-zinc-600 file:mr-3 file:rounded-md file:border file:border-zinc-300 file:bg-transparent file:px-3 file:py-1.5 file:text-sm file:font-medium dark:text-zinc-300 dark:file:border-zinc-700"
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {isPending ? "Importing…" : "Import CSV"}
        </button>
      </div>
      <p className="text-xs text-zinc-400">
        Columns: date, channel, campaign, spend, clicks, impressions,
        conversions. Rows are aggregated per day &amp; channel.
      </p>
      {state?.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
      {state?.imported != null && (
        <p className="text-sm text-green-600 dark:text-green-400">
          Imported {state.imported} day/channel row(s)
          {state.skipped ? `, skipped ${state.skipped}` : ""}.
        </p>
      )}
    </form>
  );
}
