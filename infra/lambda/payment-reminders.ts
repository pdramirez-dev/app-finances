import type { Context } from "aws-lambda";

import {
  claimScheduledReminder, completeReminder, dueReminders, invoiceDocument,
} from "../graphql/resolvers/src/lib/sql-builders";
import { sendInvoiceEmailDeps } from "./lib/aws-deps";
import { isValidRecipient } from "./lib/invoice-email";
import { deliverInvoice, type DeliveryDeps, num, str } from "./lib/invoice-delivery";

export const REMINDER_WINDOW_DAYS = 3;
export const MIN_DAYS_BETWEEN_REMINDERS = 2;
const BATCH_LIMIT = 200;
/** Leave room to record the last attempt before Lambda times out. */
const TIME_RESERVE_MS = 30_000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type PaymentRemindersDeps = DeliveryDeps & {
  remainingTimeMs(): number;
  log(entry: Record<string, unknown>): void;
};

export type PaymentRemindersSummary = {
  notConfigured: boolean;
  selected: number;
  sent: number;
  failed: number;
  skippedNoEmail: number;
  skippedAlreadyClaimed: number;
  stoppedEarly: boolean;
};

export function createPaymentRemindersHandler(deps: PaymentRemindersDeps) {
  return async function handler(): Promise<PaymentRemindersSummary> {
    const summary: PaymentRemindersSummary = {
      notConfigured: false, selected: 0, sent: 0, failed: 0, skippedNoEmail: 0, skippedAlreadyClaimed: 0, stoppedEarly: false,
    };
    // Unconfigured stages run daily too: exit quietly instead of failing every day.
    if (!deps.sender) {
      deps.log({ event: "payment_reminders_skipped", reason: "sender_not_configured" });
      return { ...summary, notConfigured: true };
    }

    const now = deps.now();
    const rows = await deps.runSql(dueReminders({
      today: now.toISOString().slice(0, 10),
      windowDays: REMINDER_WINDOW_DAYS,
      minGapSince: new Date(now.getTime() - MIN_DAYS_BETWEEN_REMINDERS * DAY_MS).toISOString(),
      limit: BATCH_LIMIT,
    }));
    summary.selected = rows.length;

    for (const due of rows) {
      if (deps.remainingTimeMs() < TIME_RESERVE_MS) {
        summary.stoppedEarly = true;
        break;
      }
      // Every step below uses the selected row's own account.
      const accountId = str(due.accountId);
      const invoiceId = str(due.invoiceId);
      const recipient = str(due.recipient).trim();
      if (!isValidRecipient(recipient)) {
        summary.skippedNoEmail += 1;
        continue;
      }

      const [claim] = await deps.runSql(claimScheduledReminder(accountId, {
        invoiceId, offsetDays: num(due.offsetDays), scheduledFor: str(due.scheduledFor), recipient,
      }));
      if (!claim) {
        summary.skippedAlreadyClaimed += 1;
        continue;
      }
      const reminderId = str(claim.reminderId);

      try {
        const [row] = await deps.runSql(invoiceDocument(accountId, { invoiceId }));
        if (!row) throw new Error("Invoice not found");
        await deliverInvoice(deps, { accountId, invoiceId, row, to: recipient, kind: "REMINDER" });
        summary.sent += 1;
        await deps.runSql(completeReminder(accountId, { reminderId, sent: true })).catch(() => undefined);
      } catch (error) {
        summary.failed += 1;
        const reason = error instanceof Error ? error.message : String(error);
        deps.log({ event: "payment_reminder_failed", accountId, invoiceId, reminderId, reason });
        await deps.runSql(completeReminder(accountId, { reminderId, sent: false, error: reason })).catch(() => undefined);
      }
    }

    deps.log({ event: "payment_reminders_done", ...summary });
    return summary;
  };
}

export async function handler(_event: unknown, context: Context) {
  return createPaymentRemindersHandler({
    ...sendInvoiceEmailDeps(),
    remainingTimeMs: () => context.getRemainingTimeInMillis(),
    log: (entry) => console.log(JSON.stringify(entry)),
  })();
}
