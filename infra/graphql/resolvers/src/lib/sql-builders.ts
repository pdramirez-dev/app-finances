export type SqlRequest = { statement: string; params: Record<string, unknown> };
export function sqlPing() { return "ok"; }
