export type SqlRequest = { statement: string; params: Record<string, unknown> };

const INVOICE_COLS =
  "id, account_id, client_id, invoice_number, date, week_number, bill_to_name, bill_to_address, project, currency, notes, grand_total, status, created_at, updated_at";

export function listInvoices(acc: string, args: { status?: string; limit?: number }): SqlRequest {
  const where = args.status ? "account_id = :acc AND status = :status" : "account_id = :acc";
  const params: Record<string, unknown> = { acc, lim: args.limit ?? 25 };
  if (args.status) params.status = args.status;
  return {
    statement: `SELECT ${INVOICE_COLS} FROM invoices WHERE ${where} ORDER BY created_at DESC LIMIT :lim`,
    params,
  };
}

export function getInvoice(acc: string, args: { invoiceId: string }): SqlRequest {
  return {
    statement: `SELECT ${INVOICE_COLS} FROM invoices WHERE id = :id AND account_id = :acc`,
    params: { id: args.invoiceId, acc },
  };
}

export function getInvoiceByNumber(acc: string, args: { invoiceNumber: number }): SqlRequest {
  return {
    statement: `SELECT ${INVOICE_COLS} FROM invoices WHERE invoice_number = :num AND account_id = :acc`,
    params: { num: args.invoiceNumber, acc },
  };
}

export function deleteInvoice(acc: string, args: { invoiceId: string }): SqlRequest {
  return {
    statement: "DELETE FROM invoices WHERE id = :id AND account_id = :acc",
    params: { id: args.invoiceId, acc },
  };
}

export function updateInvoiceStatus(acc: string, args: { invoiceId: string; status: string }): SqlRequest {
  return {
    statement: `UPDATE invoices SET status = :status, updated_at = now()
                WHERE id = :id AND account_id = :acc RETURNING ${INVOICE_COLS}`,
    params: { id: args.invoiceId, status: args.status, acc },
  };
}

export function listClients(acc: string, _args: { limit?: number }): SqlRequest {
  return {
    statement: "SELECT * FROM clients WHERE account_id = :acc ORDER BY lower(name) LIMIT :lim",
    params: { acc, lim: _args.limit ?? 25 },
  };
}

export function getClient(acc: string, args: { clientId: string }): SqlRequest {
  return {
    statement: "SELECT * FROM clients WHERE id = :id AND account_id = :acc",
    params: { id: args.clientId, acc },
  };
}

export function deleteClient(acc: string, args: { clientId: string }): SqlRequest {
  return {
    statement: "DELETE FROM clients WHERE id = :id AND account_id = :acc",
    params: { id: args.clientId, acc },
  };
}

export function getBankAccount(acc: string, args: { bankAccountId: string }): SqlRequest {
  return {
    statement: "SELECT * FROM bank_accounts WHERE id = :id AND account_id = :acc",
    params: { id: args.bankAccountId, acc },
  };
}

export function getAccount(acc: string): SqlRequest {
  return { statement: "SELECT * FROM accounts WHERE id = :acc", params: { acc } };
}
