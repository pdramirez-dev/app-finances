"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_PAGE_SIZE = void 0;
exports.decodePageToken = decodePageToken;
exports.nextPageToken = nextPageToken;
exports.normalizeMaskedBankValue = normalizeMaskedBankValue;
exports.invoiceNumberLabel = invoiceNumberLabel;
exports.listInvoices = listInvoices;
exports.getInvoice = getInvoice;
exports.getInvoiceByNumber = getInvoiceByNumber;
exports.deleteInvoice = deleteInvoice;
exports.updateInvoiceStatus = updateInvoiceStatus;
exports.listClients = listClients;
exports.getClient = getClient;
exports.deleteClient = deleteClient;
exports.getBankAccount = getBankAccount;
exports.getAccount = getAccount;
exports.putClient = putClient;
exports.putBankAccount = putBankAccount;
exports.putAccount = putAccount;
exports.putInvoiceCreate = putInvoiceCreate;
exports.createInvoiceFull = createInvoiceFull;
exports.updateInvoiceFull = updateInvoiceFull;
exports.listInvoiceSeries = listInvoiceSeries;
exports.putInvoiceSeries = putInvoiceSeries;
exports.invoiceDocument = invoiceDocument;
exports.markInvoiceSent = markInvoiceSent;
exports.getReminderSettings = getReminderSettings;
exports.putReminderSettings = putReminderSettings;
exports.dueReminders = dueReminders;
exports.claimScheduledReminder = claimScheduledReminder;
exports.logManualReminder = logManualReminder;
exports.completeReminder = completeReminder;
exports.listInvoiceReminders = listInvoiceReminders;
exports.putInvoiceSection = putInvoiceSection;
exports.deleteInvoiceSection = deleteInvoiceSection;
exports.putInvoiceLineItem = putInvoiceLineItem;
exports.deleteInvoiceLineItem = deleteInvoiceLineItem;
exports.sectionsByInvoice = sectionsByInvoice;
exports.lineItemsBySection = lineItemsBySection;
exports.DEFAULT_PAGE_SIZE = 25;
function decodePageToken(token) {
    if (token === null || token === undefined || token === "")
        return 0;
    const offset = Number(token);
    if (!Number.isInteger(offset) || offset < 0)
        throw new Error("Invalid pagination token");
    return offset;
}
function nextPageToken(offset, limit, rowCount) {
    return rowCount < limit ? null : String(offset + limit);
}
function normalizeMaskedBankValue(value, maxVisible = 4) {
    if (value === null || value === undefined || value === "")
        return null;
    const normalized = String(value).trim();
    const visible = normalized.replace(/[*xX•\s.-]/g, "");
    if (!/[*xX•]/.test(normalized) || visible.length > maxVisible) {
        throw new Error("Bank identifiers must be masked and expose only their final characters");
    }
    return normalized;
}
const INVOICE_COLS = `id AS "invoiceId", account_id AS "accountId", client_id AS "clientId", invoice_number AS "invoiceNumber", series_id AS "seriesId", series_code AS "seriesCode", date, due_date AS "dueDate", week_number AS "weekNumber", bill_to_name AS "billToName", bill_to_address AS "billToAddress", project, currency, notes, grand_total AS "grandTotal", status, created_at AS "createdAt", updated_at AS "updatedAt"`;
// Same format as formatInvoiceNumber in the web app: "12" for the general
// numbering, "A-0012" for a series (padded to 4 digits, never truncated).
function invoiceNumberLabel(alias) {
    const col = (name) => (alias ? `${alias}.${name}` : name);
    const number = `CAST(${col("invoice_number")} AS text)`;
    return `(CASE WHEN ${col("series_code")} = '' THEN ${number}
    ELSE ${col("series_code")} || '-' || lpad(${number}, GREATEST(4, length(${number})), '0') END)`;
}
const SECTION_COLS = `id AS "sectionId", invoice_id AS "invoiceId", title, position, total`;
const LINE_ITEM_COLS = `id AS "lineItemId", section_id AS "sectionId", description, quantity, amount, position`;
const CLIENT_COLS = `id AS "clientId", account_id AS "accountId", name, email, phone, address, tax_id AS "taxId", industry, website, status, owner_user_id AS "ownerUserId", tags, notes, created_at AS "createdAt", updated_at AS "updatedAt"`;
const ACCOUNT_COLS = `id AS "accountId", type, display_name AS "displayName", legal_name AS "legalName", tax_id AS "taxId", email, phone, address, created_at AS "createdAt", updated_at AS "updatedAt"`;
const BANK_ACCOUNT_COLS = `id AS "bankAccountId", account_id AS "accountId", beneficiary_name AS "beneficiaryName", bank_name AS "bankName", account_number_masked AS "accountNumberMasked", routing_number_masked AS "routingNumberMasked", iban_masked AS "ibanMasked", swift_code AS "swiftCode", currency, country, created_at AS "createdAt", updated_at AS "updatedAt"`;
function listInvoices(acc, args) {
    const where = args.status ? "account_id = :acc AND status = :status" : "account_id = :acc";
    const params = { acc, lim: args.limit ?? exports.DEFAULT_PAGE_SIZE, off: args.offset ?? 0 };
    if (args.status)
        params.status = args.status;
    return {
        statement: `SELECT ${INVOICE_COLS} FROM invoices WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT :lim OFFSET :off`,
        params,
    };
}
function getInvoice(acc, args) {
    return {
        statement: `SELECT ${INVOICE_COLS} FROM invoices WHERE id = :id AND account_id = :acc`,
        params: { id: args.invoiceId, acc },
    };
}
function getInvoiceByNumber(acc, args) {
    return {
        statement: `SELECT ${INVOICE_COLS} FROM invoices
      WHERE invoice_number = :num AND series_code = :series AND account_id = :acc`,
        params: { num: args.invoiceNumber, series: args.seriesCode ?? "", acc },
    };
}
function deleteInvoice(acc, args) {
    return {
        statement: "DELETE FROM invoices WHERE id = :id AND account_id = :acc",
        params: { id: args.invoiceId, acc },
    };
}
function updateInvoiceStatus(acc, args) {
    return {
        statement: `UPDATE invoices SET status = :status, updated_at = now()
                WHERE id = :id AND account_id = :acc RETURNING ${INVOICE_COLS}`,
        params: { id: args.invoiceId, status: args.status, acc },
    };
}
function listClients(acc, args) {
    return {
        statement: `SELECT ${CLIENT_COLS} FROM clients WHERE account_id = :acc ORDER BY lower(name), id LIMIT :lim OFFSET :off`,
        params: { acc, lim: args.limit ?? exports.DEFAULT_PAGE_SIZE, off: args.offset ?? 0 },
    };
}
function getClient(acc, args) {
    return {
        statement: `SELECT ${CLIENT_COLS} FROM clients WHERE id = :id AND account_id = :acc`,
        params: { id: args.clientId, acc },
    };
}
function deleteClient(acc, args) {
    return {
        statement: "DELETE FROM clients WHERE id = :id AND account_id = :acc",
        params: { id: args.clientId, acc },
    };
}
function getBankAccount(acc, args) {
    return {
        statement: `SELECT ${BANK_ACCOUNT_COLS} FROM bank_accounts WHERE id = :id AND account_id = :acc`,
        params: { id: args.bankAccountId, acc },
    };
}
function getAccount(acc) {
    return { statement: `SELECT ${ACCOUNT_COLS} FROM accounts WHERE id = :acc`, params: { acc } };
}
function putClient(acc, args) {
    const i = args.input;
    return {
        statement: `INSERT INTO clients (id, account_id, name, email, phone, address, tax_id, industry,
                  website, status, owner_user_id, tags, notes, updated_at)
                VALUES (COALESCE(:id, gen_random_uuid()), :acc, :name, :email, :phone, :address, :taxId,
                  :industry, :website, :status, :ownerUserId,
                  ARRAY(SELECT jsonb_array_elements_text(CAST(:tags AS jsonb))), :notes, now())
                ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email,
                  phone = EXCLUDED.phone, address = EXCLUDED.address, tax_id = EXCLUDED.tax_id,
                  industry = EXCLUDED.industry, website = EXCLUDED.website, status = EXCLUDED.status,
                  owner_user_id = EXCLUDED.owner_user_id, tags = EXCLUDED.tags, notes = EXCLUDED.notes,
                  updated_at = now()
                WHERE clients.account_id = :acc
                RETURNING ${CLIENT_COLS}`,
        params: { id: i.clientId ?? null, acc, name: i.name, email: i.email ?? null,
            phone: i.phone ?? null, address: i.address ?? null, taxId: i.taxId ?? null,
            industry: i.industry ?? null, website: i.website ?? null, status: i.status ?? "ACTIVE",
            ownerUserId: i.ownerUserId ?? null, tags: JSON.stringify(i.tags ?? []), notes: i.notes ?? null },
    };
}
function putBankAccount(acc, args) {
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
function putAccount(acc, args) {
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
function putInvoiceCreate(acc, args) {
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
      INSERT INTO invoices (account_id, client_id, invoice_number, date, due_date, week_number, bill_to_name,
        bill_to_address, project, currency, notes, grand_total, status)
      SELECT :acc, valid_client.id, n.last_invoice_number, :date, :dueDate, :week, :billName, :billAddr, :project,
        :currency, :notes, :grandTotal, :status FROM n CROSS JOIN valid_client
      RETURNING ${INVOICE_COLS}`,
        params: { acc, clientId: i.clientId ?? null, date: i.date, dueDate: i.dueDate ?? null, week: i.weekNumber,
            billName: i.billToName, billAddr: i.billToAddress, project: i.project,
            currency: i.currency ?? "USD", notes: i.notes ?? null,
            grandTotal: i.grandTotal, status: i.status ?? "DRAFT" },
    };
}
// Positions derive from array order so the section/item JSON is self-describing
// and the line-item join can rely on unique section positions.
function serializeInvoiceSections(sections) {
    return JSON.stringify((sections ?? []).map((section, sectionIndex) => ({
        title: section.title,
        position: sectionIndex,
        total: section.total,
        items: (section.lineItems ?? []).map((item, itemIndex) => ({
            description: item.description,
            quantity: item.quantity,
            amount: item.amount,
            position: itemIndex,
        })),
    })));
}
const INVOICE_SECTIONS_INSERT_CTES = (invoiceCte) => `section_input AS (
        SELECT s.title, s.position, s.total, s.items
        FROM jsonb_to_recordset(CAST(:sections AS jsonb))
          AS s(title text, position int, total numeric, items jsonb)
      ), new_sections AS (
        INSERT INTO invoice_sections (invoice_id, title, position, total)
        SELECT ni.id, s.title, s.position, s.total FROM section_input s CROSS JOIN ${invoiceCte} ni
        RETURNING id, position
      ), new_line_items AS (
        INSERT INTO invoice_line_items (section_id, description, quantity, amount, position)
        SELECT ns.id, li.description, li.quantity, li.amount, li.position
        FROM section_input s
        JOIN new_sections ns ON ns.position = s.position
        CROSS JOIN LATERAL jsonb_to_recordset(s.items)
          AS li(description text, quantity numeric, amount numeric, position int)
        RETURNING id
      )`;
function createInvoiceFull(acc, args) {
    const i = args.input;
    return {
        statement: `WITH valid_client AS (
        SELECT CAST(:clientId AS uuid) AS id
        WHERE CAST(:clientId AS uuid) IS NULL OR EXISTS (
          SELECT 1 FROM clients c WHERE c.id = CAST(:clientId AS uuid) AND c.account_id = :acc
        )
      ), series_bump AS (
        UPDATE invoice_series s SET last_number = s.last_number + 1, updated_at = now()
        FROM valid_client
        WHERE s.id = CAST(:seriesId AS uuid) AND s.account_id = :acc AND s.archived_at IS NULL
        RETURNING s.id AS series_id, s.code AS series_code, s.last_number AS number
      ), general_bump AS (
        INSERT INTO invoice_counters (account_id, last_invoice_number)
        SELECT :acc, 1 FROM valid_client WHERE CAST(:seriesId AS uuid) IS NULL
        ON CONFLICT (account_id) DO UPDATE SET last_invoice_number = invoice_counters.last_invoice_number + 1
        RETURNING CAST(NULL AS uuid) AS series_id, CAST('' AS text) AS series_code, last_invoice_number AS number
      ), n AS (
        SELECT * FROM series_bump UNION ALL SELECT * FROM general_bump
      ), new_invoice AS (
        INSERT INTO invoices (account_id, client_id, series_id, series_code, invoice_number, date, due_date,
          week_number, bill_to_name, bill_to_address, project, currency, notes, grand_total, status)
        SELECT :acc, valid_client.id, n.series_id, n.series_code, n.number, :date, :dueDate, :week, :billName,
          :billAddr, :project, :currency, :notes, :grandTotal, :status FROM n CROSS JOIN valid_client
        RETURNING *
      ), ${INVOICE_SECTIONS_INSERT_CTES("new_invoice")}
      SELECT ${INVOICE_COLS} FROM new_invoice`,
        params: { acc, clientId: i.clientId ?? null, seriesId: i.seriesId ?? null, date: i.date,
            dueDate: i.dueDate ?? null, week: i.weekNumber,
            billName: i.billToName, billAddr: i.billToAddress, project: i.project,
            currency: i.currency ?? "USD", notes: i.notes ?? null,
            grandTotal: i.grandTotal, status: i.status ?? "DRAFT",
            sections: serializeInvoiceSections(i.sections) },
    };
}
// Paid invoices are immutable, and the new total may not drop below the
// non-voided payments already registered; status and invoice number are left untouched
// (status changes go through updateInvoiceStatus). Old sections are deleted in
// the same statement, so their line items cascade and the new ones replace them.
function updateInvoiceFull(acc, args) {
    const i = args.input;
    return {
        statement: `WITH target AS (
        SELECT id FROM invoices WHERE id = :invoiceId AND account_id = :acc AND status <> 'PAID'
          AND :grandTotal >= COALESCE((
            SELECT sum(p.amount) FROM payments p
            WHERE p.account_id = :acc AND p.invoice_id = invoices.id AND p.status <> 'VOIDED'
          ), 0)
        FOR UPDATE
      ), valid_client AS (
        SELECT CAST(:clientId AS uuid) AS id
        WHERE CAST(:clientId AS uuid) IS NULL OR EXISTS (
          SELECT 1 FROM clients c WHERE c.id = CAST(:clientId AS uuid) AND c.account_id = :acc
        )
      ), updated_invoice AS (
        UPDATE invoices inv SET client_id = valid_client.id, date = :date, due_date = :dueDate,
          week_number = :week, bill_to_name = :billName, bill_to_address = :billAddr, project = :project,
          currency = COALESCE(CAST(:currency AS text), inv.currency), notes = :notes,
          grand_total = :grandTotal, updated_at = now()
        FROM target CROSS JOIN valid_client
        WHERE inv.id = target.id
        RETURNING inv.*
      ), removed_sections AS (
        DELETE FROM invoice_sections WHERE invoice_id IN (SELECT id FROM updated_invoice)
        RETURNING id
      ), ${INVOICE_SECTIONS_INSERT_CTES("updated_invoice")}
      SELECT ${INVOICE_COLS} FROM updated_invoice`,
        params: { acc, invoiceId: args.invoiceId, clientId: i.clientId ?? null, date: i.date,
            dueDate: i.dueDate ?? null, week: i.weekNumber, billName: i.billToName,
            billAddr: i.billToAddress, project: i.project, currency: i.currency ?? null,
            notes: i.notes ?? null, grandTotal: i.grandTotal,
            sections: serializeInvoiceSections(i.sections) },
    };
}
const INVOICE_SERIES_COLS = `s.id AS "seriesId", s.account_id AS "accountId", s.code, s.name, s.last_number AS "lastNumber", s.last_number + 1 AS "nextNumber", (s.archived_at IS NOT NULL) AS archived, s.created_at AS "createdAt", s.updated_at AS "updatedAt"`;
function listInvoiceSeries(acc, _args) {
    return {
        statement: `SELECT ${INVOICE_SERIES_COLS}, COALESCE(a.default_invoice_series_id = s.id, false) AS "isDefault"
      FROM invoice_series s LEFT JOIN accounts a ON a.id = s.account_id
      WHERE s.account_id = :acc
      ORDER BY s.archived_at IS NOT NULL, s.code`,
        params: { acc },
    };
}
// Creates a series (code and starting number are fixed at creation) or updates
// its name and archived flag. isDefault is the desired state: true makes it the
// account default, false clears it only if it currently is the default, and an
// archived series can never stay the default.
function putInvoiceSeries(acc, args) {
    const i = args.input;
    const seriesId = i.seriesId ?? null;
    return {
        statement: `WITH new_series AS (
        INSERT INTO invoice_series (account_id, code, name, last_number)
        SELECT :acc, :code, :name, :lastNumber WHERE CAST(:seriesId AS uuid) IS NULL
        RETURNING *
      ), updated_series AS (
        UPDATE invoice_series SET name = :name,
          archived_at = CASE WHEN :archived THEN COALESCE(archived_at, now()) ELSE NULL END,
          updated_at = now()
        WHERE id = CAST(:seriesId AS uuid) AND account_id = :acc
        RETURNING *
      ), s AS (
        SELECT * FROM new_series UNION ALL SELECT * FROM updated_series
      ), default_update AS (
        UPDATE accounts a SET default_invoice_series_id = CASE
            WHEN :isDefault AND s.archived_at IS NULL THEN s.id
            WHEN a.default_invoice_series_id = s.id THEN NULL
            ELSE a.default_invoice_series_id
          END
        FROM s WHERE a.id = :acc
        RETURNING a.default_invoice_series_id
      )
      SELECT ${INVOICE_SERIES_COLS}, COALESCE(d.default_invoice_series_id = s.id, false) AS "isDefault"
      FROM s LEFT JOIN default_update d ON true`,
        params: { acc, seriesId, code: seriesId ? null : i.code, name: i.name,
            lastNumber: seriesId ? 0 : Math.max((i.startNumber ?? 1) - 1, 0),
            isDefault: i.isDefault ?? false, archived: i.archived ?? false },
    };
}
// Registered, non-voided payments count against the balance even before they
// are reconciled, so a client who already paid is never told they owe.
function nonVoidedPaymentsSum(invoiceAlias) {
    return `COALESCE((SELECT sum(p.amount) FROM payments p
    WHERE p.account_id = ${invoiceAlias}.account_id AND p.invoice_id = ${invoiceAlias}.id AND p.status <> 'VOIDED'), 0)`;
}
// Everything needed to render and email one invoice, in a single statement.
// Sections, line items and the latest bank account come back as JSON text.
function invoiceDocument(acc, args) {
    return {
        statement: `SELECT inv.id AS "invoiceId", inv.status, ${invoiceNumberLabel("inv")} AS "invoiceLabel",
        inv.date, inv.due_date AS "dueDate", inv.week_number AS "weekNumber", inv.bill_to_name AS "billToName",
        inv.bill_to_address AS "billToAddress", inv.project, inv.currency, inv.notes, inv.grand_total AS "grandTotal",
        inv.grand_total - ${nonVoidedPaymentsSum("inv")} AS "balanceDue",
        a.display_name AS "issuerName", a.legal_name AS "issuerLegalName", a.tax_id AS "issuerTaxId",
        a.address AS "issuerAddress", a.email AS "issuerEmail", a.phone AS "issuerPhone",
        CAST((
          SELECT json_build_object('beneficiaryName', b.beneficiary_name, 'bankName', b.bank_name,
            'accountNumberMasked', b.account_number_masked, 'routingNumberMasked', b.routing_number_masked,
            'ibanMasked', b.iban_masked, 'swiftCode', b.swift_code)
          FROM bank_accounts b WHERE b.account_id = inv.account_id ORDER BY b.updated_at DESC, b.id LIMIT 1
        ) AS text) AS "bankJson",
        CAST(COALESCE((
          SELECT json_agg(json_build_object('title', s.title, 'total', s.total, 'lineItems', COALESCE((
              SELECT json_agg(json_build_object('description', li.description, 'quantity', li.quantity,
                'amount', li.amount) ORDER BY li.position, li.id)
              FROM invoice_line_items li WHERE li.section_id = s.id
            ), CAST('[]' AS json))) ORDER BY s.position, s.id)
          FROM invoice_sections s WHERE s.invoice_id = inv.id
        ), CAST('[]' AS json)) AS text) AS "sectionsJson"
      FROM invoices inv JOIN accounts a ON a.id = inv.account_id
      WHERE inv.id = :invoiceId AND inv.account_id = :acc`,
        params: { invoiceId: args.invoiceId, acc },
    };
}
// Sending moves a draft to SENT; other statuses are left as they are.
function markInvoiceSent(acc, args) {
    return {
        statement: `UPDATE invoices SET status = 'SENT', updated_at = now()
      WHERE id = :invoiceId AND account_id = :acc AND status = 'DRAFT'
      RETURNING id AS "invoiceId", status`,
        params: { invoiceId: args.invoiceId, acc },
    };
}
function getReminderSettings(acc, _args) {
    return {
        statement: `SELECT id AS "accountId", reminders_enabled AS enabled, reminders_enabled_at AS "enabledAt",
        array_to_string(reminder_offsets, ',') AS "offsetsCsv"
      FROM accounts WHERE id = :acc`,
        params: { acc },
    };
}
// Offsets travel as comma-separated text because the Data API has no array
// parameters. Turning reminders on stamps reminders_enabled_at, which keeps the
// scheduler from reminding invoices that were already overdue at that moment.
function putReminderSettings(acc, args) {
    const offsets = [...new Set(args.input.offsets.map((value) => Math.trunc(value)))].sort((a, b) => a - b);
    return {
        statement: `UPDATE accounts SET
        reminders_enabled_at = CASE
          WHEN NOT :enabled THEN NULL
          WHEN reminders_enabled THEN reminders_enabled_at
          ELSE now()
        END,
        reminders_enabled = :enabled,
        reminder_offsets = CAST(string_to_array(:offsets, ',') AS int[]),
        updated_at = now()
      WHERE id = :acc
      RETURNING id AS "accountId", reminders_enabled AS enabled, reminders_enabled_at AS "enabledAt",
        array_to_string(reminder_offsets, ',') AS "offsetsCsv"`,
        params: { acc, enabled: Boolean(args.input.enabled), offsets: offsets.join(",") },
    };
}
/**
 * The only query that spans accounts: invoices with a scheduled reminder due
 * today. Every later step uses the row's own accountId. At most one offset per
 * invoice (the latest reached), only within a short window, never for dates
 * before the account opted in, and never soon after another reminder.
 */
function dueReminders(args) {
    return {
        statement: `SELECT DISTINCT ON (inv.id)
        inv.id AS "invoiceId", inv.account_id AS "accountId", NULLIF(btrim(c.email), '') AS recipient,
        o.offset_days AS "offsetDays", CAST(inv.due_date + o.offset_days AS text) AS "scheduledFor"
      FROM invoices inv
      JOIN accounts a ON a.id = inv.account_id
      LEFT JOIN clients c ON c.id = inv.client_id AND c.account_id = inv.account_id
      CROSS JOIN LATERAL unnest(a.reminder_offsets) AS o(offset_days)
      WHERE a.reminders_enabled
        AND inv.status = 'SENT'
        AND inv.due_date IS NOT NULL
        AND inv.due_date + o.offset_days <= CAST(:today AS date)
        AND inv.due_date + o.offset_days > CAST(:today AS date) - CAST(:windowDays AS int)
        AND inv.due_date + o.offset_days >= CAST(a.reminders_enabled_at AS date)
        AND inv.grand_total > ${nonVoidedPaymentsSum("inv")}
        AND NOT EXISTS (
          SELECT 1 FROM invoice_reminders r
          WHERE r.invoice_id = inv.id AND r.kind = 'SCHEDULED' AND r.offset_days = o.offset_days
        )
        AND NOT EXISTS (
          SELECT 1 FROM invoice_reminders r
          WHERE r.invoice_id = inv.id AND r.created_at > CAST(:minGapSince AS timestamptz)
        )
      ORDER BY inv.id, o.offset_days DESC
      LIMIT :lim`,
        params: { today: args.today, windowDays: args.windowDays, minGapSince: args.minGapSince, lim: args.limit },
    };
}
// Claims a scheduled reminder before sending. Exactly one caller gets a row
// back, so EventBridge or Lambda retries can never email the same reminder twice.
function claimScheduledReminder(acc, args) {
    return {
        statement: `INSERT INTO invoice_reminders (account_id, invoice_id, kind, offset_days, scheduled_for, recipient)
      SELECT inv.account_id, inv.id, 'SCHEDULED', :offsetDays, CAST(:scheduledFor AS date), :recipient
      FROM invoices inv WHERE inv.id = :invoiceId AND inv.account_id = :acc
      ON CONFLICT (invoice_id, offset_days) WHERE kind = 'SCHEDULED' DO NOTHING
      RETURNING id AS "reminderId"`,
        params: { acc, invoiceId: args.invoiceId, offsetDays: args.offsetDays, scheduledFor: args.scheduledFor,
            recipient: args.recipient },
    };
}
function logManualReminder(acc, args) {
    return {
        statement: `INSERT INTO invoice_reminders (account_id, invoice_id, kind, recipient)
      SELECT inv.account_id, inv.id, 'MANUAL', :recipient
      FROM invoices inv WHERE inv.id = :invoiceId AND inv.account_id = :acc
      RETURNING id AS "reminderId"`,
        params: { acc, invoiceId: args.invoiceId, recipient: args.recipient },
    };
}
function completeReminder(acc, args) {
    return {
        statement: `UPDATE invoice_reminders SET
        status = CASE WHEN :sent THEN 'SENT' ELSE 'FAILED' END,
        sent_at = CASE WHEN :sent THEN now() ELSE NULL END,
        error = :error
      WHERE id = :reminderId AND account_id = :acc
      RETURNING id AS "reminderId", status`,
        params: { acc, reminderId: args.reminderId, sent: args.sent, error: args.error ? args.error.slice(0, 500) : null },
    };
}
function listInvoiceReminders(acc, args) {
    return {
        statement: `SELECT id AS "reminderId", invoice_id AS "invoiceId", kind, offset_days AS "offsetDays",
        CAST(scheduled_for AS text) AS "scheduledFor", recipient, status, created_at AS "createdAt", sent_at AS "sentAt"
      FROM invoice_reminders WHERE invoice_id = :invoiceId AND account_id = :acc
      ORDER BY created_at DESC, id DESC LIMIT 50`,
        params: { invoiceId: args.invoiceId, acc },
    };
}
function putInvoiceSection(acc, args) {
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
function deleteInvoiceSection(acc, args) {
    return {
        statement: `DELETE FROM invoice_sections s USING invoices inv
      WHERE s.id = :sectionId AND s.invoice_id = inv.id AND inv.id = :invoiceId AND inv.account_id = :acc`,
        params: { sectionId: args.sectionId, invoiceId: args.invoiceId, acc },
    };
}
function putInvoiceLineItem(acc, args) {
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
function deleteInvoiceLineItem(acc, args) {
    return {
        statement: `DELETE FROM invoice_line_items li USING invoice_sections s JOIN invoices inv ON inv.id = s.invoice_id
      WHERE li.id = :lineItemId AND li.section_id = s.id AND s.id = :sectionId AND inv.account_id = :acc`,
        params: { lineItemId: args.lineItemId, sectionId: args.sectionId, acc },
    };
}
function sectionsByInvoice(acc, source) {
    return {
        statement: `SELECT s.id AS "sectionId", s.invoice_id AS "invoiceId", s.title, s.position, s.total
      FROM invoice_sections s JOIN invoices inv ON inv.id = s.invoice_id
      WHERE s.invoice_id = :invoiceId AND inv.account_id = :acc ORDER BY s.position`,
        params: { invoiceId: source.invoiceId, acc },
    };
}
function lineItemsBySection(acc, source) {
    return {
        statement: `SELECT li.id AS "lineItemId", li.section_id AS "sectionId", li.description, li.quantity, li.amount, li.position
      FROM invoice_line_items li JOIN invoice_sections s ON s.id = li.section_id
      JOIN invoices inv ON inv.id = s.invoice_id
      WHERE li.section_id = :sectionId AND inv.account_id = :acc ORDER BY li.position`,
        params: { sectionId: source.sectionId, acc },
    };
}
