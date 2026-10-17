import { util } from "@aws-appsync/utils";
import { toJsonObject } from "@aws-appsync/utils/rds";
import {
  putCalendarEvent,
  putContact,
  putOpportunity,
  putProject,
  putTask,
} from "./lib/crm-sql-builders";

const builders: Record<string, (acc: string, args: any, userId: string) => any> = {
  putContact,
  putOpportunity,
  putProject,
  putTask,
  putCalendarEvent,
};

export function request(ctx: any) {
  const acc = ctx.identity?.claims?.["custom:accountId"];
  const userId = ctx.identity?.sub ?? ctx.identity?.claims?.sub ?? ctx.identity?.claims?.["cognito:username"];
  if (!acc || !userId) util.unauthorized();
  const builder = builders[ctx.info.fieldName];
  if (!builder) util.error(`Unsupported CRM put mutation: ${ctx.info.fieldName}`, "ResolverConfigurationError");
  const { statement, params } = builder(acc, ctx.args, userId);
  const variableMap: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) variableMap[`:${key}`] = value;
  return { statements: [statement], variableMap, variableTypeHintMap: {} };
}

export function response(ctx: any) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);
  const row = toJsonObject(ctx.result)[0]?.[0] ?? null;
  if (!row) util.error("CRM entity could not be saved", "InvalidCrmInput");
  return row;
}
