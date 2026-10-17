"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MIN_DAYS_BETWEEN_REMINDERS = exports.REMINDER_WINDOW_DAYS = void 0;
exports.createPaymentRemindersHandler = createPaymentRemindersHandler;
exports.handler = handler;
const sql_builders_1 = require("../graphql/resolvers/src/lib/sql-builders");
const aws_deps_1 = require("./lib/aws-deps");
const invoice_email_1 = require("./lib/invoice-email");
const invoice_delivery_1 = require("./lib/invoice-delivery");
exports.REMINDER_WINDOW_DAYS = 3;
exports.MIN_DAYS_BETWEEN_REMINDERS = 2;
const BATCH_LIMIT = 200;
/** Leave room to record the last attempt before Lambda times out. */
const TIME_RESERVE_MS = 30_000;
const DAY_MS = 24 * 60 * 60 * 1000;
function stillDue(row, recipient) {
    return (0, invoice_delivery_1.str)(row.status) === "SENT"
        && (0, invoice_delivery_1.num)(row.balanceDue) > 0
        && row.remindersEnabled === true
        && (0, invoice_delivery_1.str)(row.clientEmail).trim().toLowerCase() === recipient.toLowerCase();
}
function createPaymentRemindersHandler(deps) {
    return async function handler() {
        const summary = {
            notConfigured: false, selected: 0, sent: 0, failed: 0, skippedNoEmail: 0, skippedAlreadyClaimed: 0,
            skippedNoLongerDue: 0, stoppedEarly: false,
        };
        // Unconfigured stages run daily too: exit quietly instead of failing every day.
        if (!deps.sender) {
            deps.log({ event: "payment_reminders_skipped", reason: "sender_not_configured" });
            return { ...summary, notConfigured: true };
        }
        const now = deps.now();
        const rows = await deps.runSql((0, sql_builders_1.dueReminders)({
            today: now.toISOString().slice(0, 10),
            windowDays: exports.REMINDER_WINDOW_DAYS,
            minGapSince: new Date(now.getTime() - exports.MIN_DAYS_BETWEEN_REMINDERS * DAY_MS).toISOString(),
            limit: BATCH_LIMIT,
        }));
        summary.selected = rows.length;
        for (const due of rows) {
            if (deps.remainingTimeMs() < TIME_RESERVE_MS) {
                summary.stoppedEarly = true;
                break;
            }
            // Every step below uses the selected row's own account.
            const accountId = (0, invoice_delivery_1.str)(due.accountId);
            const invoiceId = (0, invoice_delivery_1.str)(due.invoiceId);
            const recipient = (0, invoice_delivery_1.str)(due.recipient).trim();
            if (!(0, invoice_email_1.isValidRecipient)(recipient)) {
                summary.skippedNoEmail += 1;
                continue;
            }
            // The selection may be minutes old by now: re-read the invoice and only
            // remind it if it is still owed, still opted in and still belongs to the
            // client whose address was selected, so no PDF goes to a former client.
            const [row] = await deps.runSql((0, sql_builders_1.invoiceDocument)(accountId, { invoiceId }));
            if (!row || !stillDue(row, recipient)) {
                summary.skippedNoLongerDue += 1;
                continue;
            }
            const [claim] = await deps.runSql((0, sql_builders_1.claimScheduledReminder)(accountId, {
                invoiceId, offsetDays: (0, invoice_delivery_1.num)(due.offsetDays), scheduledFor: (0, invoice_delivery_1.str)(due.scheduledFor), recipient,
            }));
            if (!claim) {
                summary.skippedAlreadyClaimed += 1;
                continue;
            }
            const reminderId = (0, invoice_delivery_1.str)(claim.reminderId);
            try {
                await (0, invoice_delivery_1.deliverInvoice)(deps, { accountId, invoiceId, row, to: recipient, kind: "REMINDER" });
                summary.sent += 1;
                await deps.runSql((0, sql_builders_1.completeReminder)(accountId, { reminderId, sent: true })).catch(() => undefined);
            }
            catch (error) {
                summary.failed += 1;
                const reason = error instanceof Error ? error.message : String(error);
                deps.log({ event: "payment_reminder_failed", accountId, invoiceId, reminderId, reason });
                await deps.runSql((0, sql_builders_1.completeReminder)(accountId, { reminderId, sent: false, error: reason })).catch(() => undefined);
            }
        }
        deps.log({ event: "payment_reminders_done", ...summary });
        return summary;
    };
}
async function handler(_event, context) {
    return createPaymentRemindersHandler({
        ...(0, aws_deps_1.sendInvoiceEmailDeps)(),
        remainingTimeMs: () => context.getRemainingTimeInMillis(),
        log: (entry) => console.log(JSON.stringify(entry)),
    })();
}
