import { prisma } from "../db";
import { notifyHighSeverityAlert } from "../notify/email";

export type AlertSeverityInput = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface CreateAlertInput {
  storeId?: string | null;
  severity: AlertSeverityInput;
  kind: string;
  message: string;
}

/**
 * Create an alert and fire notifications for high-severity ones (SPEC 2.5).
 * The single funnel every alert source should use so notification policy lives
 * in one place.
 */
export async function createAlert(input: CreateAlertInput) {
  const alert = await prisma.alert.create({
    data: {
      storeId: input.storeId ?? null,
      severity: input.severity,
      kind: input.kind,
      message: input.message,
    },
  });

  await notifyHighSeverityAlert(alert);
  return alert;
}
