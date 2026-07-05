import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { splitSqlStatements } from "./sql-split.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("splitSqlStatements", () => {
  it("splits a simple two-statement string into 2 statements", () => {
    const sql = "SELECT 1;\nSELECT 2;";
    const result = splitSqlStatements(sql);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe("SELECT 1");
    expect(result[1]).toBe("SELECT 2");
  });

  it("keeps a DO $$ ... $$ block as ONE statement (internal semicolons are not split points)", () => {
    const sql = `DO $$ BEGIN
  CREATE TYPE x AS ENUM ('A');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;`;
    const result = splitSqlStatements(sql);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatch(/^DO \$\$/);
    // Must NOT contain a bare EXCEPTION fragment as a separate statement.
    expect(result.some((s) => /^EXCEPTION/.test(s))).toBe(false);
  });

  it("parses 0001_init.sql: both DO $$ blocks remain intact, no bare EXCEPTION fragments", () => {
    const sql = readFileSync(
      join(__dirname, "..", "..", "db", "migrations", "0001_init.sql"),
      "utf8"
    );
    const stmts = splitSqlStatements(sql);

    // Exactly two statements must begin with DO.
    const doStmts = stmts.filter((s) => s.startsWith("DO"));
    expect(doStmts).toHaveLength(2);

    // No statement should be a bare EXCEPTION fragment.
    const exceptionFragments = stmts.filter((s) => /^EXCEPTION/.test(s));
    expect(exceptionFragments).toHaveLength(0);

    // There must be CREATE TABLE statements.
    const createTableStmts = stmts.filter((s) =>
      /^CREATE TABLE/i.test(s)
    );
    expect(createTableStmts.length).toBeGreaterThan(0);

    // There must be CREATE INDEX statements.
    const createIndexStmts = stmts.filter((s) =>
      /^CREATE INDEX/i.test(s)
    );
    expect(createIndexStmts.length).toBeGreaterThan(0);
  });

  it("produces no empty entries for trailing whitespace or empty trailing statement", () => {
    const sql = "SELECT 1;   \n\n   SELECT 2;   \n";
    const result = splitSqlStatements(sql);
    expect(result).toHaveLength(2);
    result.forEach((s) => expect(s.trim()).toBeTruthy());
  });

  it("handles a string with no semicolons (returns it as a single statement)", () => {
    const sql = "SELECT 1";
    const result = splitSqlStatements(sql);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe("SELECT 1");
  });

  it("returns empty array for whitespace-only input", () => {
    expect(splitSqlStatements("   \n   ")).toHaveLength(0);
    expect(splitSqlStatements("")).toHaveLength(0);
  });
});
