"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { aggregateAdRows, normalizeChannel, parseAdSpendCsv } from "@/lib/ads/csv";
import { importAdSpend } from "@/lib/ads/import";

export interface CsvImportState {
  imported?: number;
  skipped?: number;
  error?: string;
}

export async function importAdSpendCsv(
  _prev: CsvImportState | undefined,
  formData: FormData,
): Promise<CsvImportState> {
  const storeId = String(formData.get("storeId") ?? "");
  const file = formData.get("file");
  if (!storeId) return { error: "Missing store." };
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a CSV file to import." };
  }

  const { rows, errors } = parseAdSpendCsv(await file.text());
  if (rows.length === 0) {
    return { error: errors[0] ?? "No valid rows found.", skipped: errors.length };
  }
  const imported = await importAdSpend(storeId, aggregateAdRows(rows));
  revalidatePath(`/stores/${storeId}/ads`);
  return { imported, skipped: errors.length };
}

const manualSchema = z.object({
  storeId: z.string().min(1),
  date: z.string().min(1),
  channel: z.string().min(1),
  campaign: z.string().optional().default(""),
  spend: z.coerce.number().min(0),
  clicks: z.coerce.number().int().min(0).optional().default(0),
  impressions: z.coerce.number().int().min(0).optional().default(0),
  conversions: z.coerce.number().int().min(0).optional().default(0),
});

export async function addAdSpendManual(formData: FormData): Promise<void> {
  const parsed = manualSchema.safeParse({
    storeId: formData.get("storeId"),
    date: formData.get("date"),
    channel: formData.get("channel"),
    campaign: formData.get("campaign"),
    spend: formData.get("spend"),
    clicks: formData.get("clicks"),
    impressions: formData.get("impressions"),
    conversions: formData.get("conversions"),
  });
  if (!parsed.success) return;

  const date = new Date(parsed.data.date);
  if (Number.isNaN(date.getTime())) return;

  await importAdSpend(parsed.data.storeId, [
    {
      date,
      channel: normalizeChannel(parsed.data.channel),
      campaignName: parsed.data.campaign,
      spendCents: Math.round(parsed.data.spend * 100),
      clicks: parsed.data.clicks,
      impressions: parsed.data.impressions,
      conversions: parsed.data.conversions,
    },
  ]);

  revalidatePath(`/stores/${parsed.data.storeId}/ads`);
}
