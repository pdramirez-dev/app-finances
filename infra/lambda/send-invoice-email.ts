import {
  completeReminder, invoiceDocument, logManualReminder, markInvoiceSent,
} from "../graphql/resolvers/src/lib/sql-builders";
import { sendInvoiceEmailDeps } from "./lib/aws-deps";
import { isValidRecipient, MAX_EMAIL_MESSAGE_LENGTH } from "./lib/invoice-email";
import { deliverInvoice, type DeliveryDeps, num, str } from "./lib/invoice-delivery";

/** Built by the AppSync request function: tenant and actor come from Cognito claims. */
export type SendInvoiceEmailEvent = {
  accountId: string;
  actor: string;
  invoiceId: string;
  to: string;
  message?: string | null;
  /** REMINDER asks for the outstanding balance of a sent invoice. */
  kind?: "INVOICE" | "REMINDER";
};

export type SendInvoiceEmailResult = {
  invoiceId: string;
  sentTo: string;
  linkExpiresAt: string;
  statusUpdated: boolean;
  warning: string | null;
};

export type SendInvoiceEmailDeps = DeliveryDeps;

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
    const kind = event.kind === "REMINDER" ? "REMINDER" : "INVOICE";

    const [row] = await deps.runSql(invoiceDocument(event.accountId, { invoiceId: event.invoiceId }));
    if (!row) {
      throw new Error("Factura no encontrada");
    }

    if (kind === "REMINDER") {
      if (str(row.status) !== "SENT") throw new Error("Solo se envían recordatorios de facturas enviadas y no pagadas");
      if (num(row.balanceDue) <= 0) throw new Error("La factura no tiene saldo pendiente");
      const [logged] = await deps.runSql(logManualReminder(event.accountId, { invoiceId: event.invoiceId, recipient: to }));
      const reminderId = str(logged?.reminderId);
      try {
        const { linkExpiresAt } = await deliverInvoice(deps, { accountId: event.accountId, invoiceId: event.invoiceId, row, to, message, kind });
        await deps.runSql(completeReminder(event.accountId, { reminderId, sent: true })).catch(() => undefined);
        return { invoiceId: event.invoiceId, sentTo: to, linkExpiresAt: linkExpiresAt.toISOString(), statusUpdated: false, warning: null };
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        await deps.runSql(completeReminder(event.accountId, { reminderId, sent: false, error: reason })).catch(() => undefined);
        throw error;
      }
    }

    const { linkExpiresAt } = await deliverInvoice(deps, { accountId: event.accountId, invoiceId: event.invoiceId, row, to, message, kind });

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
