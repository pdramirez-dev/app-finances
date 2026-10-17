import { util } from "@aws-appsync/utils";
import { toJsonObject } from "@aws-appsync/utils/rds";
import { putInvoiceSeries } from "./lib/sql-builders";

export function request(ctx: any) {
  const acc = ctx.identity.claims["custom:accountId"];
  if (!acc) util.unauthorized();
  const { statement, params } = putInvoiceSeries(acc, ctx.args);
  const variableMap: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    variableMap[`:${k}`] = v;
  }
  return { statements: [statement], variableMap, variableTypeHintMap: {} };
}

export function response(ctx: any) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);
  const series = toJsonObject(ctx.result)[0]?.[0] ?? null;
  if (!series) {
    util.error("Invoice series not found in this account", "InvoiceSeriesNotFound");
  }
  return series;
}
