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

export function putClient(acc: string, args: { input: any }): SqlRequest {
  const i = args.input;
  return {
    statement: `INSERT INTO clients (id, account_id, name, email, phone, address, tax_id, updated_at)
                VALUES (COALESCE(:id, gen_random_uuid()), :acc, :name, :email, :phone, :address, :taxId, now())
                ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email,
                  phone = EXCLUDED.phone, address = EXCLUDED.address, tax_id = EXCLUDED.tax_id, updated_at = now()
                WHERE clients.account_id = :acc
                RETURNING *`,
    params: { id: i.clientId ?? null, acc, name: i.name, email: i.email ?? null,
              phone: i.phone ?? null, address: i.address ?? null, taxId: i.taxId ?? null },
  };
}

export function putBankAccount(acc: string, args: { input: any }): SqlRequest {
  const i = args.input;
  return {
    statement: `INSERT INTO bank_accounts (id, account_id, beneficiary_name, bank_name,
                  account_number_masked, routing_number_masked, iban_masked, swift_code, currency, country, updated_at)
                VALUES (COALESCE(:id, gen_random_uuid()), :acc, :ben, :bank, :acct, :rout, :iban, :swift, :cur, :country, now())
                ON CONFLICT (id) DO UPDATE SET beneficiary_name = EXCLUDED.beneficiary_name, bank_name = EXCLUDED.bank_name,
                  account_number_masked = EXCLUDED.account_number_masked, routing_number_masked = EXCLUDED.routing_number_masked,
                  iban_masked = EXCLUDED.iban_masked, swift_code = EXCLUDED.swift_code, currency = EXCLUDED.currency,
                  country = EXCLUDED.country, updated_at = now()
                WHERE bank_accounts.account_id = :acc
                RETURNING *`,
    params: { id: i.bankAccountId ?? null, acc, ben: i.beneficiaryName, bank: i.bankName,
              acct: i.accountNumberMasked ?? null, rout: i.routingNumberMasked ?? null, iban: i.ibanMasked ?? null,
              swift: i.swiftCode ?? null, cur: i.currency, country: i.country ?? null },
  };
}

export function putAccount(acc: string, args: { input: any }): SqlRequest {
  const i = args.input;
  return {
    statement: `INSERT INTO accounts (id, type, display_name, legal_name, tax_id, email, phone, address, updated_at)
                VALUES (:acc, :type, :displayName, :legalName, :taxId, :email, :phone, :address, now())
                ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, display_name = EXCLUDED.display_name,
                  legal_name = EXCLUDED.legal_name, tax_id = EXCLUDED.tax_id, email = EXCLUDED.email,
                  phone = EXCLUDED.phone, address = EXCLUDED.address, updated_at = now()
                RETURNING *`,
    params: { acc, type: i.type, displayName: i.displayName, legalName: i.legalName ?? null,
              taxId: i.taxId ?? null, email: i.email ?? null, phone: i.phone ?? null, address: i.address ?? null },
  };
}
