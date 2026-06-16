import Link from "next/link";
import { notFound } from "next/navigation";

import { StoreTabs } from "@/components/store-tabs";
import { prisma } from "@/lib/db";

export default async function StoreLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) notFound();

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <Link
        href="/stores"
        className="text-sm text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
      >
        ← Stores
      </Link>
      <div className="mt-1 flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
          {store.name}
        </h1>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          {store.status.toLowerCase()}
        </span>
      </div>
      <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
        {store.shopDomain} · {store.currency}
      </p>

      <StoreTabs storeId={storeId} />

      <div className="mt-6">{children}</div>
    </div>
  );
}
