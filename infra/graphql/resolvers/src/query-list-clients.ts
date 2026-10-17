import { util } from "@aws-appsync/utils";
import { toJsonObject } from "@aws-appsync/utils/rds";
import { DEFAULT_PAGE_SIZE, decodePageToken, listClients, nextPageToken } from "./lib/sql-builders";
import { sqlVariables } from "./lib/sql-params";

export function request(ctx: any) {
  const acc = ctx.identity.claims["custom:accountId"];
  if (!acc) util.unauthorized();
  const offset = decodePageToken(ctx.args.nextToken);
  if (offset === null) util.error("Invalid pagination token", "BadRequest");
  const { statement, params } = listClients(acc, { limit: ctx.args.limit, offset: offset as number });
  return { statements: [statement], ...sqlVariables(params) };
}

export function response(ctx: any) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);
  const rows = toJsonObject(ctx.result)[0] ?? [];
  const offset = decodePageToken(ctx.args.nextToken) ?? 0;
  const limit = ctx.args.limit ?? DEFAULT_PAGE_SIZE;
  return { items: rows, nextToken: nextPageToken(offset, limit, rows.length) };
}
