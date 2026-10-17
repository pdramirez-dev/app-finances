import { test, expect } from "vitest";
import {
  listInvoices, getInvoice, getInvoiceByNumber, deleteInvoice, updateInvoiceStatus,
  listClients, getClient, deleteClient, getBankAccount, getAccount,
  putClient, putBankAccount, putAccount,
  putInvoiceCreate, createInvoiceFull, updateInvoiceFull, listInvoiceSeries, putInvoiceSeries, invoiceDocument, markInvoiceSent, putInvoiceSection, deleteInvoiceSection,
  putInvoiceLineItem, deleteInvoiceLineItem, sectionsByInvoice, lineItemsBySection,
  normalizeMaskedBankValue, isMaskedBankValue, invalidMaskedBankFields, decodePageToken, nextPageToken,
} from "./sql-builders";

test("listInvoices scopes by claim accountId and ignores args.accountId", () => {
  const r = listInvoices("ACC_A", { accountId: "ACC_B", limit: 10 } as any);
  expect(r.statement).toMatch(/account_id\s*=\s*:acc/i);
  expect(r.statement).not.toMatch(/\bScan\b/);
  expect(r.params.acc).toBe("ACC_A");
});

test("list builders paginate with offset and a stable tie-breaker order", () => {
  const inv = listInvoices("ACC_A", { limit: 10, offset: 20 });
  expect(inv.statement).toMatch(/ORDER BY created_at DESC, id DESC LIMIT :lim OFFSET :off/i);
  expect(inv.params).toMatchObject({ lim: 10, off: 20 });

  const cli = listClients("ACC_A", { limit: 10, offset: 20 });
  expect(cli.statement).toMatch(/ORDER BY lower\(name\), id LIMIT :lim OFFSET :off/i);
  expect(cli.params).toMatchObject({ lim: 10, off: 20 });
});

test("page tokens decode to offsets and reject tampered values", () => {
  expect(decodePageToken(undefined)).toBe(0);
  expect(decodePageToken(null)).toBe(0);
  expect(decodePageToken("")).toBe(0);
  expect(decodePageToken("50")).toBe(50);
  expect(decodePageToken("abc")).toBeNull();
  expect(decodePageToken("-25")).toBeNull();
  expect(decodePageToken("1.5")).toBeNull();
  expect(decodePageToken("1e3")).toBeNull();
});

test("nextPageToken continues on full pages and stops on short pages", () => {
  expect(nextPageToken(0, 25, 25)).toBe("25");
  expect(nextPageToken(25, 25, 25)).toBe("50");
  expect(nextPageToken(25, 25, 10)).toBeNull();
  expect(nextPageToken(0, 25, 0)).toBeNull();
});

test("getInvoice requires both id and account scope", () => {
  const r = getInvoice("ACC_A", { invoiceId: "INV1" } as any);
  expect(r.statement).toMatch(/id\s*=\s*:id/i);
  expect(r.statement).toMatch(/account_id\s*=\s*:acc/i);
  expect(r.params).toMatchObject({ id: "INV1", acc: "ACC_A" });
});

test("getInvoiceByNumber is scoped per account", () => {
  const r = getInvoiceByNumber("ACC_A", { invoiceNumber: 7 } as any);
  expect(r.statement).toMatch(/invoice_number\s*=\s*:num/i);
  expect(r.statement).toMatch(/account_id\s*=\s*:acc/i);
  expect(r.params).toMatchObject({ num: 7, acc: "ACC_A" });
});

test("deleteInvoice/deleteClient are scoped by account", () => {
  expect(deleteInvoice("ACC_A", { invoiceId: "X" } as any).statement)
    .toMatch(/DELETE FROM invoices WHERE id = :id AND account_id = :acc/i);
  expect(deleteClient("ACC_A", { clientId: "C" } as any).statement)
    .toMatch(/DELETE FROM clients WHERE id = :id AND account_id = :acc/i);
});

test("list/get builders for clients, bank, account scope by account", () => {
  expect(listClients("ACC_A", { accountId: "ACC_B" } as any).params.acc).toBe("ACC_A");
  expect(getClient("ACC_A", { clientId: "C" } as any).statement).toMatch(/account_id = :acc/i);
  expect(getBankAccount("ACC_A", { bankAccountId: "B" } as any).statement).toMatch(/account_id = :acc/i);
  expect(getAccount("ACC_A").statement).toMatch(/id = :acc/i);
});

