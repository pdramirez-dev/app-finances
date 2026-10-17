export const MAX_EMAIL_MESSAGE_LENGTH = 2000;
export const LINK_TTL_DAYS = 30;

const EMAIL_PATTERN = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;

export function isValidRecipient(value: unknown): value is string {
  return typeof value === "string" && value.length <= 254 && EMAIL_PATTERN.test(value);
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Object key for one sent snapshot; always under the tenant's own prefix. */
export function invoicePdfKey(accountId: string, invoiceId: string, sentAt: Date) {
  return `accounts/${accountId}/invoices/${invoiceId}/${sentAt.getTime()}.pdf`;
}

/** ASCII-only so Content-Disposition works in every mail client and browser. */
export function invoicePdfFilename(invoiceLabel: string) {
  const safe = invoiceLabel.normalize("NFKD").replace(/[^A-Za-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  return `Factura-${safe || "documento"}.pdf`;
}

export type InvoiceEmailInput = {
  issuerName: string;
  invoiceLabel: string;
  billToName: string;
  grandTotal: string;
  dueDate?: string | null;
  link: string;
  linkExpiresAt: Date;
  message?: string | null;
};

function spanishDate(date: Date) {
  return new Intl.DateTimeFormat("es", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

export function buildInvoiceEmail(input: InvoiceEmailInput) {
  const subject = `Factura ${input.invoiceLabel} de ${input.issuerName}`.replace(/[\r\n]+/g, " ");
  const message = (input.message ?? "").trim().slice(0, MAX_EMAIL_MESSAGE_LENGTH);
  const expires = spanishDate(input.linkExpiresAt);
  const due = input.dueDate ? ` con vencimiento el ${input.dueDate}` : "";

  const text = [
    `Hola ${input.billToName},`,
    "",
    `${input.issuerName} te envía la factura ${input.invoiceLabel} por ${input.grandTotal}${due}.`,
    ...(message ? ["", message] : []),
    "",
    `Descárgala aquí: ${input.link}`,
    `El enlace es válido hasta el ${expires}.`,
  ].join("\n");

  const html = `<!doctype html>
<html lang="es"><body style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;line-height:1.5">
<p>Hola ${escapeHtml(input.billToName)},</p>
<p>${escapeHtml(input.issuerName)} te envía la factura <strong>${escapeHtml(input.invoiceLabel)}</strong> por <strong>${escapeHtml(input.grandTotal)}</strong>${escapeHtml(due)}.</p>
${message ? `<p style="white-space:pre-line">${escapeHtml(message)}</p>` : ""}
<p><a href="${escapeHtml(input.link)}" style="display:inline-block;padding:10px 18px;background:#0a1226;color:#ffffff;text-decoration:none;border-radius:8px">Descargar factura (PDF)</a></p>
<p style="color:#64748b;font-size:12px">El enlace es válido hasta el ${escapeHtml(expires)}.</p>
</body></html>`;

  return { subject, text, html };
}
