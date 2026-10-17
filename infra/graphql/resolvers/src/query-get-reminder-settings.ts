import { util } from "@aws-appsync/utils";
import { toJsonObject } from "@aws-appsync/utils/rds";
import { getReminderSettings } from "./lib/sql-builders";

export function request(ctx: any) {
  const acc = ctx.identity.claims["custom:accountId"];
  if (!acc) util.unauthorized();
  const { statement, params } = getReminderSettings(acc, ctx.args);
  const variableMap: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    variableMap[`:${k}`] = v;
  }
  return { statements: [statement], variableMap, variableTypeHintMap: {} };
}

export function response(ctx: any) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);
  const row = toJsonObject(ctx.result)[0]?.[0];
  if (!row) util.error("Account not found", "AccountNotFound");
  const offsets = row.offsetsCsv ? String(row.offsetsCsv).split(",").map((value: string) => Number(value)) : [];
  return { accountId: row.accountId, enabled: row.enabled, enabledAt: row.enabledAt ?? null, offsets };
}
