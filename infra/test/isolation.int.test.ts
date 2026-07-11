import { afterAll, beforeAll, expect, test } from "vitest";
import { Client } from "pg";
import { runMigrations } from "../../db/migrate";
import {
  listClients, getClient, getInvoice,
  putInvoiceCreate, putInvoiceSection, deleteInvoiceSection,
  putInvoiceLineItem,
} from "../graphql/resolvers/src/lib/sql-builders";

const URL = process.env.TEST_DATABASE_URL ?? "postgres://app:app@localhost:55432/app_finances_test";
let db: Client;

// Ejecuta un SqlRequest (:name) sustituyendo por placeholders posicionales de pg.
async function run(req: { statement: string; params: Record<string, unknown> }) {
  const names = Object.keys(req.params);
  const text = req.statement.replace(/:([a-zA-Z_]+)/g, (_, n) => `$${names.indexOf(n) + 1}`);
  const values = names.map((n) => req.params[n]);
  const { rows } = await db.query(text, values);
  return rows;
}

beforeAll(async () => {
  await runMigrations(URL);
  db = new Client({ connectionString: URL });
  await db.connect();
  await db.query("DELETE FROM invoice_line_items; DELETE FROM invoice_sections; DELETE FROM invoices; DELETE FROM invoice_counters; DELETE FROM clients; DELETE FROM accounts;");
  await db.query("INSERT INTO accounts (id, type, display_name) VALUES ('11111111-1111-1111-1111-111111111111','COMPANY','A'),('22222222-2222-2222-2222-222222222222','COMPANY','B')");
  await db.query("INSERT INTO clients (id, account_id, name) VALUES ('aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Cliente A'),('bbbbbbbb-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','Cliente B')");
  await db.query(`INSERT INTO invoices (id, account_id, client_id, invoice_number, date, week_number, bill_to_name, bill_to_address, project, grand_total) VALUES ('cccccccc-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','bbbbbbbb-0000-0000-0000-000000000001',1,'2024-01-01',1,'Cliente B','123 B Street','Project B',1000.00)`);
  // Seed the counter for ACC_B to match its existing invoice so putInvoiceCreate doesn't collide.
  await db.query(`INSERT INTO invoice_counters (account_id, last_invoice_number) VALUES ('22222222-2222-2222-2222-222222222222', 1)`);
});

afterAll(async () => { await db?.end(); });

const ACC_A = "11111111-1111-1111-1111-111111111111";
const ACC_B = "22222222-2222-2222-2222-222222222222";

test("listClients only returns the caller account's clients", async () => {
  const rows = await run(listClients(ACC_A, {}));
  expect(rows).toHaveLength(1);
  expect(rows[0].name).toBe("Cliente A");
  expect(rows[0].clientId).toBe("aaaaaaaa-0000-0000-0000-000000000001");
});

test("account A cannot read account B's client by id", async () => {
  const rows = await run(getClient(ACC_A, { clientId: "bbbbbbbb-0000-0000-0000-000000000001" }));
  expect(rows).toHaveLength(0);
});

test("account A cannot read account B's invoice by id", async () => {
  const rows = await run(getInvoice(ACC_A, { invoiceId: "cccccccc-0000-0000-0000-000000000001" }));
  expect(rows).toHaveLength(0);
});

test("account B can read its own invoice by id (seed verification)", async () => {
  const rows = await run(getInvoice(ACC_B, { invoiceId: "cccccccc-0000-0000-0000-000000000001" }));
  expect(rows).toHaveLength(1);
});

test("putInvoiceCreate yields sequential per-account numbers starting at 1", async () => {
  const mk = () => ({ input: { date: "2026-01-01", weekNumber: 1, billToName: "a",
    billToAddress: "b", project: "p", grandTotal: 1 } });
  const r1 = await run(putInvoiceCreate(ACC_A, mk() as any));
  const r2 = await run(putInvoiceCreate(ACC_A, mk() as any));
  const r3 = await run(putInvoiceCreate(ACC_B, mk() as any));
  // ACC_A has no prior invoices: first call is 1, second is 2
  expect(r1[0].invoiceNumber).toBe(1);
  expect(r2[0].invoiceNumber).toBe(2);
  // ACC_B seed has invoice #1 and counter seeded to 1, so next is 2; importantly its counter is independent of ACC_A's
  expect(r3[0].invoiceNumber).toBe(2);
  // Cross-account independence: ACC_B's number is NOT a continuation of ACC_A's counter
  expect(r3[0].invoiceNumber).not.toBe(r2[0].invoiceNumber + 1);
});

