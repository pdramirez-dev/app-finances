import { util } from "@aws-appsync/utils";
import * as ddb from "@aws-appsync/utils/dynamodb";

function identityKeys(ctx: any) {
  const claims = ctx.identity?.claims ?? {};
  const accountId = claims["custom:accountId"];
  const userId = ctx.identity?.sub ?? claims.sub ?? claims["cognito:username"];

  if (!accountId || !userId) {
    util.unauthorized();
  }

  return { accountId, userId };
}

export function request(ctx: any) {
  return ddb.get({ key: identityKeys(ctx) });
}

export function response(ctx: any) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }

  const membership = ctx.result;
  if (!membership || membership.status !== "ACTIVE") {
    util.unauthorized();
  }

  const adminOnlyFields = ["putAccount", "putBankAccount", "deleteClient"];
  if (adminOnlyFields.includes(ctx.info?.fieldName) && membership.role === "MEMBER") {
    util.unauthorized();
  }

  ctx.stash.membership = membership;
  return membership;
}
