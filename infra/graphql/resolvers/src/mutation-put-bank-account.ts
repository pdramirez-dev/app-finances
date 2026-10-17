import { util } from "@aws-appsync/utils";
import { toJsonObject } from "@aws-appsync/utils/rds";
import { invalidMaskedBankFields, putBankAccount } from "./lib/sql-builders";

export function request(ctx: any) {
  const acc = ctx.identity.claims["custom:accountId"];
  if (!acc) util.unauthorized();
  if (invalidMaskedBankFields(ctx.args.input ?? {}).length > 0) {
    util.error("Bank identifiers must be masked and expose only their final characters", "InvalidBankAccountInput");
  }
  const { statement, params } = putBankAccount(acc, ctx.args);
  const variableMap: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    variableMap[`:${k}`] = v;
  }
  return { statements: [statement], variableMap, variableTypeHintMap: {} };
}

export function response(ctx: any) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);
  return toJsonObject(ctx.result)[0]?.[0] ?? null;
}
