import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { RDSDataClient, ExecuteStatementCommand } from "@aws-sdk/client-rds-data";

const { DB_CLUSTER_ARN, DB_SECRET_ARN, DB_NAME = "app_finances" } = process.env;
if (!DB_CLUSTER_ARN || !DB_SECRET_ARN) throw new Error("DB_CLUSTER_ARN and DB_SECRET_ARN are required");

const client = new RDSDataClient({});
const dir = join(__dirname, "..", "..", "db", "migrations");

async function exec(sql: string) {
  await client.send(new ExecuteStatementCommand({
    resourceArn: DB_CLUSTER_ARN, secretArn: DB_SECRET_ARN, database: DB_NAME, sql,
  }));
}

async function main() {
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    const sql = readFileSync(join(dir, f), "utf8");
    for (const stmt of sql.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean)) {
      await exec(stmt);
    }
    console.log(`applied ${f}`);
  }
}

main().then(() => console.log("done"));
