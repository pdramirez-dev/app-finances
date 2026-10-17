import { util } from "@aws-appsync/utils";
import { toJsonObject } from "@aws-appsync/utils/rds";
import {
  putBankMovement,
  reconcilePayment,
  registerPayment,
  setContactFavorite,
  setTaskCompleted,
  undoReconciliation,
  updateOpportunityStage,
  updateProjectStatus,
  voidPayment,
} from "./lib/crm-sql-builders";
import { sqlVariables } from "./lib/sql-params";

const builders: Record<string, (acc: string, args: any, userId: string) => any> = {
  setContactFavorite,
  updateOpportunityStage,
  updateProjectStatus,
  setTaskCompleted,
  registerPayment,
  voidPayment,
  putBankMovement,
  reconcilePayment,
  undoReconciliation,
};

export function request(ctx: any) {
  const acc = ctx.identity?.claims?.["custom:accountId"];
  const userId = ctx.identity?.sub ?? ctx.identity?.claims?.sub ?? ctx.identity?.claims?.["cognito:username"];
  if (!acc || !userId) util.unauthorized();
  const builder = builders[ctx.info.fieldName];
  if (!builder) util.error(`Unsupported CRM action mutation: ${ctx.info.fieldName}`, "ResolverConfigurationError");
  const { statement, params } = builder(acc, ctx.args, userId);
  return { statements: [statement], ...sqlVariables(params) };
}

export function response(ctx: any) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);
  const row = toJsonObject(ctx.result)[0]?.[0] ?? null;
  if (!row) util.error("CRM action could not be completed", "InvalidCrmAction");
  return row;
}
