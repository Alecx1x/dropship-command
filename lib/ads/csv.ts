/**
 * Ad-spend CSV parsing (SPEC 3.2) — PURE, no DB. Maps a flexible CSV (header +
 * rows) to typed AdSpend rows and aggregates them to one row per (date, channel)
 * to match the AdSpend unique constraint (storeId, date, channel).
 */

export type AdChannel = "GOOGLE" | "META" | "TIKTOK" | "OTHER";

export interface ParsedAdRow {
  date: Date;
  channel: AdChannel;
  campaignName: string;
  spendCents: number;
  clicks: number;
  impressions: number;
  conversions: number;
}

export interface AdParseResult {
  rows: ParsedAdRow[];
  errors: string[];
}

export function normalizeChannel(input: string): AdChannel {
  const v = input.trim().toLowerCase();
  if (/google|adwords/.test(v)) return "GOOGLE";
  if (/meta|facebook|fb|instagram|\big\b/.test(v)) return "META";
  if (/tik\s*tok/.test(v)) return "TIKTOK";
  return "OTHER";
}

function dollarsToCents(s: string): number {
  const n = Number(String(s).replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function intOrZero(s: string): number {
  const n = parseInt(String(s).replace(/[,\s]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

/** Split one CSV line, honoring double-quoted fields (which may contain commas). */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function findColumn(header: string[], names: string[]): number {
  return header.findIndex((h) => names.includes(h));
}

export function parseAdSpendCsv(text: string): AdParseResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { rows: [], errors: ["File is empty."] };

  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const idx = {
    date: findColumn(header, ["date", "day"]),
    channel: findColumn(header, ["channel", "platform", "source"]),
    campaign: findColumn(header, ["campaign", "campaign_name", "campaign name"]),
    spend: findColumn(header, ["spend", "cost", "amount", "spend_usd"]),
    clicks: findColumn(header, ["clicks"]),
    impressions: findColumn(header, ["impressions", "impr"]),
    conversions: findColumn(header, ["conversions", "conv", "purchases"]),
  };

  if (idx.date < 0 || idx.channel < 0 || idx.spend < 0) {
    return {
      rows: [],
      errors: ["CSV needs at least date, channel, and spend columns."],
    };
  }

  const rows: ParsedAdRow[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const dateRaw = cols[idx.date] ?? "";
    const date = new Date(dateRaw);
    if (!dateRaw || Number.isNaN(date.getTime())) {
      errors.push(`Row ${i + 1}: invalid date "${dateRaw}".`);
      continue;
    }
    rows.push({
      date,
      channel: normalizeChannel(cols[idx.channel] ?? ""),
      campaignName: idx.campaign >= 0 ? (cols[idx.campaign] ?? "") : "",
      spendCents: dollarsToCents(cols[idx.spend] ?? "0"),
      clicks: idx.clicks >= 0 ? intOrZero(cols[idx.clicks] ?? "0") : 0,
      impressions: idx.impressions >= 0 ? intOrZero(cols[idx.impressions] ?? "0") : 0,
      conversions: idx.conversions >= 0 ? intOrZero(cols[idx.conversions] ?? "0") : 0,
    });
  }

  return { rows, errors };
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Aggregate rows to one per (date, channel) — sums metrics, merges campaigns. */
export function aggregateAdRows(rows: ParsedAdRow[]): ParsedAdRow[] {
  const groups = new Map<string, ParsedAdRow>();
  const campaigns = new Map<string, Set<string>>();

  for (const r of rows) {
    const key = `${dayKey(r.date)}|${r.channel}`;
    const names = campaigns.get(key) ?? new Set<string>();
    if (r.campaignName) names.add(r.campaignName);
    campaigns.set(key, names);

    const existing = groups.get(key);
    if (existing) {
      existing.spendCents += r.spendCents;
      existing.clicks += r.clicks;
      existing.impressions += r.impressions;
      existing.conversions += r.conversions;
    } else {
      groups.set(key, { ...r });
    }
  }

  for (const [key, row] of groups) {
    const names = [...(campaigns.get(key) ?? new Set())];
    row.campaignName =
      names.length <= 1
        ? (names[0] ?? "")
        : `${names[0]} +${names.length - 1} more`;
  }

  return [...groups.values()];
}
