import { test, expect } from "vitest";
import {
  listInvoices, getInvoice, getInvoiceByNumber, deleteInvoice, updateInvoiceStatus,
  listClients, getClient, deleteClient, getBankAccount, getAccount,
  putClient, putBankAccount, putAccount,
  putInvoiceCreate, putInvoiceSection, deleteInvoiceSection,
  putInvoiceLineItem, deleteInvoiceLineItem, sectionsByInvoice, lineItemsBySection,
  normalizeMaskedBankValue,
} from "./sql-builders";

test("listInvoices scopes by claim accountId and ignores args.accountId", () => {
  const r = listInvoices("ACC_A", { accountId: "ACC_B", limit: 10 } as any);
  expect(r.statement).toMatch(/account_id\s*=\s*:acc/i);
  expect(r.statement).not.toMatch(/\bScan\b/);
  expect(r.params.acc).toBe("ACC_A");
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
  expect(normalizeMaskedBankValue("****6789")).toBe("****6789");
  expect(normalizeMaskedBankValue("GB** **** 1234", 6)).toBe("GB** **** 1234");
  expect(() => normalizeMaskedBankValue("123456789")).toThrow(/must be masked/i);
  expect(() => normalizeMaskedBankValue("**123456")).toThrow(/final characters/i);
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