test("putClient injects account_id from claim, not from input", () => {
  const r = putClient("ACC_A", { input: { accountId: "ACC_B", name: "X" } } as any);
  expect(r.statement).toMatch(/INSERT INTO clients/i);
  expect(r.statement).toMatch(/ON CONFLICT/i);
  expect(r.statement).toMatch(/WHERE clients\.account_id = :acc/i);
  expect(r.params.acc).toBe("ACC_A");
});

test("putBankAccount injects account_id from claim, not from input", () => {
  const r = putBankAccount("ACC_A", { input: { accountId: "ACC_B", beneficiaryName: "X", bankName: "B", currency: "USD" } } as any);
  expect(r.statement).toMatch(/INSERT INTO bank_accounts/i);
  expect(r.statement).toMatch(/ON CONFLICT/i);
  expect(r.statement).toMatch(/WHERE bank_accounts\.account_id = :acc/i);
  expect(r.params.acc).toBe("ACC_A");
});

test("bank identifiers must already be safely masked", () => {
  expect(normalizeMaskedBankValue(" ****6789 ")).toBe("****6789");
  expect(isMaskedBankValue("****6789")).toBe(true);
  expect(isMaskedBankValue("GB** **** 1234", 6)).toBe(true);
  expect(isMaskedBankValue("•••• 1234")).toBe(true);
  expect(isMaskedBankValue("123456789")).toBe(false);
  expect(isMaskedBankValue("**123456")).toBe(false);
  expect(invalidMaskedBankFields({ accountNumberMasked: "123456789", routingNumberMasked: "•••• 5678", ibanMasked: "" }))
    .toEqual(["accountNumberMasked"]);
});

test("putAccount upserts with account id from claim and returns aliased columns", () => {
  const r = putAccount("ACC_A", { input: { type: "business", displayName: "Acme" } } as any);
  expect(r.statement).toMatch(/INSERT INTO accounts/i);
  expect(r.statement).toMatch(/ON CONFLICT/i);
  expect(r.statement).toMatch(/RETURNING/i);
  expect(r.statement).toMatch(/id AS "accountId"/);
  expect(r.params.acc).toBe("ACC_A");
});

test("getClient SELECT aliases DB columns to camelCase GraphQL field names", () => {
  const r = getClient("ACC_A", { clientId: "C" } as any);
  expect(r.statement).toMatch(/id AS "clientId"/);
  expect(r.statement).toMatch(/tax_id AS "taxId"/);
  expect(r.statement).toMatch(/created_at AS "createdAt"/);
  expect(r.statement).toMatch(/account_id AS "accountId"/);
  expect(r.statement).toMatch(/updated_at AS "updatedAt"/);
});

test("getAccount SELECT aliases DB columns to camelCase GraphQL field names", () => {
  const r = getAccount("ACC_A");
  expect(r.statement).toMatch(/id AS "accountId"/);
  expect(r.statement).toMatch(/display_name AS "displayName"/);
  expect(r.statement).toMatch(/legal_name AS "legalName"/);
  expect(r.statement).toMatch(/tax_id AS "taxId"/);
  expect(r.statement).toMatch(/created_at AS "createdAt"/);
});

test("getBankAccount SELECT aliases DB columns to camelCase GraphQL field names", () => {
  const r = getBankAccount("ACC_A", { bankAccountId: "B" } as any);
  expect(r.statement).toMatch(/id AS "bankAccountId"/);
  expect(r.statement).toMatch(/beneficiary_name AS "beneficiaryName"/);
  expect(r.statement).toMatch(/swift_code AS "swiftCode"/);
  expect(r.statement).toMatch(/account_number_masked AS "accountNumberMasked"/);
  expect(r.statement).toMatch(/created_at AS "createdAt"/);
});

test("putClient RETURNING uses aliased column list", () => {
  const r = putClient("ACC_A", { input: { name: "X" } } as any);
  expect(r.statement).toMatch(/RETURNING/i);
  expect(r.statement).toMatch(/id AS "clientId"/);
  expect(r.statement).toMatch(/tax_id AS "taxId"/);
});

test("putBankAccount RETURNING uses aliased column list", () => {
  const r = putBankAccount("ACC_A", { input: { beneficiaryName: "X", bankName: "B", currency: "USD" } } as any);
  expect(r.statement).toMatch(/RETURNING/i);
  expect(r.statement).toMatch(/id AS "bankAccountId"/);
  expect(r.statement).toMatch(/beneficiary_name AS "beneficiaryName"/);
});

