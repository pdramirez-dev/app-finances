import { join } from "node:path";
import knex, { type Knex } from "knex";
import { SqlMigrationSource } from "./knex-migration-source";

const MIGRATIONS_DIR = join(__dirname, "migrations");
const KNEX_MIGRATIONS_TABLE = "knex_migrations";
const MIGRATION_LOCK = "app_nexo_schema_migrations";

function migrationConfig(source: SqlMigrationSource): Knex.MigratorConfig {
  return {
    migrationSource: source,
    tableName: KNEX_MIGRATIONS_TABLE,
  };
}

function createDatabase(databaseUrl: string): Knex {
  return knex({
    client: "pg",
    connection: databaseUrl,
    // The advisory lock is session-scoped. A single pooled connection keeps
    // it attached to every bootstrap and migration query in this process.
    pool: { min: 0, max: 1 },
  });
}

async function importLegacyHistory(
  db: Knex,
  source: SqlMigrationSource,
): Promise<void> {
  await db.raw(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);

  // currentVersion initializes Knex's migration and lock tables without
  // applying anything. Existing installations only have schema_migrations,
  // so their history is imported once before Knex computes pending files.
  await db.migrate.currentVersion(migrationConfig(source));

  const available = new Map(
    (await source.getMigrations()).map((migration) => [migration.version, migration.fileName]),
  );
  const legacyRows = await db("schema_migrations")
    .select<{ version: string; applied_at: Date }[]>("version", "applied_at")
    .orderBy("version");
  const completedRows = await db(KNEX_MIGRATIONS_TABLE).select<{ name: string }[]>("name");
  const completed = new Set(completedRows.map(({ name }) => name));

  for (const migration of legacyRows) {
    const fileName = available.get(migration.version);
    if (!fileName || completed.has(fileName)) continue;
    await db(KNEX_MIGRATIONS_TABLE).insert({
      name: fileName,
      batch: 0,
      migration_time: migration.applied_at,
    });
    completed.add(fileName);
  }
}

export async function runMigrations(databaseUrl: string): Promise<void> {
  const db = createDatabase(databaseUrl);
  const source = new SqlMigrationSource(MIGRATIONS_DIR);
  try {
    await db.raw("SELECT pg_advisory_lock(hashtext(?))", [MIGRATION_LOCK]);
    await importLegacyHistory(db, source);
    await db.migrate.latest(migrationConfig(source));
  } finally {
    await db.raw("SELECT pg_advisory_unlock(hashtext(?))", [MIGRATION_LOCK]).catch(() => undefined);
    await db.destroy();
  }
}

if (require.main === module) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  runMigrations(url)
    .then(() => console.log("migrations applied with Knex"))
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
