"use client";

import Link from "next/link";
import { useActionState } from "react";

import { registerStore } from "../actions";

export default function NewStorePage() {
  const [state, formAction, isPending] = useActionState(registerStore, undefined);

  return (
    <div className="mx-auto max-w-lg px-6 py-12">
      <Link
        href="/stores"
        className="text-sm text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
      >
        ← Stores
      </Link>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
        Connect a Shopify store
      </h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        We verify the token against Shopify before saving, then store it
        encrypted. Create a token from a custom app in your Shopify admin
        (Settings → Apps → Develop apps).
      </p>

      <form action={formAction} className="mt-8 space-y-5">
        <Field
          label="Store name"
          name="name"
          placeholder="My Store"
          autoComplete="off"
        />
        <Field
          label="Shopify domain"
          name="shopDomain"
          placeholder="my-store.myshopify.com"
          autoComplete="off"
        />
        <Field
          label="Admin API access token"
          name="accessToken"
          type="password"
          placeholder="shpat_..."
          autoComplete="off"
        />

        {state?.error && (
          <p
            role="alert"
            className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300"
          >
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {isPending ? "Verifying with Shopify…" : "Verify & connect"}
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  autoComplete,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </span>
      <input
        name={name}
        type={type}
        required
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm text-black outline-none focus:border-zinc-900 dark:border-zinc-700 dark:text-zinc-50 dark:focus:border-zinc-300"
      />
    </label>
  );
}
