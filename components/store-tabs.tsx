"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Orders / Products tab nav for the store detail pages. */
export function StoreTabs({ storeId }: { storeId: string }) {
  const pathname = usePathname();
  const base = `/stores/${storeId}`;
  const tabs = [
    { href: base, label: "Orders" },
    { href: `${base}/products`, label: "Products" },
    { href: `${base}/ads`, label: "Ads" },
    { href: `${base}/launch`, label: "Launch" },
  ];

  return (
    <nav className="mt-5 flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
      {tabs.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              active
                ? "border-zinc-900 text-black dark:border-zinc-100 dark:text-white"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
