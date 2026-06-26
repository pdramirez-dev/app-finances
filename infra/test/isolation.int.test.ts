import { afterAll, beforeAll, expect, test } from "vitest";
import { Client } from "pg";
import { runMigrations } from "../../db/migrate";
import { listClients, getClient, getInvoice } from "../graphql/resolvers/src/lib/sql-builders";

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
  await db.query("DELETE FROM invoice_line_items; DELETE FROM invoice_sections; DELETE FROM invoices; DELETE FROM clients; DELETE FROM accounts;");
  await db.query("INSERT INTO accounts (id, type, display_name) VALUES ('11111111-1111-1111-1111-111111111111','COMPANY','A'),('22222222-2222-2222-2222-222222222222','COMPANY','B')");
  await db.query("INSERT INTO clients (id, account_id, name) VALUES ('aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Cliente A'),('bbbbbbbb-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','Cliente B')");
  await db.query(`INSERT INTO invoices (id, account_id, client_id, invoice_number, date, week_number, bill_to_name, bill_to_address, project, grand_total) VALUES ('cccccccc-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','bbbbbbbb-0000-0000-0000-000000000001',1,'2024-01-01',1,'Cliente B','123 B Street','Project B',1000.00)`);
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
