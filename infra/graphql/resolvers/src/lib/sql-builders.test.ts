import { test, expect } from "vitest";
import {
  listInvoices, getInvoice, getInvoiceByNumber, deleteInvoice,
  listClients, getClient, deleteClient, getBankAccount, getAccount,
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
