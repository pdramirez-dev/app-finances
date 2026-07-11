export type SqlRequest = { statement: string; params: Record<string, unknown> };

export function normalizeMaskedBankValue(value: unknown, maxVisible = 4): string | null {
  if (value === null || value === undefined || value === "") return null;
  const normalized = String(value).trim();
  const visible = normalized.replace(/[*xX•\s.-]/g, "");

  if (!/[*xX•]/.test(normalized) || visible.length > maxVisible) {
    throw new Error("Bank identifiers must be masked and expose only their final characters");
  }

  return normalized;
}

const INVOICE_COLS =
  `id AS "invoiceId", account_id AS "accountId", client_id AS "clientId", invoice_number AS "invoiceNumber", date, week_number AS "weekNumber", bill_to_name AS "billToName", bill_to_address AS "billToAddress", project, currency, notes, grand_total AS "grandTotal", status, created_at AS "createdAt", updated_at AS "updatedAt"`;

const SECTION_COLS =
  `id AS "sectionId", invoice_id AS "invoiceId", title, position, total`;

const LINE_ITEM_COLS =
  `id AS "lineItemId", section_id AS "sectionId", description, quantity, amount, position`;

const CLIENT_COLS =
  `id AS "clientId", account_id AS "accountId", name, email, phone, address, tax_id AS "taxId", created_at AS "createdAt", updated_at AS "updatedAt"`;

const ACCOUNT_COLS =
  `id AS "accountId", type, display_name AS "displayName", legal_name AS "legalName", tax_id AS "taxId", email, phone, address, created_at AS "createdAt", updated_at AS "updatedAt"`;

const BANK_ACCOUNT_COLS =
  `id AS "bankAccountId", account_id AS "accountId", beneficiary_name AS "beneficiaryName", bank_name AS "bankName", account_number_masked AS "accountNumberMasked", routing_number_masked AS "routingNumberMasked", iban_masked AS "ibanMasked", swift_code AS "swiftCode", currency, country, created_at AS "createdAt", updated_at AS "updatedAt"`;

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
    statement: `SELECT ${CLIENT_COLS} FROM clients WHERE account_id = :acc ORDER BY lower(name) LIMIT :lim`,
    params: { acc, lim: _args.limit ?? 25 },
  };
}

export function getClient(acc: string, args: { clientId: string }): SqlRequest {
  return {
    statement: `SELECT ${CLIENT_COLS} FROM clients WHERE id = :id AND account_id = :acc`,
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
    statement: `SELECT ${BANK_ACCOUNT_COLS} FROM bank_accounts WHERE id = :id AND account_id = :acc`,
    params: { id: args.bankAccountId, acc },
  };
}

export function getAccount(acc: string): SqlRequest {
  return { statement: `SELECT ${ACCOUNT_COLS} FROM accounts WHERE id = :acc`, params: { acc } };
}

export function putClient(acc: string, args: { input: any }): SqlRequest {
  const i = args.input;
  return {
    statement: `INSERT INTO clients (id, account_id, name, email, phone, address, tax_id, updated_at)
                VALUES (COALESCE(:id, gen_random_uuid()), :acc, :name, :email, :phone, :address, :taxId, now())
                ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email,
                  phone = EXCLUDED.phone, address = EXCLUDED.address, tax_id = EXCLUDED.tax_id, updated_at = now()
                WHERE clients.account_id = :acc
                RETURNING ${CLIENT_COLS}`,
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
                RETURNING ${BANK_ACCOUNT_COLS}`,
    params: { id: i.bankAccountId ?? null, acc, ben: i.beneficiaryName, bank: i.bankName,
              acct: normalizeMaskedBankValue(i.accountNumberMasked),
              rout: normalizeMaskedBankValue(i.routingNumberMasked),
              iban: normalizeMaskedBankValue(i.ibanMasked, 6),
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
                RETURNING ${ACCOUNT_COLS}`,
    params: { acc, type: i.type, displayName: i.displayName, legalName: i.legalName ?? null,
              taxId: i.taxId ?? null, email: i.email ?? null, phone: i.phone ?? null, address: i.address ?? null },
  };
}

