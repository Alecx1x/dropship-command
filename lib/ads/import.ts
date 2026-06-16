import { prisma } from "../db";
import type { ParsedAdRow } from "./csv";

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * Upsert ad-spend rows into AdSpend, keyed on (storeId, date, channel) (3.2).
 * Re-importing replaces a day/channel's values (idempotent). Rows should be
 * pre-aggregated with aggregateAdRows. Returns the count written.
 */
export async function importAdSpend(
  storeId: string,
  rows: ParsedAdRow[],
): Promise<number> {
  let written = 0;
  for (const r of rows) {
    const date = startOfDay(r.date);
    await prisma.adSpend.upsert({
      where: { storeId_date_channel: { storeId, date, channel: r.channel } },
      create: {
        storeId,
        date,
        channel: r.channel,
        campaignName: r.campaignName,
        spendCents: r.spendCents,
        clicks: r.clicks,
        impressions: r.impressions,
        conversions: r.conversions,
      },
      update: {
        campaignName: r.campaignName,
        spendCents: r.spendCents,
        clicks: r.clicks,
        impressions: r.impressions,
        conversions: r.conversions,
      },
    });
    written += 1;
  }
  return written;
}
