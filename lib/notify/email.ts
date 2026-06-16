/**
 * Email notifications via Resend (SPEC 2.5, reused by the weekly review in 4.4).
 * If RESEND_API_KEY / ALERT_EMAIL_TO aren't configured, sending no-ops with a
 * log, so features work end-to-end without email set up. Failures never throw —
 * a notification problem must not break the work that triggered it.
 */

const HIGH_SEVERITIES = new Set(["HIGH", "CRITICAL"]);

export function isHighSeverity(severity: string): boolean {
  return HIGH_SEVERITIES.has(severity);
}

/**
 * Send an email to the configured owner address. Returns true only if Resend
 * accepted it; false (with a log) when email isn't configured or the call fails.
 */
export async function sendEmail(
  subject: string,
  text: string,
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.ALERT_EMAIL_TO;
  if (!apiKey || !to) {
    console.log(`[notify] email disabled — ${subject}`);
    return false;
  }

  const from = process.env.ALERT_EMAIL_FROM ?? "onboarding@resend.dev";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, text }),
    });
    if (!res.ok) {
      console.error(`[notify] email failed: HTTP ${res.status}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[notify] email error:", (err as Error)?.message);
    return false;
  }
}

export interface NotifiableAlert {
  severity: string;
  kind: string;
  message: string;
}

export async function notifyHighSeverityAlert(
  alert: NotifiableAlert,
): Promise<void> {
  if (!isHighSeverity(alert.severity)) return;
  await sendEmail(`[${alert.severity}] ${alert.kind}`, alert.message);
}
