"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSendInvoiceEmailHandler = createSendInvoiceEmailHandler;
exports.handler = handler;
const sql_builders_1 = require("../graphql/resolvers/src/lib/sql-builders");
const aws_deps_1 = require("./lib/aws-deps");
const invoice_email_1 = require("./lib/invoice-email");
const invoice_delivery_1 = require("./lib/invoice-delivery");
function createSendInvoiceEmailHandler(deps) {
    return async function handler(event) {
        if (!deps.sender) {
            throw new Error("El envío de facturas por email no está configurado");
        }
        if (!event.accountId || !event.invoiceId) {
            throw new Error("Solicitud de envío inválida");
        }
        const to = (0, invoice_delivery_1.str)(event.to).trim();
        if (!(0, invoice_email_1.isValidRecipient)(to)) {
            throw new Error("Indica un único email de destino válido");
        }
        const message = (0, invoice_delivery_1.str)(event.message).trim();
        if (message.length > invoice_email_1.MAX_EMAIL_MESSAGE_LENGTH) {
            throw new Error(`El mensaje no puede superar ${invoice_email_1.MAX_EMAIL_MESSAGE_LENGTH} caracteres`);
        }
        const kind = event.kind === "REMINDER" ? "REMINDER" : "INVOICE";
        const [row] = await deps.runSql((0, sql_builders_1.invoiceDocument)(event.accountId, { invoiceId: event.invoiceId }));
        if (!row) {
            throw new Error("Factura no encontrada");
        }
        if (kind === "REMINDER") {
            if ((0, invoice_delivery_1.str)(row.status) !== "SENT")
                throw new Error("Solo se envían recordatorios de facturas enviadas y no pagadas");
            if ((0, invoice_delivery_1.num)(row.balanceDue) <= 0)
                throw new Error("La factura no tiene saldo pendiente");
            const [logged] = await deps.runSql((0, sql_builders_1.logManualReminder)(event.accountId, { invoiceId: event.invoiceId, recipient: to }));
            const reminderId = (0, invoice_delivery_1.str)(logged?.reminderId);
            try {
                const { linkExpiresAt } = await (0, invoice_delivery_1.deliverInvoice)(deps, { accountId: event.accountId, invoiceId: event.invoiceId, row, to, message, kind });
                await deps.runSql((0, sql_builders_1.completeReminder)(event.accountId, { reminderId, sent: true })).catch(() => undefined);
                return { invoiceId: event.invoiceId, sentTo: to, linkExpiresAt: linkExpiresAt.toISOString(), statusUpdated: false, warning: null };
            }
            catch (error) {
                const reason = error instanceof Error ? error.message : String(error);
                await deps.runSql((0, sql_builders_1.completeReminder)(event.accountId, { reminderId, sent: false, error: reason })).catch(() => undefined);
                throw error;
            }
        }
        const { linkExpiresAt } = await (0, invoice_delivery_1.deliverInvoice)(deps, { accountId: event.accountId, invoiceId: event.invoiceId, row, to, message, kind });
        // The email is already out: a failed status update must not fail the
        // mutation, or the audit entry for the send would never be written.
        let statusUpdated = false;
        let warning = null;
        if ((0, invoice_delivery_1.str)(row.status) === "DRAFT") {
            try {
                statusUpdated = (await deps.runSql((0, sql_builders_1.markInvoiceSent)(event.accountId, { invoiceId: event.invoiceId }))).length > 0;
            }
            catch {
                warning = "La factura se envió, pero no se pudo marcar como enviada";
            }
        }
        return { invoiceId: event.invoiceId, sentTo: to, linkExpiresAt: linkExpiresAt.toISOString(), statusUpdated, warning };
    };
}
let productionHandler;
async function handler(event) {
    productionHandler ??= createSendInvoiceEmailHandler((0, aws_deps_1.sendInvoiceEmailDeps)());
    return productionHandler(event);
}
