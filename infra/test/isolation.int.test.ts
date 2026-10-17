import { afterAll, beforeAll, expect, test } from "vitest";
import { Client } from "pg";
import { runMigrations } from "../../db/migrate";
import { bindLikeDataApi } from "./data-api-binding";
import {
  listClients, getClient, getInvoice,
  putInvoiceCreate, createInvoiceFull, updateInvoiceFull, listInvoiceSeries, putInvoiceSeries, invoiceDocument, markInvoiceSent, getReminderSettings, putReminderSettings, dueReminders, claimScheduledReminder, logManualReminder, completeReminder, listInvoiceReminders, putInvoiceSection, deleteInvoiceSection,
  putInvoiceLineItem,
} from "../graphql/resolvers/src/lib/sql-builders";
import { registerPayment } from "../graphql/resolvers/src/lib/crm-sql-builders";

const URL = process.env.TEST_DATABASE_URL ?? "postgres://app:app@localhost:55432/app_nexo_test";

const dbAvailable = await (async () => {
  const probe = new Client({ connectionString: URL, connectionTimeoutMillis: 2000 });
  try {
    await probe.connect();
    await probe.end();
    return true;
  } catch {
    console.warn(`Skipping isolation tests: no Postgres reachable at ${URL}`);
    return false;
  }
})();

const dbTest = test.skipIf(!dbAvailable);
let db: Client;

// Ejecuta un SqlRequest tipando los parámetros como lo hace el Data API.
async function run(req: { statement: string; params: Record<string, unknown> }) {
  const { rows } = await db.query(bindLikeDataApi(req));
  return rows;
}

beforeAll(async () => {
  if (!dbAvailable) return;
  await runMigrations(URL);
  db = new Client({ connectionString: URL });
  await db.connect();
  await db.query("DELETE FROM invoice_reminders; DELETE FROM payments; DELETE FROM bank_accounts; DELETE FROM invoice_line_items; DELETE FROM invoice_sections; DELETE FROM invoices; UPDATE accounts SET default_invoice_series_id = NULL; DELETE FROM invoice_series; DELETE FROM invoice_counters; DELETE FROM clients; DELETE FROM accounts;");
  await db.query("INSERT INTO accounts (id, type, display_name) VALUES ('11111111-1111-1111-1111-111111111111','COMPANY','A'),('22222222-2222-2222-2222-222222222222','COMPANY','B')");
  await db.query("INSERT INTO clients (id, account_id, name) VALUES ('aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Cliente A'),('bbbbbbbb-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','Cliente B')");
  await db.query(`INSERT INTO invoices (id, account_id, client_id, invoice_number, date, week_number, bill_to_name, bill_to_address, project, grand_total) VALUES ('cccccccc-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','bbbbbbbb-0000-0000-0000-000000000001',1,'2024-01-01',1,'Cliente B','123 B Street','Project B',1000.00)`);
  // Seed the counter for ACC_B to match its existing invoice so putInvoiceCreate doesn't collide.
  await db.query(`INSERT INTO invoice_counters (account_id, last_invoice_number) VALUES ('22222222-2222-2222-2222-222222222222', 1)`);
});

afterAll(async () => { await db?.end(); });

const ACC_A = "11111111-1111-1111-1111-111111111111";
const ACC_B = "22222222-2222-2222-2222-222222222222";

dbTest("listClients only returns the caller account's clients", async () => {
  const rows = await run(listClients(ACC_A, {}));
  expect(rows).toHaveLength(1);
  expect(rows[0].name).toBe("Cliente A");
  expect(rows[0].clientId).toBe("aaaaaaaa-0000-0000-0000-000000000001");
});

dbTest("account A cannot read account B's client by id", async () => {
  const rows = await run(getClient(ACC_A, { clientId: "bbbbbbbb-0000-0000-0000-000000000001" }));
  expect(rows).toHaveLength(0);
});

dbTest("account A cannot read account B's invoice by id", async () => {
  const rows = await run(getInvoice(ACC_A, { invoiceId: "cccccccc-0000-0000-0000-000000000001" }));
  expect(rows).toHaveLength(0);
});

dbTest("account B can read its own invoice by id (seed verification)", async () => {
  const rows = await run(getInvoice(ACC_B, { invoiceId: "cccccccc-0000-0000-0000-000000000001" }));
  expect(rows).toHaveLength(1);
});