test("account A cannot attach account B's client to a new invoice", async () => {
  const before = await db.query("SELECT last_invoice_number FROM invoice_counters WHERE account_id = $1", [ACC_A]);
  const rows = await run(putInvoiceCreate(ACC_A, { input: {
    clientId: "bbbbbbbb-0000-0000-0000-000000000001",
    date: "2026-01-01", weekNumber: 1, billToName: "b",
    billToAddress: "b", project: "p", grandTotal: 1,
  } } as any));
  expect(rows).toHaveLength(0);
  const after = await db.query("SELECT last_invoice_number FROM invoice_counters WHERE account_id = $1", [ACC_A]);
  expect(after.rows[0].last_invoice_number).toBe(before.rows[0].last_invoice_number);
});

test("deleteInvoiceSection cannot touch another account's section", async () => {
  const inv = (await run(putInvoiceCreate(ACC_A, { input: { date: "2026-01-01", weekNumber: 1,
    billToName: "a", billToAddress: "b", project: "p", grandTotal: 1 } } as any)))[0];
  const sec = (await run(putInvoiceSection(ACC_A, { input: { invoiceId: inv.invoiceId, title: "T", position: 0, total: 0 } } as any)))[0];
  const deletedByB = await run(deleteInvoiceSection(ACC_B, { invoiceId: inv.invoiceId, sectionId: sec.sectionId }));
  expect(deletedByB).toHaveLength(0); // B deletes nothing
});

test("putInvoiceSection cannot tamper with another account's section via ON CONFLICT", async () => {
  const inv = (await run(putInvoiceCreate(ACC_A, { input: { date: "2026-01-01", weekNumber: 1,
    billToName: "a", billToAddress: "b", project: "p", grandTotal: 1 } } as any)))[0];
  const sec = (await run(putInvoiceSection(ACC_A, { input: { invoiceId: inv.invoiceId, title: "ORIGINAL", position: 0, total: 0 } } as any)))[0];
  // B owns its own invoice; it submits A's section id as the conflicting PK to try to overwrite it.
  const bInv = (await run(putInvoiceCreate(ACC_B, { input: { date: "2026-01-01", weekNumber: 1,
    billToName: "b", billToAddress: "b", project: "p", grandTotal: 1 } } as any)))[0];
  const tamper = await run(putInvoiceSection(ACC_B, { input: { sectionId: sec.sectionId, invoiceId: bInv.invoiceId, title: "HACKED", position: 9, total: 999 } } as any));
  expect(tamper).toHaveLength(0); // conflict-update guard blocks the cross-tenant write
  const after = (await run(getInvoice(ACC_A, { invoiceId: inv.invoiceId })));
  expect(after).toHaveLength(1);
  const stillOriginal = await db.query(`SELECT title, position, total FROM invoice_sections WHERE id = $1`, [sec.sectionId]);
  expect(stillOriginal.rows[0]).toMatchObject({ title: "ORIGINAL", position: 0 });
});

test("putInvoiceLineItem cannot tamper with another account's line item via ON CONFLICT", async () => {
  const inv = (await run(putInvoiceCreate(ACC_A, { input: { date: "2026-01-01", weekNumber: 1,
    billToName: "a", billToAddress: "b", project: "p", grandTotal: 1 } } as any)))[0];
  const sec = (await run(putInvoiceSection(ACC_A, { input: { invoiceId: inv.invoiceId, title: "S", position: 0, total: 0 } } as any)))[0];
  const li = (await run(putInvoiceLineItem(ACC_A, { input: { sectionId: sec.sectionId, description: "ORIGINAL", quantity: 1, amount: 10, position: 0 } } as any)))[0];
  const bInv = (await run(putInvoiceCreate(ACC_B, { input: { date: "2026-01-01", weekNumber: 1,
    billToName: "b", billToAddress: "b", project: "p", grandTotal: 1 } } as any)))[0];
  const bSec = (await run(putInvoiceSection(ACC_B, { input: { invoiceId: bInv.invoiceId, title: "BS", position: 0, total: 0 } } as any)))[0];
  const tamper = await run(putInvoiceLineItem(ACC_B, { input: { lineItemId: li.lineItemId, sectionId: bSec.sectionId, description: "HACKED", quantity: 99, amount: 999, position: 9 } } as any));
  expect(tamper).toHaveLength(0);
  const still = await db.query(`SELECT description, amount FROM invoice_line_items WHERE id = $1`, [li.lineItemId]);
  expect(still.rows[0]).toMatchObject({ description: "ORIGINAL" });
});
