import { util } from "@aws-appsync/utils";
import { toJsonObject } from "@aws-appsync/utils/rds";
import { getAccount } from "./lib/sql-builders";
import { sqlVariables } from "./lib/sql-params";

export function request(ctx: any) {
  const acc = ctx.identity.claims["custom:accountId"];
  if (!acc) util.unauthorized();
  const { statement, params } = getAccount(acc);
  return { statements: [statement], ...sqlVariables(params) };
}

export function response(ctx: any) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);
  return toJsonObject(ctx.result)[0]?.[0] ?? null;
}
