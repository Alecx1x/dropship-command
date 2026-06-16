import { createAlert } from "../alerts/create";
import { prisma } from "../db";
import { formatCents } from "../format";
import {
  GUARDRAIL_MARGIN_FLOOR_PCT,
  GUARDRAIL_REPRICE_MULTIPLIER,
} from "./config";
import { cogsCents, evaluateMargin } from "./margin";

/**
 * Margin guardrail sweep (SPEC 2.4). For every supplier-linked product in an
 * active store, if margin has fallen below the floor (e.g. after a supplier
 * cost increase entered via COGS), raise a HIGH MARGIN_BREACH alert with a
 * suggested reprice. Deduped: one open alert per product at a time.
 *
 * Stockout protection (supplier out-of-stock → alert + zero Shopify inventory)
 * needs the live supplier feed from the SupplierAdapter (task 2.6) and is wired
 * in there; this sweep covers the margin half, which is computable today.
 */
export async function runMarginGuardrails(): Promise<{
  evaluated: number;
  alertsCreated: number;
}> {
  const products = await prisma.product.findMany({
    where: { supplierId: { not: null }, store: { status: "ACTIVE" } },
    select: {
      id: true,
      title: true,
      storeId: true,
      priceCents: true,
      costCents: true,
      shipCostCents: true,
      store: { select: { currency: true } },
    },
  });

  let alertsCreated = 0;
  for (const p of products) {
    const cogs = cogsCents(p);
    const verdict = evaluateMargin(
      p.priceCents,
      cogs,
      GUARDRAIL_MARGIN_FLOOR_PCT,
      GUARDRAIL_REPRICE_MULTIPLIER,
    );
    if (!verdict.breached || verdict.marginPct === null) continue;

    // Dedupe: skip if there's already an open MARGIN_BREACH alert for this
    // product (its title prefixes the message).
    const existing = await prisma.alert.findFirst({
      where: {
        storeId: p.storeId,
        kind: "MARGIN_BREACH",
        readAt: null,
        message: { startsWith: `${p.title}:` },
      },
      select: { id: true },
    });
    if (existing) continue;

    const currency = p.store.currency;
    await createAlert({
      storeId: p.storeId,
      severity: "HIGH",
      kind: "MARGIN_BREACH",
      message:
        `${p.title}: margin ${verdict.marginPct.toFixed(0)}% is below the ` +
        `${GUARDRAIL_MARGIN_FLOOR_PCT}% floor. Suggested price ` +
        `${formatCents(verdict.suggestedPriceCents, currency)} ` +
        `(currently ${formatCents(p.priceCents, currency)}).`,
    });
    alertsCreated += 1;
  }

  return { evaluated: products.length, alertsCreated };
}
