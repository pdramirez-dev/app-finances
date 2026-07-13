import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Knex } from "knex";

export type SqlMigration = {
  fileName: string;
  version: string;
};

/**
 * Lets Knex own migration ordering, locking, transactions and bookkeeping
 * while keeping the existing reviewed PostgreSQL migrations as plain SQL.
 */
export class SqlMigrationSource implements Knex.MigrationSource<SqlMigration> {
  constructor(private readonly directory: string) {}

  async getMigrations(): Promise<SqlMigration[]> {
    return (await readdir(this.directory))
      .filter((fileName) => fileName.endsWith(".sql"))
      .sort()
      .map((fileName) => ({
        fileName,
        version: fileName.replace(/\.sql$/, ""),
      }));
  }

  getMigrationName(migration: SqlMigration): string {
    return migration.fileName;
  }

  async getMigration(migration: SqlMigration): Promise<Knex.Migration> {
    const sql = await readFile(join(this.directory, migration.fileName), "utf8");

    return {
      up: async (db) => {
        await db.raw(sql);
        await db("schema_migrations")
          .insert({ version: migration.version })
          .onConflict("version")
          .ignore();
      },
      down: async () => {
        throw new Error(
          `${migration.fileName} is forward-only; create a new SQL migration instead of rolling it back`,
        );
      },
    };
  }
}
