import { util } from "@aws-appsync/utils";
import { toJsonObject } from "@aws-appsync/utils/rds";
import { createInvoiceFull } from "./lib/sql-builders";
import { sqlVariables } from "./lib/sql-params";

export function request(ctx: any) {
  const acc = ctx.identity.claims["custom:accountId"];
  if (!acc) util.unauthorized();
  const { statement, params } = createInvoiceFull(acc, ctx.args);
  return { statements: [statement], ...sqlVariables(params) };
}

export function response(ctx: any) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);
  const invoice = toJsonObject(ctx.result)[0]?.[0] ?? null;
  if (!invoice) {
    util.error("Invoice could not be created", "InvalidInvoiceInput");
  }
  return invoice;
}
