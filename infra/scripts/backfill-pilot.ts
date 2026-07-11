import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import {
  ExecuteStatementCommand,
  type Field,
  type SqlParameter,
  RDSDataClient,
} from "@aws-sdk/client-rds-data";

const {
  AWS_REGION,
  DB_CLUSTER_ARN,
  DB_SECRET_ARN,
  DB_NAME = "app_finances",
  PILOT_ACCOUNT_ID,
  PILOT_ACCOUNT_NAME = "Cuenta piloto",
  STAGE = "dev",
} = process.env;

if (!DB_CLUSTER_ARN || !DB_SECRET_ARN || !PILOT_ACCOUNT_ID) {
  throw new Error("DB_CLUSTER_ARN, DB_SECRET_ARN and PILOT_ACCOUNT_ID are required");
}

type LegacyItem = Record<string, unknown>;

const prefix = `app-finances-${STAGE}`;
const sourceTables = {
  clients: process.env.SOURCE_CLIENTS_TABLE ?? `${prefix}-clients`,
  bankAccounts: process.env.SOURCE_BANK_ACCOUNTS_TABLE ?? `${prefix}-bank-accounts`,
  invoices: process.env.SOURCE_INVOICES_TABLE ?? `${prefix}-invoices`,
  sections: process.env.SOURCE_INVOICE_SECTIONS_TABLE ?? `${prefix}-invoice-sections`,
  lineItems: process.env.SOURCE_INVOICE_LINE_ITEMS_TABLE ?? `${prefix}-invoice-line-items`,
};

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: AWS_REGION }));
const rds = new RDSDataClient({ region: AWS_REGION });

function string(item: LegacyItem, key: string, fallback = "") {
  const value = item[key];
  return value === null || value === undefined ? fallback : String(value);
}

function number(item: LegacyItem, key: string, fallback = 0) {
  const value = Number(item[key]);
  return Number.isFinite(value) ? value : fallback;
}

function masked(item: LegacyItem, key: string, maxVisible = 4) {
  const value = item[key];
  if (value === null || value === undefined || value === "") return null;
  const normalized = String(value).trim();
  const visible = normalized.replace(/[*xX•\s.-]/g, "");
  if (!/[*xX•]/.test(normalized) || visible.length > maxVisible) {
    throw new Error(`${key} contains an unmasked bank identifier; manual review is required`);
  }
  return normalized;
}

function parameter(name: string, value: unknown, typeHint?: SqlParameter["typeHint"]): SqlParameter {
  if (value === null || value === undefined || value === "") {
    return { name, value: { isNull: true }, typeHint };
  }

  if (typeof value === "number") {
    return {
      name,
      value: Number.isInteger(value) ? { longValue: value } : { doubleValue: value },
      typeHint,
    };
  }

  return { name, value: { stringValue: String(value) }, typeHint };
}

async function execute(sql: string, parameters: SqlParameter[] = []) {
  return rds.send(new ExecuteStatementCommand({
    resourceArn: DB_CLUSTER_ARN,
    secretArn: DB_SECRET_ARN,
    database: DB_NAME,
    sql,
    parameters,
  }));
}

async function scanAll(tableName: string): Promise<LegacyItem[]> {
  const items: LegacyItem[] = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;

  do {
    const result = await ddb.send(new ScanCommand({ TableName: tableName, ExclusiveStartKey: exclusiveStartKey }));
    items.push(...(result.Items ?? []));
    exclusiveStartKey = result.LastEvaluatedKey;
  } while (exclusiveStartKey);

  return items;
}

function fieldNumber(field: Field | undefined) {
  if (!field) return 0;
  if (typeof field.longValue === "number") return field.longValue;
  if (typeof field.stringValue === "string") return Number(field.stringValue);
  return 0;
}

