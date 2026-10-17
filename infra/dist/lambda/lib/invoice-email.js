"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LINK_TTL_DAYS = exports.MAX_EMAIL_MESSAGE_LENGTH = void 0;
exports.isValidRecipient = isValidRecipient;
exports.escapeHtml = escapeHtml;
exports.invoicePdfKey = invoicePdfKey;
exports.invoicePdfFilename = invoicePdfFilename;
exports.buildInvoiceEmail = buildInvoiceEmail;
exports.MAX_EMAIL_MESSAGE_LENGTH = 2000;
exports.LINK_TTL_DAYS = 30;
const EMAIL_PATTERN = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;
function isValidRecipient(value) {
    return typeof value === "string" && value.length <= 254 && EMAIL_PATTERN.test(value);
}
function escapeHtml(value) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
/** Object key for one sent snapshot; always under the tenant's own prefix. */
function invoicePdfKey(accountId, invoiceId, sentAt) {
    return `accounts/${accountId}/invoices/${invoiceId}/${sentAt.getTime()}.pdf`;
}
/** ASCII-only so Content-Disposition works in every mail client and browser. */
function invoicePdfFilename(invoiceLabel) {
    const safe = invoiceLabel.normalize("NFKD").replace(/[^A-Za-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
    return `Factura-${safe || "documento"}.pdf`;
}
function spanishDate(date) {
    return new Intl.DateTimeFormat("es", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}
function plural(count, word) {
    return `${count} ${word}${count === 1 ? "" : "s"}`;
}
function reminderDueText(input) {
    if (!input.dueDate)
        return "";
    const days = input.daysOverdue ?? 0;
    if (days > 0)
        return ` venció el ${input.dueDate} (hace ${plural(days, "día")})`;
    if (days === 0)
        return ` vence hoy, ${input.dueDate}`;
    return ` vence el ${input.dueDate} (en ${plural(-days, "día")})`;
}
function buildInvoiceEmail(input) {
    const reminder = input.kind === "REMINDER";
    const subject = (reminder
        ? `Recordatorio de pago: factura ${input.invoiceLabel} de ${input.issuerName}`
        : `Factura ${input.invoiceLabel} de ${input.issuerName}`).replace(/[\r\n]+/g, " ");
    const message = (input.message ?? "").trim().slice(0, exports.MAX_EMAIL_MESSAGE_LENGTH);
    const expires = spanishDate(input.linkExpiresAt);
    const due = input.dueDate ? ` con vencimiento el ${input.dueDate}` : "";
    const balance = input.balanceDue ?? input.grandTotal;
    const intro = reminder
        ? `Te recordamos que la factura ${input.invoiceLabel} de ${input.issuerName}${reminderDueText(input)}. Saldo pendiente: ${balance}.`
        : `${input.issuerName} te envía la factura ${input.invoiceLabel} por ${input.grandTotal}${due}.`;
    const introHtml = reminder
        ? `Te recordamos que la factura <strong>${escapeHtml(input.invoiceLabel)}</strong> de ${escapeHtml(input.issuerName)}${escapeHtml(reminderDueText(input))}. Saldo pendiente: <strong>${escapeHtml(balance)}</strong>.`
        : `${escapeHtml(input.issuerName)} te envía la factura <strong>${escapeHtml(input.invoiceLabel)}</strong> por <strong>${escapeHtml(input.grandTotal)}</strong>${escapeHtml(due)}.`;
    const closing = reminder ? "Si ya realizaste el pago, puedes ignorar este mensaje." : null;
    const text = [
        `Hola ${input.billToName},`,
        "",
        intro,
        ...(message ? ["", message] : []),
        "",
        `Descárgala aquí: ${input.link}`,
        `El enlace es válido hasta el ${expires}.`,
        ...(closing ? ["", closing] : []),
    ].join("\n");
    const html = `<!doctype html>
<html lang="es"><body style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;line-height:1.5">
<p>Hola ${escapeHtml(input.billToName)},</p>
<p>${introHtml}</p>
${message ? `<p style="white-space:pre-line">${escapeHtml(message)}</p>` : ""}
<p><a href="${escapeHtml(input.link)}" style="display:inline-block;padding:10px 18px;background:#0a1226;color:#ffffff;text-decoration:none;border-radius:8px">Descargar factura (PDF)</a></p>
<p style="color:#64748b;font-size:12px">El enlace es válido hasta el ${escapeHtml(expires)}.</p>
${closing ? `<p style="color:#64748b;font-size:12px">${escapeHtml(closing)}</p>` : ""}
</body></html>`;
    return { subject, text, html };
}
