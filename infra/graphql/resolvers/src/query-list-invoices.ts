import { util } from "@aws-appsync/utils";
import { toJsonObject } from "@aws-appsync/utils/rds";
import { DEFAULT_PAGE_SIZE, decodePageToken, listInvoices, nextPageToken } from "./lib/sql-builders";

export function request(ctx: any) {
  const acc = ctx.identity.claims["custom:accountId"];
  if (!acc) util.unauthorized();
  const offset = decodePageToken(ctx.args.nextToken);
  if (offset === null) util.error("Invalid pagination token", "BadRequest");
  const { statement, params } = listInvoices(acc, {
    status: ctx.args.status,
    limit: ctx.args.limit,
    offset: offset as number,
  });
  const variableMap: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    variableMap[`:${k}`] = v;
  }
  return { statements: [statement], variableMap, variableTypeHintMap: {} };
}

export function response(ctx: any) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);
  const items = toJsonObject(ctx.result)[0] ?? [];
  const offset = decodePageToken(ctx.args.nextToken) ?? 0;
  const limit = ctx.args.limit ?? DEFAULT_PAGE_SIZE;
  return { items, nextToken: nextPageToken(offset, limit, items.length) };
}