// ── Invoice alias tests ────────────────────────────────────────────────────────

test("listInvoices SELECT aliases invoice columns to camelCase GraphQL field names", () => {
  const r = listInvoices("ACC_A", {});
  expect(r.statement).toMatch(/id AS "invoiceId"/);
  expect(r.statement).toMatch(/invoice_number AS "invoiceNumber"/);
  expect(r.statement).toMatch(/week_number AS "weekNumber"/);
  expect(r.statement).toMatch(/bill_to_name AS "billToName"/);
  expect(r.statement).toMatch(/grand_total AS "grandTotal"/);
  expect(r.statement).toMatch(/created_at AS "createdAt"/);
  expect(r.statement).toMatch(/updated_at AS "updatedAt"/);
});

test("updateInvoiceStatus RETURNING uses aliased invoice columns", () => {
  const r = updateInvoiceStatus("ACC_A", { invoiceId: "X", status: "SENT" } as any);
  expect(r.statement).toMatch(/RETURNING/i);
  expect(r.statement).toMatch(/id AS "invoiceId"/);
  expect(r.statement).toMatch(/invoice_number AS "invoiceNumber"/);
});

test("putInvoice (create) bumps the per-account counter and inserts atomically", () => {
  const r = putInvoiceCreate("ACC_A", { input: { invoiceNumber: 0, date: "2026-01-01", weekNumber: 1,
    billToName: "x", billToAddress: "y", project: "p", grandTotal: 10 } } as any);
  expect(r.statement).toMatch(/INSERT INTO invoice_counters/i);
  expect(r.statement).toMatch(/ON CONFLICT[\s\S]*DO UPDATE SET/i);
  expect(r.statement).toMatch(/INSERT INTO invoices/i);
  expect(r.params.acc).toBe("ACC_A");
  expect(r.statement).toMatch(/clients c WHERE c\.id = CAST\(:clientId AS uuid\) AND c\.account_id = :acc/i);
});

test("putInvoiceCreate RETURNING uses aliased invoice columns", () => {
  const r = putInvoiceCreate("ACC_A", { input: { date: "2026-01-01", weekNumber: 1,
    billToName: "x", billToAddress: "y", project: "p", grandTotal: 10 } } as any);
  expect(r.statement).toMatch(/RETURNING/i);
  expect(r.statement).toMatch(/id AS "invoiceId"/);
  expect(r.statement).toMatch(/account_id AS "accountId"/);
  expect(r.statement).toMatch(/client_id AS "clientId"/);
  expect(r.statement).toMatch(/invoice_number AS "invoiceNumber"/);
  expect(r.statement).not.toMatch(/RETURNING \*/);
});

test("createInvoiceFull is a single atomic statement with counter bump and tenant-scoped client check", () => {
  const r = createInvoiceFull("ACC_A", { input: { clientId: "C1", date: "2026-01-01", weekNumber: 1,
    billToName: "x", billToAddress: "y", project: "p", grandTotal: 10,
    sections: [{ title: "S1", total: 10, lineItems: [{ description: "d", quantity: 1, amount: 10 }] }] } } as any);
  expect(r.statement).toMatch(/INSERT INTO invoice_counters/i);
  expect(r.statement).toMatch(/ON CONFLICT[\s\S]*DO UPDATE SET/i);
  expect(r.statement).toMatch(/INSERT INTO invoices/i);
  expect(r.statement).toMatch(/INSERT INTO invoice_sections/i);
  expect(r.statement).toMatch(/INSERT INTO invoice_line_items/i);
  expect(r.statement).toMatch(/clients c WHERE c\.id = CAST\(:clientId AS uuid\) AND c\.account_id = :acc/i);
  expect(r.statement).toMatch(/RETURNING/i);
  expect(r.statement).toMatch(/id AS "invoiceId"/);
  expect(r.params.acc).toBe("ACC_A");
});

