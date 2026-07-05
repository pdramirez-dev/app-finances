/**
 * Splits a SQL string into individual statements on top-level semicolons only.
 * Text inside dollar-quoted regions (e.g. $$ ... $$ or $tag$ ... $tag$) is
 * treated as opaque — semicolons within those regions are NOT split points.
 *
 * Returned statements are trimmed; empty results are dropped.
 */
export function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let i = 0;
  let dollarTag: string | null = null;

  while (i < sql.length) {
    const ch = sql[i];

    // Attempt to match a dollar-quote tag at the current position.
    if (ch === "$") {
      const rest = sql.slice(i);
      const match = rest.match(/^\$[A-Za-z0-9_]*\$/);
      if (match) {
        const tag = match[0];
        if (dollarTag === null) {
          // Opening a dollar-quoted region.
          dollarTag = tag;
          current += tag;
          i += tag.length;
          continue;
        } else if (tag === dollarTag) {
          // Closing the dollar-quoted region.
          dollarTag = null;
          current += tag;
          i += tag.length;
          continue;
        }
        // A different tag inside a dollar-quoted region — treat as plain text.
      }
    }

    // A semicolon outside any dollar-quoted region is a statement boundary.
    if (ch === ";" && dollarTag === null) {
      const stmt = current.trim();
      if (stmt) {
        statements.push(stmt);
      }
      current = "";
      i++;
      continue;
    }

    current += ch;
    i++;
  }

  // Capture any trailing content after the final semicolon (or a file with no
  // trailing semicolon).
  const remaining = current.trim();
  if (remaining) {
    statements.push(remaining);
  }

  return statements;
}