dbTest("putInvoiceCreate yields sequential per-account numbers starting at 1", async () => {
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

dbTest("account A cannot attach account B's client to a new invoice", async () => {
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

dbTest("deleteInvoiceSection cannot touch another account's section", async () => {
  const inv = (await run(putInvoiceCreate(ACC_A, { input: { date: "2026-01-01", weekNumber: 1,
    billToName: "a", billToAddress: "b", project: "p", grandTotal: 1 } } as any)))[0];
  const sec = (await run(putInvoiceSection(ACC_A, { input: { invoiceId: inv.invoiceId, title: "T", position: 0, total: 0 } } as any)))[0];
  const deletedByB = await run(deleteInvoiceSection(ACC_B, { invoiceId: inv.invoiceId, sectionId: sec.sectionId }));
  expect(deletedByB).toHaveLength(0); // B deletes nothing
});

dbTest("putInvoiceSection cannot tamper with another account's section via ON CONFLICT", async () => {
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

dbTest("putInvoiceLineItem cannot tamper with another account's line item via ON CONFLICT", async () => {
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

dbTest("createInvoiceFull creates invoice, sections and line items in one statement", async () => {
  const rows = await run(createInvoiceFull(ACC_A, { input: {
    date: "2026-02-01", weekNumber: 5, billToName: "Full", billToAddress: "Addr", project: "P",
    grandTotal: 25,
    sections: [
      { title: "Crew", total: 15, lineItems: [
        { description: "Day 1", quantity: 1, amount: 10 },
        { description: "Day 2", quantity: 0.5, amount: 10 },
      ] },
      { title: "Extras", total: 10, lineItems: [{ description: "Gear", quantity: 1, amount: 10 }] },
    ],
  } } as any));
  expect(rows).toHaveLength(1);
  expect(rows[0].invoiceNumber).toBeGreaterThan(0);

  const sections = await db.query(
    "SELECT id, title, position FROM invoice_sections WHERE invoice_id = $1 ORDER BY position",
    [rows[0].invoiceId],
  );
  expect(sections.rows.map((r) => [r.title, r.position])).toEqual([["Crew", 0], ["Extras", 1]]);

  const items = await db.query(
    `SELECT li.description, li.position, s.title AS section_title
     FROM invoice_line_items li JOIN invoice_sections s ON s.id = li.section_id
     WHERE s.invoice_id = $1 ORDER BY s.position, li.position`,
    [rows[0].invoiceId],
  );
  expect(items.rows.map((r) => [r.section_title, r.description, r.position])).toEqual([
    ["Crew", "Day 1", 0],
    ["Crew", "Day 2", 1],
    ["Extras", "Gear", 0],
  ]);
});

dbTest("createInvoiceFull with a foreign client id inserts nothing at all (atomicity)", async () => {
  const countRows = () => db.query(
    `SELECT (SELECT count(*)::int FROM invoices) AS inv,
            (SELECT count(*)::int FROM invoice_sections) AS sec,
            (SELECT count(*)::int FROM invoice_line_items) AS li,
            (SELECT COALESCE(max(last_invoice_number), 0) FROM invoice_counters WHERE account_id = '${ACC_A}') AS counter`,
  );
  const before = (await countRows()).rows[0];
  const rows = await run(createInvoiceFull(ACC_A, { input: {
    clientId: "bbbbbbbb-0000-0000-0000-000000000001", // belongs to ACC_B
    date: "2026-02-01", weekNumber: 5, billToName: "Full", billToAddress: "Addr", project: "P",
    grandTotal: 10,
    sections: [{ title: "Crew", total: 10, lineItems: [{ description: "Day", quantity: 1, amount: 10 }] }],
  } } as any));
  expect(rows).toHaveLength(0);
  const after = (await countRows()).rows[0];
  expect(after).toEqual(before);
});

const sectionLayout = async (invoiceId: string) => (await db.query(
  `SELECT s.title, li.description, li.position
   FROM invoice_sections s LEFT JOIN invoice_line_items li ON li.section_id = s.id
   WHERE s.invoice_id = $1 ORDER BY s.position, li.position`,
  [invoiceId],
)).rows.map((r) => [r.title, r.description, r.position]);

const createEditableInvoice = async () => (await run(createInvoiceFull(ACC_A, { input: {
  date: "2026-03-01", weekNumber: 9, billToName: "Original", billToAddress: "Addr", project: "P",
  grandTotal: 20,
  sections: [{ title: "Old", total: 20, lineItems: [{ description: "Old item", quantity: 2, amount: 10 }] }],
} } as any)))[0];

dbTest("updateInvoiceFull replaces header, sections and line items and keeps number and status", async () => {
  const created = await createEditableInvoice();
  const rows = await run(updateInvoiceFull(ACC_A, { invoiceId: created.invoiceId, input: {
    expectedVersion: created.version,
    clientId: "aaaaaaaa-0000-0000-0000-000000000001",
    date: "2026-03-02", weekNumber: 10, billToName: "Edited", billToAddress: "New addr", project: "P2",
    grandTotal: 35,
    sections: [
      { title: "Crew", total: 30, lineItems: [
        { description: "Day 1", quantity: 1, amount: 10 },
        { description: "Day 2", quantity: 2, amount: 10 },
      ] },
      { title: "Extras", total: 5, lineItems: [{ description: "Gear", quantity: 1, amount: 5 }] },
    ],
  } } as any));
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ invoiceId: created.invoiceId, invoiceNumber: created.invoiceNumber,
    status: "DRAFT", billToName: "Edited", clientId: "aaaaaaaa-0000-0000-0000-000000000001" });
  expect(Number(rows[0].grandTotal)).toBe(35);
  expect(await sectionLayout(created.invoiceId)).toEqual([
    ["Crew", "Day 1", 0], ["Crew", "Day 2", 1], ["Extras", "Gear", 0],
  ]);
});

dbTest("updateInvoiceFull cannot edit another account's invoice", async () => {
  const rows = await run(updateInvoiceFull(ACC_A, { invoiceId: "cccccccc-0000-0000-0000-000000000001", input: {
    expectedVersion: 1, date: "2026-03-02", weekNumber: 10, billToName: "Hijacked", billToAddress: "x", project: "x",
    grandTotal: 0, sections: [],
  } } as any));
  expect(rows).toHaveLength(0);
  const still = await db.query("SELECT bill_to_name FROM invoices WHERE id = 'cccccccc-0000-0000-0000-000000000001'");
  expect(still.rows[0].bill_to_name).toBe("Cliente B");
});

dbTest("updateInvoiceFull leaves paid invoices and foreign-client edits untouched", async () => {
  const created = await createEditableInvoice();
  const edit = (clientId: string | null) => run(updateInvoiceFull(ACC_A, { invoiceId: created.invoiceId, input: {
    expectedVersion: created.version, clientId, date: "2026-03-02", weekNumber: 10, billToName: "Edited", billToAddress: "x", project: "x",
    grandTotal: 0, sections: [],
  } } as any));

  expect(await edit("bbbbbbbb-0000-0000-0000-000000000001")).toHaveLength(0); // client of ACC_B
  expect(await sectionLayout(created.invoiceId)).toEqual([["Old", "Old item", 0]]);

  await db.query("UPDATE invoices SET status = 'PAID' WHERE id = $1", [created.invoiceId]);
  expect(await edit(null)).toHaveLength(0);
  const still = await db.query("SELECT bill_to_name FROM invoices WHERE id = $1", [created.invoiceId]);
  expect(still.rows[0].bill_to_name).toBe("Original");
  expect(await sectionLayout(created.invoiceId)).toEqual([["Old", "Old item", 0]]);
});

dbTest("updateInvoiceFull cannot lower the total below registered non-voided payments", async () => {
  const created = await createEditableInvoice(); // grandTotal 20
  await db.query(
    `INSERT INTO payments (account_id, invoice_id, amount, method, reference)
     VALUES ($1, $2, 15, 'ACH', $3)`,
    [ACC_A, created.invoiceId, `REF-${created.invoiceId}`],
  );
  const edit = (grandTotal: number) => run(updateInvoiceFull(ACC_A, { invoiceId: created.invoiceId, input: {
    expectedVersion: created.version, date: "2026-03-02", weekNumber: 10, billToName: "Edited", billToAddress: "x", project: "x", grandTotal,
    sections: [{ title: "S", total: grandTotal, lineItems: [{ description: "d", quantity: 1, amount: grandTotal }] }],
  } } as any));

  expect(await edit(10)).toHaveLength(0);
  expect(await sectionLayout(created.invoiceId)).toEqual([["Old", "Old item", 0]]);
  expect(await edit(15)).toHaveLength(1);
});

const seriesInvoiceInput = (seriesId: string | null, clientId: string | null = null) => ({ input: {
  seriesId, clientId, date: "2026-04-01", weekNumber: 14, billToName: "Serie", billToAddress: "Addr", project: "P",
  grandTotal: 10,
  sections: [{ title: "S", total: 10, lineItems: [{ description: "d", quantity: 1, amount: 10 }] }],
} } as any);

const counterState = async () => (await db.query(
  `SELECT (SELECT count(*)::int FROM invoices) AS inv,
          (SELECT COALESCE(max(last_invoice_number), 0) FROM invoice_counters WHERE account_id = $1) AS general,
          (SELECT COALESCE(json_object_agg(code, last_number), '{}'::json) FROM invoice_series) AS series`,
  [ACC_A],
)).rows[0];

dbTest("putInvoiceSeries creates a series with a start number and makes it the account default", async () => {
  const [series] = await run(putInvoiceSeries(ACC_A, { input: { code: "SA", name: "Serie A", startNumber: 100, isDefault: true } }));
  expect(series).toMatchObject({ code: "SA", name: "Serie A", lastNumber: 99, nextNumber: 100, isDefault: true, archived: false });

  const listedByB = await run(listInvoiceSeries(ACC_B, {}));
  expect(listedByB.map((row) => row.code)).not.toContain("SA");
});

dbTest("series numbering is independent from the general numbering and other series", async () => {
  const [a] = await run(putInvoiceSeries(ACC_A, { input: { code: "NA", name: "Numeración A", startNumber: 1 } }));
  const [b] = await run(putInvoiceSeries(ACC_A, { input: { code: "NB", name: "Numeración B", startNumber: 50 } }));
  const generalBefore = (await counterState()).general;

  const first = (await run(createInvoiceFull(ACC_A, seriesInvoiceInput(a.seriesId))))[0];
  const second = (await run(createInvoiceFull(ACC_A, seriesInvoiceInput(a.seriesId))))[0];
  const other = (await run(createInvoiceFull(ACC_A, seriesInvoiceInput(b.seriesId))))[0];
  const general = (await run(createInvoiceFull(ACC_A, seriesInvoiceInput(null))))[0];

  expect([first.seriesCode, first.invoiceNumber, first.seriesId]).toEqual(["NA", 1, a.seriesId]);
  expect([second.seriesCode, second.invoiceNumber]).toEqual(["NA", 2]);
  expect([other.seriesCode, other.invoiceNumber]).toEqual(["NB", 50]);
  expect([general.seriesCode, general.seriesId, general.invoiceNumber]).toEqual(["", null, generalBefore + 1]);
});

dbTest("createInvoiceFull with a foreign or archived series inserts nothing and moves no counter", async () => {
  const [foreign] = await run(putInvoiceSeries(ACC_B, { input: { code: "FB", name: "Ajena", startNumber: 1 } }));
  const [archived] = await run(putInvoiceSeries(ACC_A, { input: { code: "AR", name: "Archivada", startNumber: 1 } }));
  await run(putInvoiceSeries(ACC_A, { input: { seriesId: archived.seriesId, name: "Archivada", archived: true } }));

  const before = await counterState();
  expect(await run(createInvoiceFull(ACC_A, seriesInvoiceInput(foreign.seriesId)))).toHaveLength(0);
  expect(await run(createInvoiceFull(ACC_A, seriesInvoiceInput(archived.seriesId)))).toHaveLength(0);
  // A valid series with a foreign client must not move the series counter either.
  const [own] = await run(putInvoiceSeries(ACC_A, { input: { code: "OW", name: "Propia", startNumber: 1 } }));
  const beforeOwn = await counterState();
  expect(await run(createInvoiceFull(ACC_A, seriesInvoiceInput(own.seriesId, "bbbbbbbb-0000-0000-0000-000000000001")))).toHaveLength(0);
  expect(await counterState()).toEqual(beforeOwn);
  expect({ ...(await counterState()), series: undefined }).toEqual({ ...before, series: undefined });
});

dbTest("switching or archiving the default series keeps at most one default", async () => {
  const [first] = await run(putInvoiceSeries(ACC_A, { input: { code: "D1", name: "Uno", startNumber: 1, isDefault: true } }));
  const [second] = await run(putInvoiceSeries(ACC_A, { input: { code: "D2", name: "Dos", startNumber: 1, isDefault: true } }));
  expect(second.isDefault).toBe(true);
  const defaults = () => run(listInvoiceSeries(ACC_A, {})).then((rows) => rows.filter((row) => row.isDefault).map((row) => row.code));
  expect(await defaults()).toEqual(["D2"]);

  const [archived] = await run(putInvoiceSeries(ACC_A, { input: { seriesId: second.seriesId, name: "Dos", isDefault: true, archived: true } }));
  expect(archived).toMatchObject({ archived: true, isDefault: false });
  expect(await defaults()).toEqual([]);

  await run(putInvoiceSeries(ACC_A, { input: { seriesId: first.seriesId, name: "Uno", isDefault: true } }));
  expect(await defaults()).toEqual(["D1"]);
});

dbTest("putInvoiceSeries cannot update another account's series", async () => {
  const [foreign] = await run(putInvoiceSeries(ACC_B, { input: { code: "XB", name: "De B", startNumber: 1 } }));
  expect(await run(putInvoiceSeries(ACC_A, { input: { seriesId: foreign.seriesId, name: "Hijacked", isDefault: true } }))).toHaveLength(0);
  const still = await db.query("SELECT name FROM invoice_series WHERE id = $1", [foreign.seriesId]);
  expect(still.rows[0].name).toBe("De B");
});

dbTest("invoiceDocument returns the series label, ordered sections and items, issuer and bank", async () => {
  const [series] = await run(putInvoiceSeries(ACC_A, { input: { code: "DOC", name: "Docs", startNumber: 7 } }));
  const created = (await run(createInvoiceFull(ACC_A, { input: {
    seriesId: series.seriesId, date: "2026-05-01", dueDate: "2026-05-31", weekNumber: 18, billToName: "Doc Client",
    billToAddress: "Addr", project: "P", grandTotal: 35, notes: "Gracias",
    sections: [
      { title: "Uno", total: 30, lineItems: [
        { description: "a", quantity: 1, amount: 10 }, { description: "b", quantity: 2, amount: 10 },
      ] },
      { title: "Dos", total: 5, lineItems: [{ description: "c", quantity: 0.5, amount: 10 }] },
    ],
  } } as any)))[0];
  await db.query(
    `INSERT INTO bank_accounts (account_id, beneficiary_name, bank_name, account_number_masked, currency)
     VALUES ($1, 'Benef', 'Banco', '•••• 1234', 'USD')`,
    [ACC_A],
  );

  const rows = await run(invoiceDocument(ACC_A, { invoiceId: created.invoiceId }));
  expect(rows).toHaveLength(1);
  const doc = rows[0];
  expect(doc).toMatchObject({ invoiceLabel: "DOC-0007", status: "DRAFT", billToName: "Doc Client", issuerName: "A", notes: "Gracias" });
  expect(JSON.parse(doc.bankJson)).toMatchObject({ bankName: "Banco", accountNumberMasked: "•••• 1234" });
  const sections = JSON.parse(doc.sectionsJson);
  expect(sections.map((section: any) => section.title)).toEqual(["Uno", "Dos"]);
  expect(sections[0].lineItems.map((item: any) => [item.description, Number(item.quantity), Number(item.amount)]))
    .toEqual([["a", 1, 10], ["b", 2, 10]]);

  expect(await run(invoiceDocument(ACC_B, { invoiceId: created.invoiceId }))).toHaveLength(0);
});

dbTest("markInvoiceSent moves a draft once and never touches other accounts", async () => {
  const created = await createEditableInvoice();
  expect(await run(markInvoiceSent(ACC_B, { invoiceId: created.invoiceId }))).toHaveLength(0);
  expect(await run(markInvoiceSent(ACC_A, { invoiceId: created.invoiceId }))).toEqual([{ invoiceId: created.invoiceId, status: "SENT" }]);
  expect(await run(markInvoiceSent(ACC_A, { invoiceId: created.invoiceId }))).toHaveLength(0);
});

// --- Payment reminders -------------------------------------------------------

const sentInvoiceDue = async (dueDate: string, grandTotal = 100) => {
  const created = (await run(createInvoiceFull(ACC_A, { input: {
    clientId: "aaaaaaaa-0000-0000-0000-000000000001", date: "2026-01-15", dueDate, weekNumber: 3,
    billToName: "Recordatorio", billToAddress: "Addr", project: "P", grandTotal,
    sections: [{ title: "S", total: grandTotal, lineItems: [{ description: "d", quantity: 1, amount: grandTotal }] }],
  } } as any)))[0];
  await db.query("UPDATE invoices SET status = 'SENT' WHERE id = $1", [created.invoiceId]);
  return created.invoiceId as string;
};

const due = async (invoiceIds: string[], today: string, minGapSince = "2999-01-01T00:00:00Z") =>
  (await run(dueReminders({ today, windowDays: 3, minGapSince, limit: 500 })))
    .filter((row) => invoiceIds.includes(row.invoiceId));

const enableRemindersSince = async (enabledAt: string) => {
  await run(putReminderSettings(ACC_A, { input: { enabled: true, offsets: [-3, 0, 7, 14] } }));
  await db.query("UPDATE accounts SET reminders_enabled_at = $2 WHERE id = $1", [ACC_A, enabledAt]);
};

dbTest("reminder settings default off, round-trip offsets as text and stamp the opt-in time once", async () => {
  await db.query("UPDATE clients SET email = 'cuentas@cliente-a.example' WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001'");
  const [initial] = await run(getReminderSettings(ACC_A, {}));
  expect(initial).toMatchObject({ enabled: false, enabledAt: null, offsetsCsv: "-3,0,7,14" });

  const [on] = await run(putReminderSettings(ACC_A, { input: { enabled: true, offsets: [10, 0, 5, 10, -3] } }));
  expect(on).toMatchObject({ enabled: true, offsetsCsv: "-3,0,5,10" });
  const [again] = await run(putReminderSettings(ACC_A, { input: { enabled: true, offsets: [0] } }));
  expect(again.enabledAt).toEqual(on.enabledAt);
  const [off] = await run(putReminderSettings(ACC_A, { input: { enabled: false, offsets: [0] } }));
  expect(off).toMatchObject({ enabled: false, enabledAt: null });

  await expect(run(putReminderSettings(ACC_A, { input: { enabled: true, offsets: [120] } }))).rejects.toThrow(/reminder_offsets_valid/);
});

dbTest("dueReminders picks the latest reached offset inside the window, only for opted-in accounts", async () => {
  const invoiceId = await sentInvoiceDue("2026-02-10");
  await run(putReminderSettings(ACC_A, { input: { enabled: false, offsets: [-3, 0, 7, 14] } }));
  expect(await due([invoiceId], "2026-02-10")).toEqual([]);

  await enableRemindersSince("2026-01-01T00:00:00Z");
  const pick = async (today: string) => (await due([invoiceId], today)).map((row) => [row.offsetDays, row.scheduledFor]);
  expect(await pick("2026-02-06")).toEqual([]);
  expect(await pick("2026-02-07")).toEqual([[-3, "2026-02-07"]]);
  expect(await pick("2026-02-10")).toEqual([[0, "2026-02-10"]]);
  expect(await pick("2026-02-19")).toEqual([[7, "2026-02-17"]]);
  expect(await pick("2026-02-20")).toEqual([]); // 02-17 fell out of the 3-day window
  expect(await pick("2026-03-30")).toEqual([]);
  const [row] = await due([invoiceId], "2026-02-10");
  expect(row).toMatchObject({ accountId: ACC_A, recipient: "cuentas@cliente-a.example" });
});

dbTest("dueReminders never reminds dates before the opt-in, paid balances, or right after another reminder", async () => {
  const invoiceId = await sentInvoiceDue("2026-02-10", 100);
  await enableRemindersSince("2026-02-15T12:00:00Z");
  expect(await due([invoiceId], "2026-02-12")).toEqual([]); // offset 0 (02-10) predates the opt-in
  expect((await due([invoiceId], "2026-02-17")).map((row) => row.offsetDays)).toEqual([7]);

  await db.query(
    "INSERT INTO payments (account_id, invoice_id, amount, method, reference) VALUES ($1, $2, 40, 'ACH', $3)",
    [ACC_A, invoiceId, `REM-${invoiceId}`],
  );
  expect((await due([invoiceId], "2026-02-17")).map((row) => row.offsetDays)).toEqual([7]); // partially paid
  await db.query(
    "INSERT INTO payments (account_id, invoice_id, amount, method, reference) VALUES ($1, $2, 60, 'CASH', $3)",
    [ACC_A, invoiceId, `REM2-${invoiceId}`],
  );
  expect(await due([invoiceId], "2026-02-17")).toEqual([]); // unreconciled payments still settle it

  const other = await sentInvoiceDue("2026-02-10");
  await run(logManualReminder(ACC_A, { invoiceId: other, recipient: "x@y.co" }));
  expect(await due([other], "2026-02-17", "2000-01-01T00:00:00Z")).toEqual([]); // min gap after any reminder
  expect((await due([other], "2026-02-17")).map((row) => row.offsetDays)).toEqual([7]);
});

dbTest("a scheduled reminder is claimed by exactly one of two racing workers", async () => {
  const invoiceId = await sentInvoiceDue("2026-02-10");
  const second = new Client({ connectionString: URL });
  await second.connect();
  try {
    const claim = claimScheduledReminder(ACC_A, { invoiceId, offsetDays: 0, scheduledFor: "2026-02-10", recipient: "a@b.co" });
    const names = Object.keys(claim.params);
    const text = claim.statement.replace(/:([a-zA-Z_]+)/g, (_, n) => `$${names.indexOf(n) + 1}`);
    const values = names.map((n) => claim.params[n]);
    const [a, b] = await Promise.all([db.query(text, values), second.query(text, values)]);
    expect(a.rows.length + b.rows.length).toBe(1);
  } finally {
    await second.end();
  }
  await enableRemindersSince("2026-01-01T00:00:00Z");
  expect(await due([invoiceId], "2026-02-10")).toEqual([]); // the claimed offset is never picked again
});

dbTest("reminder claims, completions and history stay inside the caller's account", async () => {
  const invoiceId = await sentInvoiceDue("2026-02-10");
  expect(await run(claimScheduledReminder(ACC_B, { invoiceId, offsetDays: 7, scheduledFor: "2026-02-17", recipient: "a@b.co" }))).toEqual([]);
  expect(await run(logManualReminder(ACC_B, { invoiceId, recipient: "a@b.co" }))).toEqual([]);

  const [claimed] = await run(claimScheduledReminder(ACC_A, { invoiceId, offsetDays: 7, scheduledFor: "2026-02-17", recipient: "a@b.co" }));
  expect(await run(completeReminder(ACC_B, { reminderId: claimed.reminderId, sent: true }))).toEqual([]);
  expect(await run(completeReminder(ACC_A, { reminderId: claimed.reminderId, sent: false, error: "SES down" })))
    .toEqual([{ reminderId: claimed.reminderId, status: "FAILED" }]);

  const history = await run(listInvoiceReminders(ACC_A, { invoiceId }));
  expect(history.map((row) => [row.kind, row.offsetDays, row.status])).toEqual([["SCHEDULED", 7, "FAILED"]]);
  expect(await run(listInvoiceReminders(ACC_B, { invoiceId }))).toEqual([]);
});

dbTest("invoiceDocument reports the balance due after non-voided payments", async () => {
  const invoiceId = await sentInvoiceDue("2026-02-10", 100);
  await db.query(
    "INSERT INTO payments (account_id, invoice_id, amount, method, reference) VALUES ($1, $2, 30, 'ACH', $3)",
    [ACC_A, invoiceId, `BAL-${invoiceId}`],
  );
  const [doc] = await run(invoiceDocument(ACC_A, { invoiceId }));
  expect(Number(doc.balanceDue)).toBe(70);
});

// --- Review findings: concurrent edits and payment currency -------------------

function positional(req: { statement: string; params: Record<string, unknown> }) {
  return bindLikeDataApi(req);
}

const editInput = (title: string, total: number, extra: Record<string, unknown> = {}) => ({
  date: "2026-03-02", weekNumber: 10, billToName: title, billToAddress: "x", project: "x", grandTotal: total,
  sections: [{ title, total, lineItems: [{ description: title, quantity: 1, amount: total }] }],
  ...extra,
});

dbTest("two overlapping edits never leave a mix of both edits' sections", async () => {
  const created = await createEditableInvoice();
  const [{ version }] = (await db.query("SELECT version FROM invoices WHERE id = $1", [created.invoiceId])).rows;
  const other = new Client({ connectionString: URL });
  await other.connect();
  try {
    await db.query("BEGIN");
    const first = positional(updateInvoiceFull(ACC_A, { invoiceId: created.invoiceId, input: editInput("First", 10, { expectedVersion: version }) }));
    expect((await db.query(first.text, first.values)).rows).toHaveLength(1);

    // The second edit was opened from the same version and blocks on the row lock.
    const second = positional(updateInvoiceFull(ACC_A, { invoiceId: created.invoiceId, input: editInput("Second", 20, { expectedVersion: version }) }));
    const secondResult = other.query(second.text, second.values);
    await new Promise((resolve) => setTimeout(resolve, 200));
    await db.query("COMMIT");
    expect((await secondResult).rows).toHaveLength(0); // stale edit rejected
  } finally {
    await other.end();
  }

  const sections = (await db.query(
    "SELECT title, total FROM invoice_sections WHERE invoice_id = $1 ORDER BY position", [created.invoiceId],
  )).rows;
  const [invoice] = (await db.query("SELECT grand_total, bill_to_name, version FROM invoices WHERE id = $1", [created.invoiceId])).rows;
  expect(sections.map((row) => row.title)).toEqual(["First"]);
  expect(Number(invoice.grand_total)).toBe(10);
  expect(invoice.version).toBe(version + 1);
});

dbTest("an edit opened from an older version is rejected", async () => {
  const created = await createEditableInvoice();
  const [{ version }] = (await db.query("SELECT version FROM invoices WHERE id = $1", [created.invoiceId])).rows;
  expect(await run(updateInvoiceFull(ACC_A, { invoiceId: created.invoiceId, input: editInput("Now", 20, { expectedVersion: version }) }))).toHaveLength(1);
  expect(await run(updateInvoiceFull(ACC_A, { invoiceId: created.invoiceId, input: editInput("Stale", 30, { expectedVersion: version }) }))).toHaveLength(0);
});

dbTest("the currency cannot change once non-voided payments exist", async () => {
  const created = await createEditableInvoice(); // USD, total 20
  const [{ version }] = (await db.query("SELECT version FROM invoices WHERE id = $1", [created.invoiceId])).rows;
  const [payment] = await run(registerPayment(ACC_A, { input: {
    invoiceId: created.invoiceId, amount: 5, method: "ACH", reference: `CUR-${created.invoiceId}`,
  } }));
  expect(payment).toBeTruthy();
  const [{ version: afterPayment }] = (await db.query("SELECT version FROM invoices WHERE id = $1", [created.invoiceId])).rows;
  expect(afterPayment).toBe(version + 1); // a payment invalidates edits opened before it

  const toEur = await run(updateInvoiceFull(ACC_A, { invoiceId: created.invoiceId,
    input: editInput("Eur", 20, { currency: "EUR", expectedVersion: afterPayment }) }));
  expect(toEur).toHaveLength(0);
  const sameCurrency = await run(updateInvoiceFull(ACC_A, { invoiceId: created.invoiceId,
    input: editInput("Usd", 20, { currency: "usd", expectedVersion: afterPayment }) }));
  expect(sameCurrency).toHaveLength(1);

  await db.query("UPDATE payments SET status = 'VOIDED', voided_at = now(), voided_by = 'test', void_reason = 'test' WHERE invoice_id = $1", [created.invoiceId]);
  const [{ version: afterVoid }] = (await db.query("SELECT version FROM invoices WHERE id = $1", [created.invoiceId])).rows;
  expect(await run(updateInvoiceFull(ACC_A, { invoiceId: created.invoiceId,
    input: editInput("Eur", 20, { currency: "EUR", expectedVersion: afterVoid }) }))).toHaveLength(1);
});

dbTest("a payment registered while an edit changes the currency uses the invoice's final currency", async () => {
  const created = await createEditableInvoice();
  const [{ version }] = (await db.query("SELECT version FROM invoices WHERE id = $1", [created.invoiceId])).rows;
  const other = new Client({ connectionString: URL });
  await other.connect();
  try {
    await db.query("BEGIN");
    const edit = positional(updateInvoiceFull(ACC_A, { invoiceId: created.invoiceId,
      input: editInput("Eur", 20, { currency: "EUR", expectedVersion: version }) }));
    expect((await db.query(edit.text, edit.values)).rows).toHaveLength(1);
    const pay = positional(registerPayment(ACC_A, { input: {
      invoiceId: created.invoiceId, amount: 5, currency: "USD", method: "ACH", reference: `RACE-${created.invoiceId}`,
    } }));
    const payResult = other.query(pay.text, pay.values);
    await new Promise((resolve) => setTimeout(resolve, 200));
    await db.query("COMMIT");
    expect((await payResult).rows).toHaveLength(0); // the USD payment no longer matches a EUR invoice
  } finally {
    await other.end();
  }
});

dbTest("invoiceDocument reports the client's current email and the account's reminder opt-in", async () => {
  const invoiceId = await sentInvoiceDue("2026-02-10", 100);
  await db.query("UPDATE clients SET email = '  ahora@cliente-a.example ' WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001'");
  await run(putReminderSettings(ACC_A, { input: { enabled: false, offsets: [0] } }));
  const [before] = await run(invoiceDocument(ACC_A, { invoiceId }));
  expect(before).toMatchObject({ clientEmail: "ahora@cliente-a.example", remindersEnabled: false });

  await run(putReminderSettings(ACC_A, { input: { enabled: true, offsets: [0] } }));
  await db.query("UPDATE invoices SET client_id = NULL WHERE id = $1", [invoiceId]);
  const [after] = await run(invoiceDocument(ACC_A, { invoiceId }));
  expect(after).toMatchObject({ clientEmail: null, remindersEnabled: true });
});
