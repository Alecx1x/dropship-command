"use client";

import { useActionState, useEffect, useRef } from "react";

import { addResearchItem } from "@/app/research/actions";

/**
 * Research intake form (SPEC 4.1). Fields can be prefilled from query params so
 * a bookmarklet can quick-add the page you're looking at — see the snippet in
 * the page's "Quick add" details.
 */
export function ResearchForm({
  defaultTitle = "",
  defaultUrl = "",
  defaultNiche = "",
}: {
  defaultTitle?: string;
  defaultUrl?: string;
  defaultNiche?: string;
}) {
  const [state, formAction, isPending] = useActionState(
    addResearchItem,
    undefined,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state && "ok" in state) formRef.current?.reset();
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="rounded-xl border border-black/[.08] bg-white p-5 dark:border-white/[.145] dark:bg-zinc-950"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Product title"
          name="title"
          required
          defaultValue={defaultTitle}
          placeholder="Posture corrector"
          className="sm:col-span-2"
        />
        <Field
          label="Source URL"
          name="sourceUrl"
          type="url"
          defaultValue={defaultUrl}
          placeholder="https://… (ad library, AliExpress, TikTok)"
          className="sm:col-span-2"
        />
        <Field
          label="Niche"
          name="niche"
          defaultValue={defaultNiche}
          placeholder="back & posture"
        />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Landed cost ($)" name="costDollars" type="number" placeholder="8.00" />
          <Field label="Target price ($)" name="priceDollars" type="number" placeholder="29.95" />
        </div>
      </div>

      {state && "error" in state && (
        <p
          role="alert"
          className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300"
        >
          {state.error}
        </p>
      )}
      {state && "ok" in state && (
        <p className="mt-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950/40 dark:text-green-300">
          Added to the pipeline.
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="mt-5 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {isPending ? "Adding…" : "Add candidate"}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  defaultValue,
  required,
  className,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <label className={`block space-y-1.5 ${className ?? ""}`}>
      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        step={type === "number" ? "0.01" : undefined}
        min={type === "number" ? "0" : undefined}
        autoComplete="off"
        className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm text-black outline-none focus:border-zinc-900 dark:border-zinc-700 dark:text-zinc-50 dark:focus:border-zinc-300"
      />
    </label>
  );
}
