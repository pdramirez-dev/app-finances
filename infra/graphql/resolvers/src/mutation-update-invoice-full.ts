import { util } from "@aws-appsync/utils";
import { toJsonObject } from "@aws-appsync/utils/rds";
import { updateInvoiceFull } from "./lib/sql-builders";

export function request(ctx: any) {
  const acc = ctx.identity.claims["custom:accountId"];
  if (!acc) util.unauthorized();
  const { statement, params } = updateInvoiceFull(acc, ctx.args);
  const variableMap: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    variableMap[`:${k}`] = v;
  }
  return { statements: [statement], variableMap, variableTypeHintMap: {} };
}

export function response(ctx: any) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);
  const invoice = toJsonObject(ctx.result)[0]?.[0] ?? null;
  if (!invoice) {
    util.error("Invoice not editable: not found, changed since it was opened (version), already paid, total below payments, currency fixed by payments, or client not in this account", "InvoiceNotEditable");
  }
  return invoice;
}
