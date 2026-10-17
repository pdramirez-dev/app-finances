"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toPdfData = toPdfData;
exports.createSendInvoiceEmailHandler = createSendInvoiceEmailHandler;
exports.handler = handler;
const sql_builders_1 = require("../graphql/resolvers/src/lib/sql-builders");
const aws_deps_1 = require("./lib/aws-deps");
const invoice_email_1 = require("./lib/invoice-email");
const invoice_link_token_1 = require("./lib/invoice-link-token");
const invoice_pdf_1 = require("./lib/invoice-pdf");
const DAY_MS = 24 * 60 * 60 * 1000;
function str(value) {
    return value === null || value === undefined ? "" : String(value);
}
function num(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}
function money(amount, currency) {
    try {
        return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(amount);
    }
    catch {
        return `${currency} ${amount.toFixed(2)}`;
    }
}
function usDate(value) {
    const [year, month, day] = value.slice(0, 10).split("-");
    return year && month && day ? `${month}/${day}/${year}` : value;
}
function toPdfData(row) {
    const sections = JSON.parse(str(row.sectionsJson) || "[]");
    const bank = row.bankJson ? JSON.parse(str(row.bankJson)) : null;
    return {
        issuer: {
            name: str(row.issuerName),
            legalName: str(row.issuerLegalName) || null,
            taxId: str(row.issuerTaxId) || null,
            address: str(row.issuerAddress) || null,
            email: str(row.issuerEmail) || null,
            phone: str(row.issuerPhone) || null,
        },
        bank,
        invoice: {
            label: str(row.invoiceLabel),
            date: str(row.date),
            dueDate: str(row.dueDate) || null,
            weekNumber: num(row.weekNumber),
            billToName: str(row.billToName),
            billToAddress: str(row.billToAddress),
            project: str(row.project),
            currency: str(row.currency) || "USD",
            notes: str(row.notes) || null,
            grandTotal: num(row.grandTotal),
            sections: sections.map((section) => ({
                title: str(section.title),
                total: num(section.total),
                lineItems: (section.lineItems ?? []).map((item) => ({
                    description: str(item.description),
                    quantity: num(item.quantity),
                    amount: num(item.amount),
                })),
            })),
        },
    };
}
function createSendInvoiceEmailHandler(deps) {
    return async function handler(event) {
        if (!deps.sender) {
            throw new Error("El envío de facturas por email no está configurado");
        }
        if (!event.accountId || !event.invoiceId) {
            throw new Error("Solicitud de envío inválida");
        }
        const to = str(event.to).trim();
        if (!(0, invoice_email_1.isValidRecipient)(to)) {
            throw new Error("Indica un único email de destino válido");
        }
        const message = str(event.message).trim();
        if (message.length > invoice_email_1.MAX_EMAIL_MESSAGE_LENGTH) {
            throw new Error(`El mensaje no puede superar ${invoice_email_1.MAX_EMAIL_MESSAGE_LENGTH} caracteres`);
        }
        const [row] = await deps.runSql((0, sql_builders_1.invoiceDocument)(event.accountId, { invoiceId: event.invoiceId }));
        if (!row) {
            throw new Error("Factura no encontrada");
        }
        const data = toPdfData(row);
        const sentAt = deps.now();
        const key = (0, invoice_email_1.invoicePdfKey)(event.accountId, event.invoiceId, sentAt);
        const filename = (0, invoice_email_1.invoicePdfFilename)(data.invoice.label);
        await deps.putPdf(key, await (0, invoice_pdf_1.renderInvoicePdf)(data), filename);
        const linkExpiresAt = new Date(sentAt.getTime() + invoice_email_1.LINK_TTL_DAYS * DAY_MS);
        const token = (0, invoice_link_token_1.signInvoiceLinkToken)({
            key, accountId: event.accountId, invoiceId: event.invoiceId, filename, expiresAt: linkExpiresAt.getTime(),
        }, await deps.getLinkSecret());
        const link = `${deps.downloadBaseUrl.replace(/\/+$/, "")}/?t=${encodeURIComponent(token)}`;
        const email = (0, invoice_email_1.buildInvoiceEmail)({
            issuerName: data.issuer.legalName || data.issuer.name,
            invoiceLabel: data.invoice.label,
            billToName: data.invoice.billToName,
            grandTotal: money(data.invoice.grandTotal, data.invoice.currency),
            dueDate: data.invoice.dueDate ? usDate(data.invoice.dueDate) : null,
            link,
            linkExpiresAt,
            message,
        });
        await deps.sendEmail({
            from: deps.sender,
            to,
            replyTo: (0, invoice_email_1.isValidRecipient)(data.issuer.email) ? data.issuer.email : undefined,
            ...email,
        });
        // The email is already out: a failed status update must not fail the
        // mutation, or the audit entry for the send would never be written.
        let statusUpdated = false;
        let warning = null;
        if (str(row.status) === "DRAFT") {
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
