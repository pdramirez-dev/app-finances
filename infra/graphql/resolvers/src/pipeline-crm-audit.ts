import { util } from "@aws-appsync/utils";
import type { AuditMetadata } from "./lib/audit";

const metadata: Record<string, AuditMetadata> = {
  putContact: { action: "UPSERT", entityType: "CONTACT", entityIdField: "contactId" },
  deleteContact: { action: "DELETE", entityType: "CONTACT", entityIdField: "contactId" },
  setContactFavorite: { action: "UPDATE", entityType: "CONTACT", entityIdField: "contactId" },
  putOpportunity: { action: "UPSERT", entityType: "OPPORTUNITY", entityIdField: "opportunityId" },
  deleteOpportunity: { action: "DELETE", entityType: "OPPORTUNITY", entityIdField: "opportunityId" },
  updateOpportunityStage: { action: "STAGE_CHANGE", entityType: "OPPORTUNITY", entityIdField: "opportunityId" },
  putProject: { action: "UPSERT", entityType: "PROJECT", entityIdField: "projectId" },
  deleteProject: { action: "DELETE", entityType: "PROJECT", entityIdField: "projectId" },
  updateProjectStatus: { action: "STATUS_CHANGE", entityType: "PROJECT", entityIdField: "projectId" },
  putTask: { action: "UPSERT", entityType: "TASK", entityIdField: "taskId" },
  deleteTask: { action: "DELETE", entityType: "TASK", entityIdField: "taskId" },
  setTaskCompleted: { action: "COMPLETE", entityType: "TASK", entityIdField: "taskId" },
  putCalendarEvent: { action: "UPSERT", entityType: "CALENDAR_EVENT", entityIdField: "eventId" },
  deleteCalendarEvent: { action: "DELETE", entityType: "CALENDAR_EVENT", entityIdField: "eventId" },
  registerPayment: { action: "CREATE", entityType: "PAYMENT", entityIdField: "paymentId" },
  voidPayment: { action: "VOID", entityType: "PAYMENT", entityIdField: "paymentId" },
  putBankMovement: { action: "UPSERT", entityType: "BANK_MOVEMENT", entityIdField: "movementId" },
  reconcilePayment: { action: "RECONCILE", entityType: "PAYMENT", entityIdField: "paymentId" },
  undoReconciliation: { action: "UNRECONCILE", entityType: "PAYMENT", entityIdField: "paymentId" },
};

export function request(ctx: any) {
  const audit = metadata[ctx.info.fieldName];
  if (!audit) util.error(`Missing CRM audit metadata for ${ctx.info.fieldName}`, "AuditConfigurationError");
  ctx.stash.audit = audit;
  return {};
}

export function response(ctx: any) {
  return ctx.prev.result;
}