test("createInvoiceFull serializes sections with positions derived from array order", () => {
  const r = createInvoiceFull("ACC_A", { input: { date: "2026-01-01", weekNumber: 1,
    billToName: "x", billToAddress: "y", project: "p", grandTotal: 30,
    sections: [
      { title: "S1", total: 10, lineItems: [{ description: "a", quantity: 1, amount: 10 }] },
      { title: "S2", total: 20, lineItems: [
        { description: "b", quantity: 2, amount: 5 },
        { description: "c", quantity: 1, amount: 10 },
      ] },
    ] } } as any);
  const sections = JSON.parse(r.params.sections as string);
  expect(sections).toEqual([
    { title: "S1", position: 0, total: 10, items: [{ description: "a", quantity: 1, amount: 10, position: 0 }] },
    { title: "S2", position: 1, total: 20, items: [
      { description: "b", quantity: 2, amount: 5, position: 0 },
      { description: "c", quantity: 1, amount: 10, position: 1 },
    ] },
  ]);
});

test("putInvoiceSection scopes via invoices join and returns aliased section cols", () => {
  const r = putInvoiceSection("ACC_A", { input: { invoiceId: "INV1", title: "T", position: 0, total: 0 } } as any);
  expect(r.statement).toMatch(/INSERT INTO invoice_sections/i);
  expect(r.statement).toMatch(/account_id = :acc/i);
  expect(r.statement).toMatch(/RETURNING/i);
  expect(r.statement).toMatch(/id AS "sectionId"/);
  expect(r.statement).toMatch(/invoice_id AS "invoiceId"/);
  expect(r.params.acc).toBe("ACC_A");
});

test("putInvoiceSection conflict-update is account-scoped (no cross-tenant tamper)", () => {
  const r = putInvoiceSection("ACC_A", { input: { invoiceId: "INV1", title: "T", position: 0, total: 0 } } as any);
  expect(r.statement).toMatch(/DO UPDATE SET[\s\S]*WHERE invoice_sections\.invoice_id IN \(SELECT id FROM invoices WHERE account_id = :acc\)/i);
});

test("deleteInvoiceSection scopes through invoices join", () => {
  const r = deleteInvoiceSection("ACC_A", { invoiceId: "INV1", sectionId: "SEC1" });
  expect(r.statement).toMatch(/DELETE FROM invoice_sections/i);
  expect(r.statement).toMatch(/account_id = :acc/i);
  expect(r.params).toMatchObject({ sectionId: "SEC1", invoiceId: "INV1", acc: "ACC_A" });
});

test("putInvoiceLineItem scopes through sections+invoices join and returns aliased cols", () => {
  const r = putInvoiceLineItem("ACC_A", { input: { sectionId: "SEC1", description: "d", quantity: 1, amount: 10, position: 0 } } as any);
  expect(r.statement).toMatch(/INSERT INTO invoice_line_items/i);
  expect(r.statement).toMatch(/account_id = :acc/i);
  expect(r.statement).toMatch(/RETURNING/i);
  expect(r.statement).toMatch(/id AS "lineItemId"/);
  expect(r.statement).toMatch(/section_id AS "sectionId"/);
  expect(r.params.acc).toBe("ACC_A");
});

test("putInvoiceLineItem conflict-update is account-scoped (no cross-tenant tamper)", () => {
  const r = putInvoiceLineItem("ACC_A", { input: { sectionId: "SEC1", description: "d", quantity: 1, amount: 10, position: 0 } } as any);
  expect(r.statement).toMatch(/DO UPDATE SET[\s\S]*WHERE invoice_line_items\.section_id IN \(SELECT s\.id FROM invoice_sections s JOIN invoices inv ON inv\.id = s\.invoice_id WHERE inv\.account_id = :acc\)/i);
});

test("deleteInvoiceLineItem scopes through sections+invoices join", () => {
  const r = deleteInvoiceLineItem("ACC_A", { sectionId: "SEC1", lineItemId: "LI1" });
  expect(r.statement).toMatch(/DELETE FROM invoice_line_items/i);
  expect(r.statement).toMatch(/account_id = :acc/i);
  expect(r.params).toMatchObject({ lineItemId: "LI1", sectionId: "SEC1", acc: "ACC_A" });
});

test("sectionsByInvoice reads invoiceId from source (aliased parent)", () => {
  const r = sectionsByInvoice("ACC_A", { invoiceId: "INV1" });
  expect(r.statement).toMatch(/SELECT/i);
  expect(r.statement).toMatch(/invoice_sections/i);
  expect(r.statement).toMatch(/account_id = :acc/i);
  expect(r.statement).toMatch(/id AS "sectionId"/);
  expect(r.params).toMatchObject({ invoiceId: "INV1", acc: "ACC_A" });
});

