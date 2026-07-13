import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BeginTransactionCommand,
  CommitTransactionCommand,
  ExecuteStatementCommand,
  RDSDataClient,
  RollbackTransactionCommand,
  type SqlParameter,
} from "@aws-sdk/client-rds-data";
import { splitSqlStatements } from "./sql-split.js";

const { DB_CLUSTER_ARN, DB_SECRET_ARN, DB_NAME = "app_finances" } = process.env;
if (!DB_CLUSTER_ARN || !DB_SECRET_ARN) throw new Error("DB_CLUSTER_ARN and DB_SECRET_ARN are required");

const client = new RDSDataClient({});
const dir = join(__dirname, "..", "..", "db", "migrations");

async function exec(sql: string, transactionId?: string, parameters?: SqlParameter[]) {
  return client.send(new ExecuteStatementCommand({
    resourceArn: DB_CLUSTER_ARN,
    secretArn: DB_SECRET_ARN,
    database: DB_NAME,
    sql,
    transactionId,
    parameters,
  }));
}

async function main() {
  await exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);

  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    const version = f.replace(/\.sql$/, "");
    const transaction = await client.send(new BeginTransactionCommand({
      resourceArn: DB_CLUSTER_ARN,
      secretArn: DB_SECRET_ARN,
      database: DB_NAME,
    }));
    const transactionId = transaction.transactionId;
    if (!transactionId) throw new Error(`Aurora did not return a transaction id for ${f}`);

    try {
      await exec(
        "SELECT pg_advisory_xact_lock(hashtext('app_finances_schema_migrations'))",
        transactionId,
      );
      const existing = await exec(
        "SELECT 1 FROM schema_migrations WHERE version = :version",
        transactionId,
        [{ name: "version", value: { stringValue: version } }],
      );
      if (existing.records?.length) {
        await client.send(new CommitTransactionCommand({
          resourceArn: DB_CLUSTER_ARN,
          secretArn: DB_SECRET_ARN,
          transactionId,
        }));
        console.log(`skipped ${f}`);
        continue;
      }

      const sql = readFileSync(join(dir, f), "utf8");
      for (const stmt of splitSqlStatements(sql)) {
        await exec(stmt, transactionId);
      }
      await exec(
        "INSERT INTO schema_migrations (version) VALUES (:version)",
        transactionId,
        [{ name: "version", value: { stringValue: version } }],
      );
      await client.send(new CommitTransactionCommand({
        resourceArn: DB_CLUSTER_ARN,
        secretArn: DB_SECRET_ARN,
        transactionId,
      }));
      console.log(`applied ${f}`);
    } catch (error) {
      await client.send(new RollbackTransactionCommand({
        resourceArn: DB_CLUSTER_ARN,
        secretArn: DB_SECRET_ARN,
        transactionId,
      })).catch(() => undefined);
      throw error;
    }
  }
}

main().then(() => console.log("done")).catch((e) => { console.error(e); process.exitCode = 1; });