export function putInvoiceCreate(acc: string, args: { input: any }): SqlRequest {
  const i = args.input;
  return {
    statement: `WITH valid_client AS (
        SELECT CAST(:clientId AS uuid) AS id
        WHERE CAST(:clientId AS uuid) IS NULL OR EXISTS (
          SELECT 1 FROM clients c WHERE c.id = CAST(:clientId AS uuid) AND c.account_id = :acc
        )
      ), n AS (
        INSERT INTO invoice_counters (account_id, last_invoice_number)
        SELECT :acc, 1 FROM valid_client
        ON CONFLICT (account_id) DO UPDATE SET last_invoice_number = invoice_counters.last_invoice_number + 1
        RETURNING last_invoice_number)
      INSERT INTO invoices (account_id, client_id, invoice_number, date, week_number, bill_to_name,
        bill_to_address, project, currency, notes, grand_total, status)
      SELECT :acc, valid_client.id, n.last_invoice_number, :date, :week, :billName, :billAddr, :project,
        :currency, :notes, :grandTotal, :status FROM n CROSS JOIN valid_client
      RETURNING ${INVOICE_COLS}`,
    params: { acc, clientId: i.clientId ?? null, date: i.date, week: i.weekNumber,
              billName: i.billToName, billAddr: i.billToAddress, project: i.project,
              currency: i.currency ?? "USD", notes: i.notes ?? null,
              grandTotal: i.grandTotal, status: i.status ?? "DRAFT" },
  };
}

export function putInvoiceSection(acc: string, args: { input: any }): SqlRequest {
  const i = args.input;
  return {
    statement: `INSERT INTO invoice_sections (id, invoice_id, title, position, total)
      SELECT COALESCE(:id, gen_random_uuid()), inv.id, :title, :position, :total
        FROM invoices inv WHERE inv.id = :invoiceId AND inv.account_id = :acc
      ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, position = EXCLUDED.position, total = EXCLUDED.total
      WHERE invoice_sections.invoice_id IN (SELECT id FROM invoices WHERE account_id = :acc)
      RETURNING ${SECTION_COLS}`,
    params: { id: i.sectionId ?? null, invoiceId: i.invoiceId, acc, title: i.title,
              position: i.position, total: i.total },
  };
}

export function deleteInvoiceSection(acc: string, args: { invoiceId: string; sectionId: string }): SqlRequest {
  return {
    statement: `DELETE FROM invoice_sections s USING invoices inv
      WHERE s.id = :sectionId AND s.invoice_id = inv.id AND inv.id = :invoiceId AND inv.account_id = :acc`,
    params: { sectionId: args.sectionId, invoiceId: args.invoiceId, acc },
  };
}

export function putInvoiceLineItem(acc: string, args: { input: any }): SqlRequest {
  const i = args.input;
  return {
    statement: `INSERT INTO invoice_line_items (id, section_id, description, quantity, amount, position)
      SELECT COALESCE(:id, gen_random_uuid()), s.id, :description, :quantity, :amount, :position
        FROM invoice_sections s JOIN invoices inv ON inv.id = s.invoice_id
        WHERE s.id = :sectionId AND inv.account_id = :acc
      ON CONFLICT (id) DO UPDATE SET description = EXCLUDED.description, quantity = EXCLUDED.quantity,
        amount = EXCLUDED.amount, position = EXCLUDED.position
      WHERE invoice_line_items.section_id IN (SELECT s.id FROM invoice_sections s JOIN invoices inv ON inv.id = s.invoice_id WHERE inv.account_id = :acc)
      RETURNING ${LINE_ITEM_COLS}`,
    params: { id: i.lineItemId ?? null, sectionId: i.sectionId, acc,
              description: i.description, quantity: i.quantity,
              amount: i.amount, position: i.position },
  };
}

export function deleteInvoiceLineItem(acc: string, args: { sectionId: string; lineItemId: string }): SqlRequest {
  return {
    statement: `DELETE FROM invoice_line_items li USING invoice_sections s JOIN invoices inv ON inv.id = s.invoice_id
      WHERE li.id = :lineItemId AND li.section_id = s.id AND s.id = :sectionId AND inv.account_id = :acc`,
    params: { lineItemId: args.lineItemId, sectionId: args.sectionId, acc },
  };
}

export function sectionsByInvoice(acc: string, source: { invoiceId: string }): SqlRequest {
  return {
    statement: `SELECT s.id AS "sectionId", s.invoice_id AS "invoiceId", s.title, s.position, s.total
      FROM invoice_sections s JOIN invoices inv ON inv.id = s.invoice_id
      WHERE s.invoice_id = :invoiceId AND inv.account_id = :acc ORDER BY s.position`,
    params: { invoiceId: source.invoiceId, acc },
  };
}

export function lineItemsBySection(acc: string, source: { sectionId: string }): SqlRequest {
  return {
    statement: `SELECT li.id AS "lineItemId", li.section_id AS "sectionId", li.description, li.quantity, li.amount, li.position
      FROM invoice_line_items li JOIN invoice_sections s ON s.id = li.section_id
      JOIN invoices inv ON inv.id = s.invoice_id
      WHERE li.section_id = :sectionId AND inv.account_id = :acc ORDER BY li.position`,
    params: { sectionId: source.sectionId, acc },
  };
}