test("lineItemsBySection reads sectionId from source", () => {
  const r = lineItemsBySection("ACC_A", { sectionId: "SEC1" });
  expect(r.statement).toMatch(/SELECT/i);
  expect(r.statement).toMatch(/invoice_line_items/i);
  expect(r.statement).toMatch(/account_id = :acc/i);
  expect(r.statement).toMatch(/id AS "lineItemId"/);
  expect(r.params).toMatchObject({ sectionId: "SEC1", acc: "ACC_A" });
});

test("updateInvoiceFull replaces header, sections and items atomically for an editable tenant invoice", () => {
  const r = updateInvoiceFull("ACC_A", { invoiceId: "INV1", input: { clientId: "C1", date: "2026-01-01",
    weekNumber: 1, billToName: "x", billToAddress: "y", project: "p", grandTotal: 10,
    sections: [{ title: "S1", total: 10, lineItems: [{ description: "d", quantity: 1, amount: 10 }] }] } } as any);
  expect(r.statement).toMatch(/FROM invoices WHERE id = :invoiceId AND account_id = :acc AND status <> 'PAID'/i);
  expect(r.statement).toMatch(/clients c WHERE c\.id = CAST\(:clientId AS uuid\) AND c\.account_id = :acc/i);
  expect(r.statement).toMatch(/:grandTotal >= COALESCE\(\(\s*SELECT sum\(p\.amount\) FROM payments p/i);
  expect(r.statement).toMatch(/p\.status <> 'VOIDED'/);
  expect(r.statement).toMatch(/UPDATE invoices inv SET/i);
  expect(r.statement).toMatch(/DELETE FROM invoice_sections/i);
  expect(r.statement).toMatch(/INSERT INTO invoice_sections/i);
  expect(r.statement).toMatch(/INSERT INTO invoice_line_items/i);
  expect(r.statement).not.toMatch(/invoice_counters/i);
  expect(r.statement).not.toMatch(/status\s*=\s*:status/i);
  expect(r.statement).toMatch(/id AS "invoiceId"/);
  expect(r.params).toMatchObject({ acc: "ACC_A", invoiceId: "INV1", clientId: "C1", grandTotal: 10 });
  expect(JSON.parse(r.params.sections as string)).toEqual([
    { title: "S1", position: 0, total: 10, items: [{ description: "d", quantity: 1, amount: 10, position: 0 }] },
  ]);
});

test("updateInvoiceFull ignores a client-supplied accountId", () => {
  const r = updateInvoiceFull("ACC_A", { invoiceId: "INV1", input: { accountId: "ACC_B", date: "2026-01-01",
    weekNumber: 1, billToName: "x", billToAddress: "y", project: "p", grandTotal: 0, sections: [] } } as any);
  expect(r.params.acc).toBe("ACC_A");
  expect(Object.values(r.params)).not.toContain("ACC_B");
});

test("invoice rows expose their series", () => {
  const r = getInvoice("ACC_A", { invoiceId: "INV1" } as any);
  expect(r.statement).toMatch(/series_id AS "seriesId"/);
  expect(r.statement).toMatch(/series_code AS "seriesCode"/);
});

test("getInvoiceByNumber is scoped to a series and defaults to the general numbering", () => {
  expect(getInvoiceByNumber("ACC_A", { invoiceNumber: 7 } as any).params).toMatchObject({ series: "" });
  const r = getInvoiceByNumber("ACC_A", { invoiceNumber: 7, seriesCode: "A" } as any);
  expect(r.statement).toMatch(/series_code\s*=\s*:series/i);
  expect(r.params).toMatchObject({ num: 7, series: "A", acc: "ACC_A" });
});

test("createInvoiceFull bumps exactly one counter: the tenant's active series or the general one", () => {
  const r = createInvoiceFull("ACC_A", { input: { seriesId: "S1", date: "2026-01-01", weekNumber: 1,
    billToName: "x", billToAddress: "y", project: "p", grandTotal: 0, sections: [] } } as any);
  expect(r.statement).toMatch(/UPDATE invoice_series s SET last_number = s\.last_number \+ 1/i);
  expect(r.statement).toMatch(/s\.id = CAST\(:seriesId AS uuid\) AND s\.account_id = :acc AND s\.archived_at IS NULL/i);
  expect(r.statement).toMatch(/INSERT INTO invoice_counters[\s\S]*WHERE CAST\(:seriesId AS uuid\) IS NULL/i);
  expect(r.statement).toMatch(/series_id, series_code, invoice_number/i);
  expect(r.params).toMatchObject({ seriesId: "S1" });
  const general = createInvoiceFull("ACC_A", { input: { date: "2026-01-01", weekNumber: 1,
    billToName: "x", billToAddress: "y", project: "p", grandTotal: 0, sections: [] } } as any);
  expect(general.params.seriesId).toBeNull();
});

test("updateInvoiceFull never changes the series", () => {
  const r = updateInvoiceFull("ACC_A", { invoiceId: "INV1", input: { seriesId: "S2", date: "2026-01-01",
    weekNumber: 1, billToName: "x", billToAddress: "y", project: "p", grandTotal: 0, sections: [] } } as any);
  expect(r.statement).not.toMatch(/series_id\s*=/i);
  expect(r.params).not.toHaveProperty("seriesId");
});

test("listInvoiceSeries is tenant-scoped and flags the account default", () => {
  const r = listInvoiceSeries("ACC_A", { accountId: "ACC_B" } as any);
  expect(r.statement).toMatch(/s\.account_id = :acc/i);
  expect(r.statement).toMatch(/COALESCE\(a\.default_invoice_series_id = s\.id, false\) AS "isDefault"/i);
  expect(r.params).toEqual({ acc: "ACC_A" });
});

test("putInvoiceSeries creates with a start number and only renames, archives or re-defaults on update", () => {
  const created = putInvoiceSeries("ACC_A", { input: { code: "A", name: "Serie A", startNumber: 100, isDefault: true } } as any);
  expect(created.statement).toMatch(/INSERT INTO invoice_series \(account_id, code, name, last_number\)/i);
  expect(created.statement).toMatch(/WHERE CAST\(:seriesId AS uuid\) IS NULL/i);
  expect(created.statement).toMatch(/UPDATE invoice_series SET name = :name/i);
  expect(created.statement).not.toMatch(/SET[^;]*\bcode\s*=/i);
  expect(created.statement).toMatch(/UPDATE accounts a SET default_invoice_series_id/i);
  expect(created.params).toMatchObject({ acc: "ACC_A", seriesId: null, code: "A", name: "Serie A",
    lastNumber: 99, isDefault: true, archived: false });

  const updated = putInvoiceSeries("ACC_A", { input: { seriesId: "S1", name: "Renamed", archived: true } } as any);
  expect(updated.params).toMatchObject({ seriesId: "S1", code: null, lastNumber: 0, isDefault: false, archived: true });
});

test("invoiceDocument loads one tenant invoice with its sections, items, issuer and bank in one statement", () => {
  const r = invoiceDocument("ACC_A", { invoiceId: "INV1", accountId: "ACC_B" } as any);
  expect(r.statement).toMatch(/WHERE inv\.id = :invoiceId AND inv\.account_id = :acc/);
  expect(r.statement).toMatch(/FROM bank_accounts b WHERE b\.account_id = inv\.account_id/);
  expect(r.statement).toMatch(/AS "sectionsJson"/);
  expect(r.statement).toMatch(/CASE WHEN inv\.series_code = ''/);
  expect(r.statement).not.toMatch(/::/);
  expect(r.params).toEqual({ invoiceId: "INV1", acc: "ACC_A" });
});

test("markInvoiceSent only moves drafts of the caller's account", () => {
  const r = markInvoiceSent("ACC_A", { invoiceId: "INV1" });
  expect(r.statement).toMatch(/SET status = 'SENT'/);
  expect(r.statement).toMatch(/WHERE id = :invoiceId AND account_id = :acc AND status = 'DRAFT'/);
});

test("updateInvoiceFull requires the opened version, bumps it, and freezes the currency once paid", () => {
  const r = updateInvoiceFull("ACC_A", { invoiceId: "INV1", input: { expectedVersion: 3, currency: "EUR", date: "2026-01-01",
    weekNumber: 1, billToName: "x", billToAddress: "y", project: "p", grandTotal: 0, sections: [] } } as any);
  expect(r.statement).toMatch(/AND version = :expectedVersion/);
  expect(r.statement).toMatch(/version = inv\.version \+ 1/);
  expect(r.statement).toMatch(/upper\(CAST\(:currency AS text\)\) = upper\(invoices\.currency\)\s+OR NOT EXISTS/);
  expect(r.params).toMatchObject({ expectedVersion: 3, currency: "EUR" });
});