async function main() {
  const [clients, bankAccounts, invoices, sections, lineItems] = await Promise.all([
    scanAll(sourceTables.clients),
    scanAll(sourceTables.bankAccounts),
    scanAll(sourceTables.invoices),
    scanAll(sourceTables.sections),
    scanAll(sourceTables.lineItems),
  ]);

  await execute(
    `INSERT INTO accounts (id, type, display_name)
     VALUES (:id, 'COMPANY'::account_type, :name)
     ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name, updated_at = now()`,
    [parameter("id", PILOT_ACCOUNT_ID, "UUID"), parameter("name", PILOT_ACCOUNT_NAME)],
  );

  for (const item of clients) {
    await execute(
      `INSERT INTO clients (id, account_id, name, email, phone, address, tax_id, created_at, updated_at)
       VALUES (:id, :acc, :name, :email, :phone, :address, :tax, COALESCE(:created, now()), COALESCE(:updated, now()))
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email,
         phone = EXCLUDED.phone, address = EXCLUDED.address, tax_id = EXCLUDED.tax_id, updated_at = EXCLUDED.updated_at
       WHERE clients.account_id = EXCLUDED.account_id`,
      [
        parameter("id", string(item, "clientId"), "UUID"),
        parameter("acc", PILOT_ACCOUNT_ID, "UUID"),
        parameter("name", string(item, "name", "Cliente migrado")),
        parameter("email", item.email),
        parameter("phone", item.phone),
        parameter("address", item.address),
        parameter("tax", item.taxId),
        parameter("created", item.createdAt, "TIMESTAMP"),
        parameter("updated", item.updatedAt, "TIMESTAMP"),
      ],
    );
  }

  for (const item of bankAccounts) {
    await execute(
      `INSERT INTO bank_accounts (id, account_id, beneficiary_name, bank_name, account_number_masked,
         routing_number_masked, iban_masked, swift_code, currency, country, created_at, updated_at)
       VALUES (:id, :acc, :beneficiary, :bank, :accountMasked, :routingMasked, :ibanMasked,
         :swift, :currency, :country, COALESCE(:created, now()), COALESCE(:updated, now()))
       ON CONFLICT (id) DO UPDATE SET beneficiary_name = EXCLUDED.beneficiary_name,
         bank_name = EXCLUDED.bank_name, account_number_masked = EXCLUDED.account_number_masked,
         routing_number_masked = EXCLUDED.routing_number_masked, iban_masked = EXCLUDED.iban_masked,
         swift_code = EXCLUDED.swift_code, currency = EXCLUDED.currency, country = EXCLUDED.country,
         updated_at = EXCLUDED.updated_at WHERE bank_accounts.account_id = EXCLUDED.account_id`,
      [
        parameter("id", string(item, "bankAccountId"), "UUID"),
        parameter("acc", PILOT_ACCOUNT_ID, "UUID"),
        parameter("beneficiary", string(item, "beneficiaryName", "Titular migrado")),
        parameter("bank", string(item, "bankName", "Banco migrado")),
        parameter("accountMasked", masked(item, "accountNumberMasked")),
        parameter("routingMasked", masked(item, "routingNumberMasked")),
        parameter("ibanMasked", masked(item, "ibanMasked", 6)),
        parameter("swift", item.swiftCode),
        parameter("currency", string(item, "currency", "USD")),
        parameter("country", item.country),
        parameter("created", item.createdAt, "TIMESTAMP"),
        parameter("updated", item.updatedAt, "TIMESTAMP"),
      ],
    );
  }

  for (const item of invoices) {
    await execute(
      `INSERT INTO invoices (id, account_id, client_id, invoice_number, date, week_number,
         bill_to_name, bill_to_address, project, currency, notes, grand_total, status, created_at, updated_at)
       VALUES (:id, :acc, :client, :num, :date, :week, :billName, :billAddress, :project, :currency,
         :notes, :total, CAST(:status AS invoice_status), COALESCE(:created, now()), COALESCE(:updated, now()))
       ON CONFLICT (id) DO UPDATE SET client_id = EXCLUDED.client_id, invoice_number = EXCLUDED.invoice_number,
         date = EXCLUDED.date, week_number = EXCLUDED.week_number, bill_to_name = EXCLUDED.bill_to_name,
         bill_to_address = EXCLUDED.bill_to_address, project = EXCLUDED.project, currency = EXCLUDED.currency,
         notes = EXCLUDED.notes, grand_total = EXCLUDED.grand_total, status = EXCLUDED.status,
         updated_at = EXCLUDED.updated_at WHERE invoices.account_id = EXCLUDED.account_id`,
      [
        parameter("id", string(item, "invoiceId"), "UUID"),
        parameter("acc", PILOT_ACCOUNT_ID, "UUID"),
        parameter("client", item.clientId, "UUID"),
        parameter("num", number(item, "invoiceNumber")),
        parameter("date", string(item, "date"), "DATE"),
        parameter("week", number(item, "weekNumber", 1)),
        parameter("billName", string(item, "billToName", "Cliente migrado")),
        parameter("billAddress", string(item, "billToAddress", "Sin dirección")),
        parameter("project", string(item, "project", "Migración")),
        parameter("currency", string(item, "currency", "USD")),
        parameter("notes", item.notes),
        parameter("total", number(item, "grandTotal")),
        parameter("status", string(item, "status", "DRAFT")),
        parameter("created", item.createdAt, "TIMESTAMP"),
        parameter("updated", item.updatedAt, "TIMESTAMP"),
      ],
    );
  }

  for (const item of sections) {
    await execute(
      `INSERT INTO invoice_sections (id, invoice_id, title, position, total)
       VALUES (:id, :invoice, :title, :position, :total)
       ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, position = EXCLUDED.position,
         total = EXCLUDED.total WHERE invoice_sections.invoice_id = EXCLUDED.invoice_id`,
      [
        parameter("id", string(item, "sectionId"), "UUID"),
        parameter("invoice", string(item, "invoiceId"), "UUID"),
        parameter("title", string(item, "title", "Sección migrada")),
        parameter("position", number(item, "position")),
        parameter("total", number(item, "total")),
      ],
    );
  }

  for (const item of lineItems) {
    await execute(
      `INSERT INTO invoice_line_items (id, section_id, description, quantity, amount, position)
       VALUES (:id, :section, :description, :quantity, :amount, :position)
       ON CONFLICT (id) DO UPDATE SET description = EXCLUDED.description, quantity = EXCLUDED.quantity,
         amount = EXCLUDED.amount, position = EXCLUDED.position
         WHERE invoice_line_items.section_id = EXCLUDED.section_id`,
      [
        parameter("id", string(item, "lineItemId"), "UUID"),
        parameter("section", string(item, "sectionId"), "UUID"),
        parameter("description", string(item, "description", "Item migrado")),
        parameter("quantity", number(item, "quantity")),
        parameter("amount", number(item, "amount")),
        parameter("position", number(item, "position")),
      ],
    );
  }

  await execute(
    `INSERT INTO invoice_counters (account_id, last_invoice_number)
     SELECT :acc, COALESCE(MAX(invoice_number), 0) FROM invoices WHERE account_id = :acc
     ON CONFLICT (account_id) DO UPDATE SET last_invoice_number = EXCLUDED.last_invoice_number`,
    [parameter("acc", PILOT_ACCOUNT_ID, "UUID")],
  );

  const counts = await execute(
    `SELECT
       (SELECT count(*) FROM invoices WHERE account_id = :acc) AS invoices,
       (SELECT count(*) FROM invoice_sections s JOIN invoices i ON i.id = s.invoice_id WHERE i.account_id = :acc) AS sections,
       (SELECT count(*) FROM invoice_line_items l JOIN invoice_sections s ON s.id = l.section_id
          JOIN invoices i ON i.id = s.invoice_id WHERE i.account_id = :acc) AS line_items`,
    [parameter("acc", PILOT_ACCOUNT_ID, "UUID")],
  );

  const actual = counts.records?.[0] ?? [];
  const expected = [invoices.length, sections.length, lineItems.length];
  const names = ["invoices", "sections", "line items"];

  for (let index = 0; index < expected.length; index += 1) {
    const received = fieldNumber(actual[index]);
    console.log(`${names[index]}: DynamoDB=${expected[index]} Postgres=${received}`);
    if (received !== expected[index]) {
      throw new Error(`Backfill mismatch for ${names[index]}`);
    }
  }

  console.log("Backfill verified successfully");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
