import type { SqlRequest } from "../../graphql/resolvers/src/lib/sql-builders";
import { buildInvoiceEmail, invoicePdfFilename, invoicePdfKey, isValidRecipient, LINK_TTL_DAYS } from "./invoice-email";
import { signInvoiceLinkToken } from "./invoice-link-token";
import { renderInvoicePdf, type InvoicePdfData } from "./invoice-pdf";

export type DeliveryDeps = {
  runSql(request: SqlRequest): Promise<Record<string, unknown>[]>;
  putPdf(key: string, body: Uint8Array, filename: string): Promise<void>;
  sendEmail(email: { from: string; to: string; replyTo?: string; subject: string; html: string; text: string }): Promise<void>;
  getLinkSecret(): Promise<string>;
  sender: string | undefined;
  downloadBaseUrl: string;
  now(): Date;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function str(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

export function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function usDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${month}/${day}/${year}` : value;
}

/** Whole days from the due date to `now` in UTC (positive when overdue). */
export function daysPastDue(dueDate: string, now: Date) {
  const due = Date.UTC(Number(dueDate.slice(0, 4)), Number(dueDate.slice(5, 7)) - 1, Number(dueDate.slice(8, 10)));
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((today - due) / DAY_MS);
}

export function toPdfData(row: Record<string, unknown>): InvoicePdfData {
  const sections = JSON.parse(str(row.sectionsJson) || "[]") as Array<Record<string, unknown>>;
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
        lineItems: ((section.lineItems as Array<Record<string, unknown>>) ?? []).map((item) => ({
          description: str(item.description),
          quantity: num(item.quantity),
          amount: num(item.amount),
        })),
      })),
    },
  };
}

/**
 * Renders a fresh PDF snapshot, stores it under the tenant prefix, signs a
 * download link and emails it. `row` is an invoiceDocument row of `accountId`.
 */
export async function deliverInvoice(deps: DeliveryDeps, args: {
  accountId: string;
  invoiceId: string;
  row: Record<string, unknown>;
  to: string;
  message?: string | null;
  kind: "INVOICE" | "REMINDER";
}): Promise<{ linkExpiresAt: Date }> {
  if (!deps.sender) throw new Error("El envío de facturas por email no está configurado");

  const data = toPdfData(args.row);
  const sentAt = deps.now();
  const key = invoicePdfKey(args.accountId, args.invoiceId, sentAt);
  const filename = invoicePdfFilename(data.invoice.label);
  await deps.putPdf(key, await renderInvoicePdf(data), filename);

  const linkExpiresAt = new Date(sentAt.getTime() + LINK_TTL_DAYS * DAY_MS);
  const token = signInvoiceLinkToken({
    key, accountId: args.accountId, invoiceId: args.invoiceId, filename, expiresAt: linkExpiresAt.getTime(),
  }, await deps.getLinkSecret());
  const link = `${deps.downloadBaseUrl.replace(/\/+$/, "")}/?t=${encodeURIComponent(token)}`;

  const email = buildInvoiceEmail({
    kind: args.kind,
    issuerName: data.issuer.legalName || data.issuer.name,
    invoiceLabel: data.invoice.label,
    billToName: data.invoice.billToName,
    grandTotal: money(data.invoice.grandTotal, data.invoice.currency),
    balanceDue: money(num(args.row.balanceDue ?? data.invoice.grandTotal), data.invoice.currency),
    dueDate: data.invoice.dueDate ? usDate(data.invoice.dueDate) : null,
    daysOverdue: data.invoice.dueDate ? daysPastDue(data.invoice.dueDate, sentAt) : null,
    link,
    linkExpiresAt,
    message: args.message,
  });
  await deps.sendEmail({
    from: deps.sender,
    to: args.to,
    replyTo: isValidRecipient(data.issuer.email) ? data.issuer.email : undefined,
    ...email,
  });

  return { linkExpiresAt };
}
