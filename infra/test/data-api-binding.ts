import { sqlTypeHint } from "../graphql/resolvers/src/lib/sql-params";

type SqlRequest = { statement: string; params: Record<string, unknown> };

/**
 * Binds a SqlRequest for node-postgres the way the RDS Data API types it, so
 * integration tests fail where Aurora would: strings arrive as varchar unless
 * the shared hint map makes them uuid/date, integers as bigint, other numbers
 * as double precision, booleans as boolean, nulls untyped (or hinted).
 * Plain `$n` parameters would let PostgreSQL infer uuid/date/enum types and
 * hide missing hints and casts.
 */
export function bindLikeDataApi(request: SqlRequest) {
  const names: string[] = [];
  const text = request.statement.replace(/(?<!:):([A-Za-z][A-Za-z0-9_]*)/g, (_match, name: string) => {
    let index = names.indexOf(name);
    if (index === -1) {
      names.push(name);
      index = names.length - 1;
    }
    const placeholder = `$${index + 1}`;
    const value = request.params[name];
    const hint = sqlTypeHint(name);
    if (hint === "UUID") return `CAST(${placeholder} AS uuid)`;
    if (hint === "DATE") return `CAST(${placeholder} AS date)`;
    if (value === null || value === undefined) return placeholder;
    if (typeof value === "boolean") return `CAST(${placeholder} AS boolean)`;
    if (typeof value === "number") return `CAST(${placeholder} AS ${Number.isInteger(value) ? "bigint" : "double precision"})`;
    return `CAST(${placeholder} AS varchar)`;
  });
  return { text, values: names.map((name) => request.params[name] ?? null) };
}
