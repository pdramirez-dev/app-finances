import { util } from "@aws-appsync/utils";
import { toJsonObject } from "@aws-appsync/utils/rds";
import {
  listBankMovements,
  listCalendarEvents,
  listContacts,
  listOpportunities,
  listPayments,
  listProjects,
  listTasks,
  searchWorkspace,
} from "./lib/crm-sql-builders";
import { DEFAULT_PAGE_SIZE, decodePageToken, nextPageToken } from "./lib/sql-builders";

const builders: Record<string, (acc: string, args: any, userId: string) => any> = {
  listContacts,
  listOpportunities,
  listProjects,
  listTasks,
  listCalendarEvents,
  listPayments,
  listBankMovements,
  searchWorkspace,
};

export function request(ctx: any) {
  const acc = ctx.identity?.claims?.["custom:accountId"];
  const userId = ctx.identity?.sub ?? ctx.identity?.claims?.sub ?? ctx.identity?.claims?.["cognito:username"];
  if (!acc || !userId) util.unauthorized();
  const builder = builders[ctx.info.fieldName];
  if (!builder) util.error(`Unsupported CRM list query: ${ctx.info.fieldName}`, "ResolverConfigurationError");
  const offset = decodePageToken(ctx.args.nextToken);
  if (offset === null) util.error("Invalid pagination token", "BadRequest");
  const { statement, params } = builder(acc, { ...ctx.args, offset }, userId);
  const variableMap: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) variableMap[`:${key}`] = value;
  ctx.stash.pageOffset = offset;
  ctx.stash.pageLimit = params.lim ?? ctx.args.limit ?? DEFAULT_PAGE_SIZE;
  return { statements: [statement], variableMap, variableTypeHintMap: {} };
}

export function response(ctx: any) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);
  const rows = toJsonObject(ctx.result)[0] ?? [];
  const offset = ctx.stash.pageOffset ?? decodePageToken(ctx.args.nextToken) ?? 0;
  const limit = ctx.stash.pageLimit ?? ctx.args.limit ?? DEFAULT_PAGE_SIZE;
  return { items: rows, nextToken: nextPageToken(offset, limit, rows.length) };
}
