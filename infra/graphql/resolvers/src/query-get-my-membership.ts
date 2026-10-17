import { util } from "@aws-appsync/utils";
import * as ddb from "@aws-appsync/utils/dynamodb";

export function request(ctx: any) {
  const claims = ctx.identity?.claims ?? {};
  const accountId = claims["custom:accountId"];
  const userId = ctx.identity?.sub ?? claims.sub ?? claims["cognito:username"];

  if (!accountId || !userId) {
    util.unauthorized();
  }

  return ddb.get({ key: { accountId, userId } });
}

export function response(ctx: any) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }

  if (!ctx.result || ctx.result.status !== "ACTIVE") {
    util.unauthorized();
  }

  return ctx.result;
}
