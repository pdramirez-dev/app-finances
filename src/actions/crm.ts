"use server";

import { revalidatePath } from "next/cache";
import { z } from "@/lib/zod";

import {
  putCalendarEvent,
  putContact,
  putProject,
  putTask,
  reconcilePayment,
  registerPayment,
  searchWorkspace,
  setContactFavorite,
  setTaskCompleted,
  updateOpportunityStage,
  updateProjectStatus,
  type CalendarEvent,
  type ContactRecord,
  type CrmTask,
  type PaymentRecord,
  type ProjectRecord,
  type WorkspaceSearchResult,
  type Opportunity,
} from "@/lib/appsync/crm";
import { requireAuth } from "@/lib/require-auth";

export type CrmActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

const optional = z.string().trim().transform((value) => value || undefined);
const entityId = z.string().trim().min(1, "Falta el identificador");

function failure(error: unknown): CrmActionResult<never> {
  if (error instanceof z.ZodError) {
    const fieldErrors = z.flattenError(error).fieldErrors as Record<string, string[]>;
    return { ok: false, error: error.issues[0]?.message ?? "Revisa los datos", fieldErrors };
  }
  return { ok: false, error: error instanceof Error ? error.message : "No se pudo completar la operación" };
}

function refresh(...paths: string[]) {
  for (const path of new Set([...paths, "/dashboard", "/reports"])) revalidatePath(path);
}

const contactSchema = z.object({
  contactId: optional,
  name: z.string().trim().min(2, "Indica el nombre"),
  role: optional,
  company: z.string().trim().min(2, "Indica la empresa"),
  email: z.email("Ingresa un email válido"),
  phone: optional,
  location: optional,
  kind: z.enum(["Cliente", "Lead", "Partner"]),
});

export async function saveContactAction(input: unknown): Promise<CrmActionResult<ContactRecord>> {
  await requireAuth();
  try {
    const contact = await putContact(contactSchema.parse(input));
    refresh("/contacts");
    return { ok: true, data: contact };
  } catch (error) { return failure(error); }
}

export async function setContactFavoriteAction(contactId: string, favorite: boolean): Promise<CrmActionResult<ContactRecord>> {
  await requireAuth();
  try {
    const contact = await setContactFavorite(entityId.parse(contactId), z.boolean().parse(favorite));
    revalidatePath("/contacts");
    return { ok: true, data: contact };
  } catch (error) { return failure(error); }
}

const opportunityStageSchema = z.enum(["lead", "qualified", "proposal", "negotiation", "won"]);

export async function updateOpportunityStageAction(opportunityId: string, stage: string): Promise<CrmActionResult<Opportunity>> {
  await requireAuth();
  try {
    const opportunity = await updateOpportunityStage(entityId.parse(opportunityId), opportunityStageSchema.parse(stage));
    refresh("/pipeline");
    return { ok: true, data: opportunity };
  } catch (error) { return failure(error); }
}

const projectSchema = z.object({
  projectId: optional,
  name: z.string().trim().min(2, "Indica el proyecto"),
  client: z.string().trim().min(2, "Indica el cliente"),
  priority: z.enum(["Alta", "Media", "Baja"]),
  dueDate: z.iso.date("Usa una fecha válida"),
  budget: z.coerce.number().min(0, "El presupuesto no puede ser negativo"),
  description: optional,
});

export async function saveProjectAction(input: unknown): Promise<CrmActionResult<ProjectRecord>> {
  await requireAuth();
  try {
    const project = await putProject(projectSchema.parse(input));
    refresh("/projects");
    return { ok: true, data: project };
  } catch (error) { return failure(error); }
}

const projectStatusSchema = z.enum(["Planificación", "En curso", "En revisión", "Completado"]);

export async function updateProjectStatusAction(projectId: string, status: string): Promise<CrmActionResult<ProjectRecord>> {
  await requireAuth();
  try {
    const project = await updateProjectStatus(entityId.parse(projectId), projectStatusSchema.parse(status));
    refresh("/projects");
    return { ok: true, data: project };
  } catch (error) { return failure(error); }
}

const taskSchema = z.object({
  taskId: optional,
  title: z.string().trim().min(2, "Indica la tarea"),
  description: optional,
  dueDate: z.iso.date("Usa una fecha válida"),
  dueTime: z.union([z.literal(""), z.string().regex(/^\d{2}:\d{2}$/)]).transform((value) => value || undefined),
  priority: z.enum(["Alta", "Media", "Baja"]),
  kind: z.enum(["Llamada", "Correo", "Reunión", "Seguimiento"]),
  relatedTo: optional,
});

export async function saveTaskAction(input: unknown): Promise<CrmActionResult<CrmTask>> {
  await requireAuth();
  try {
    const task = await putTask(taskSchema.parse(input));
    refresh("/tasks", "/calendar");
    return { ok: true, data: task };
  } catch (error) { return failure(error); }
}

export async function setTaskCompletedAction(taskId: string, completed: boolean): Promise<CrmActionResult<CrmTask>> {
  await requireAuth();
  try {
    const task = await setTaskCompleted(entityId.parse(taskId), z.boolean().parse(completed));
    refresh("/tasks");
    return { ok: true, data: task };
  } catch (error) { return failure(error); }
}

const eventSchema = z.object({
  eventId: optional,
  title: z.string().trim().min(2, "Indica el evento"),
  company: z.string().trim().min(2, "Indica la empresa"),
  date: z.iso.date("Usa una fecha válida"),
  start: z.string().regex(/^\d{2}:\d{2}$/, "Usa una hora válida"),
  end: z.string().regex(/^\d{2}:\d{2}$/, "Usa una hora válida"),
  type: z.enum(["Reunión", "Llamada", "Seguimiento", "Entrega"]),
  location: optional,
}).refine((value) => value.end > value.start, { path: ["end"], message: "La hora de fin debe ser posterior al inicio" });

export async function saveCalendarEventAction(input: unknown): Promise<CrmActionResult<CalendarEvent>> {
  await requireAuth();
  try {
    const calendarEvent = await putCalendarEvent(eventSchema.parse(input));
    refresh("/calendar");
    return { ok: true, data: calendarEvent };
  } catch (error) { return failure(error); }
}

const paymentSchema = z.object({
  client: z.string().trim().min(2, "Indica el cliente"),
  invoice: z.string().trim().min(2, "Indica la factura"),
  amount: z.coerce.number().positive("El importe debe ser mayor que cero"),
  method: z.enum(["Transferencia", "Tarjeta", "ACH", "Cheque"]),
  reference: z.string().trim().min(2, "Indica la referencia"),
});

export async function registerPaymentAction(input: unknown): Promise<CrmActionResult<PaymentRecord>> {
  await requireAuth();
  try {
    const payment = await registerPayment(paymentSchema.parse(input));
    refresh("/payments", "/invoices");
    return { ok: true, data: payment };
  } catch (error) { return failure(error); }
}

export async function reconcilePaymentAction(paymentId: string, movementId?: string): Promise<CrmActionResult<PaymentRecord>> {
  await requireAuth();
  try {
    const payment = await reconcilePayment(entityId.parse(paymentId), movementId ? entityId.parse(movementId) : undefined);
    refresh("/payments", "/invoices");
    return { ok: true, data: payment };
  } catch (error) { return failure(error); }
}

export async function searchWorkspaceAction(query: string): Promise<CrmActionResult<WorkspaceSearchResult[]>> {
  await requireAuth();
  try {
    const normalized = z.string().trim().max(120).parse(query);
    const results = await searchWorkspace(normalized, 8);
    return { ok: true, data: results };
  } catch (error) { return failure(error); }
}
