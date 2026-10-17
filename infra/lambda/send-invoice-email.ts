import { invoiceDocument, markInvoiceSent, type SqlRequest } from "../graphql/resolvers/src/lib/sql-builders";
import { sendInvoiceEmailDeps } from "./lib/aws-deps";
import {
  buildInvoiceEmail, invoicePdfFilename, invoicePdfKey, isValidRecipient, LINK_TTL_DAYS, MAX_EMAIL_MESSAGE_LENGTH,
} from "./lib/invoice-email";
import { signInvoiceLinkToken } from "./lib/invoice-link-token";
import { renderInvoicePdf, type InvoicePdfData } from "./lib/invoice-pdf";

/** Built by the AppSync request function: tenant and actor come from Cognito claims. */
export type SendInvoiceEmailEvent = {
  accountId: string;
  actor: string;
  invoiceId: string;
  to: string;
  message?: string | null;
};

export type SendInvoiceEmailResult = {
  invoiceId: string;
  sentTo: string;
  linkExpiresAt: string;
  statusUpdated: boolean;
  warning: string | null;
};

export type SendInvoiceEmailDeps = {
  runSql(request: SqlRequest): Promise<Record<string, unknown>[]>;
  putPdf(key: string, body: Uint8Array, filename: string): Promise<void>;
  sendEmail(email: { from: string; to: string; replyTo?: string; subject: string; html: string; text: string }): Promise<void>;
  getLinkSecret(): Promise<string>;
  sender: string | undefined;
  downloadBaseUrl: string;
  now(): Date;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function str(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function num(value: unknown): number {
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

export function createSendInvoiceEmailHandler(deps: SendInvoiceEmailDeps) {
  return async function handler(event: SendInvoiceEmailEvent): Promise<SendInvoiceEmailResult> {
    if (!deps.sender) {
      throw new Error("El envío de facturas por email no está configurado");
    }
    if (!event.accountId || !event.invoiceId) {
      throw new Error("Solicitud de envío inválida");
    }
    const to = str(event.to).trim();
    if (!isValidRecipient(to)) {
      throw new Error("Indica un único email de destino válido");
    }
    const message = str(event.message).trim();
    if (message.length > MAX_EMAIL_MESSAGE_LENGTH) {
      throw new Error(`El mensaje no puede superar ${MAX_EMAIL_MESSAGE_LENGTH} caracteres`);
    }

    const [row] = await deps.runSql(invoiceDocument(event.accountId, { invoiceId: event.invoiceId }));
    if (!row) {
      throw new Error("Factura no encontrada");
    }

    const data = toPdfData(row);
    const sentAt = deps.now();
    const key = invoicePdfKey(event.accountId, event.invoiceId, sentAt);
    const filename = invoicePdfFilename(data.invoice.label);
    await deps.putPdf(key, await renderInvoicePdf(data), filename);

    const linkExpiresAt = new Date(sentAt.getTime() + LINK_TTL_DAYS * DAY_MS);
    const token = signInvoiceLinkToken({
      key, accountId: event.accountId, invoiceId: event.invoiceId, filename, expiresAt: linkExpiresAt.getTime(),
    }, await deps.getLinkSecret());
    const link = `${deps.downloadBaseUrl.replace(/\/+$/, "")}/?t=${encodeURIComponent(token)}`;

    const email = buildInvoiceEmail({
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
      replyTo: isValidRecipient(data.issuer.email) ? data.issuer.email : undefined,
      ...email,
    });

    // The email is already out: a failed status update must not fail the
    // mutation, or the audit entry for the send would never be written.
    let statusUpdated = false;
    let warning: string | null = null;
    if (str(row.status) === "DRAFT") {
      try {
        statusUpdated = (await deps.runSql(markInvoiceSent(event.accountId, { invoiceId: event.invoiceId }))).length > 0;
      } catch {
        warning = "La factura se envió, pero no se pudo marcar como enviada";
      }
    }

    return { invoiceId: event.invoiceId, sentTo: to, linkExpiresAt: linkExpiresAt.toISOString(), statusUpdated, warning };
  };
}

let productionHandler: ((event: SendInvoiceEmailEvent) => Promise<SendInvoiceEmailResult>) | undefined;

export async function handler(event: SendInvoiceEmailEvent) {
  productionHandler ??= createSendInvoiceEmailHandler(sendInvoiceEmailDeps());
  return productionHandler(event);
}
