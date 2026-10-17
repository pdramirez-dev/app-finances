"use server";

import { format } from "date-fns";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "@/lib/zod";

import type { CreateInvoiceFullInput } from "@/lib/appsync/graphql.generated";
import {
  createInvoiceFull,
  deleteInvoice,
  putInvoiceSeries,
  putReminderSettings,
  sendInvoiceEmail,
  sendPaymentReminder,
  updateInvoiceFull,
  updateInvoiceStatus,
} from "@/lib/appsync/invoices";
import { INVOICE_STATUSES } from "@/lib/invoice-types";
import { calculateGrandTotal, calculateSectionTotal } from "@/lib/invoices";
import { type FormState, formValues, zodFailure } from "@/lib/form-state";
import { requireAuth } from "@/lib/require-auth";
import { createInvoiceInputSchema, invoiceSectionsInputSchema } from "@/lib/validations";

export type CreateInvoiceActionState = FormState;

function getFirstErrorMessage(error: z.ZodError) {
  const firstIssue = error.issues.at(0);
  return firstIssue?.message ?? "Revisa los datos del formulario";
}

// Section issues point deep into the JSON (sections.0.items.1.amount); say
// where in words, since those inputs have no field of their own in the state.
function sectionsIssueMessage(error: z.ZodError) {
  const issue = error.issues.at(0);
  if (!issue) return "Revisa las secciones";
  const [sectionIndex, itemsKey, itemIndex] = issue.path;
  const where = [
    typeof sectionIndex === "number" ? `Sección ${sectionIndex + 1}` : null,
    itemsKey === "items" && typeof itemIndex === "number" ? `concepto ${itemIndex + 1}` : null,
  ].filter(Boolean).join(", ");
  return where ? `${where}: ${issue.message}` : issue.message;
}

type ParsedInvoiceForm =
  | { failure: FormState }
  | { input: Omit<CreateInvoiceFullInput, "status"> };

function parseInvoiceForm(formData: FormData): ParsedInvoiceForm {
  const values = formValues(formData);
  delete values.sections;
  const sectionsRaw = formData.get("sections");

  if (typeof sectionsRaw !== "string") {
    return { failure: { error: "La factura necesita al menos una sección", values } };
  }

  let parsedSections: unknown;

  try {
    parsedSections = JSON.parse(sectionsRaw);
  } catch {
    return { failure: { error: "No se pudieron leer las secciones de la factura", values } };
  }

  const sectionsResult = invoiceSectionsInputSchema.safeParse(parsedSections);

  if (!sectionsResult.success) {
    const message = sectionsIssueMessage(sectionsResult.error);
    return { failure: { error: message, fieldErrors: { sections: message }, values } };
  }

  const payloadResult = createInvoiceInputSchema.safeParse({
    clientId: formData.get("clientId"),
    date: formData.get("date"),
    dueDate: formData.get("dueDate"),
    weekNumber: formData.get("weekNumber"),
    billToName: formData.get("billToName"),
    billToAddress: formData.get("billToAddress"),
    project: formData.get("project"),
    notes: formData.get("notes"),
    sections: sectionsResult.data,
  });

  if (!payloadResult.success) {
    return { failure: zodFailure(payloadResult.error, values) };
  }

  const payload = payloadResult.data;

  return {
    input: {
      clientId: payload.clientId,
      date: format(payload.date, "yyyy-MM-dd"),
      dueDate: format(payload.dueDate, "yyyy-MM-dd"),
      weekNumber: payload.weekNumber,
      billToName: payload.billToName,
      billToAddress: payload.billToAddress,
      project: payload.project,
      notes: payload.notes,
      grandTotal: calculateGrandTotal(payload.sections),
      sections: payload.sections.map((section) => ({
        title: section.title,
        total: calculateSectionTotal(section),
        lineItems: section.items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          amount: item.amount,
        })),
      })),
    },
  };
}

export async function createInvoiceAction(
  _previousState: CreateInvoiceActionState,
  formData: FormData,
): Promise<CreateInvoiceActionState> {
  await requireAuth();

  const parsed = parseInvoiceForm(formData);

  if ("failure" in parsed) {
    return parsed.failure;
  }

  const seriesId = z.union([z.literal(""), z.string().uuid()]).safeParse(formData.get("seriesId") ?? "");

  if (!seriesId.success) {
    return { error: "Selecciona una serie válida", fieldErrors: { seriesId: "Selecciona una serie válida" }, values: formValues(formData) };
  }

  let createdInvoice: Awaited<ReturnType<typeof createInvoiceFull>>;

  try {
    createdInvoice = await createInvoiceFull({
      ...parsed.input,
      seriesId: seriesId.data || undefined,
      status: "DRAFT",
    });
  } catch {
    return { error: "No se pudo crear la factura. Verifica que la serie siga activa e inténtalo de nuevo.", values: formValues(formData) };
  }

  revalidatePath("/invoices");
  redirect(`/invoices/${createdInvoice.invoiceId}`);
}

export async function updateInvoiceAction(
  invoiceId: string,
  _previousState: CreateInvoiceActionState,
  formData: FormData,
): Promise<CreateInvoiceActionState> {
  await requireAuth();

  const parsed = parseInvoiceForm(formData);

  if ("failure" in parsed) {
    return parsed.failure;
  }

  try {
    await updateInvoiceFull(invoiceId, parsed.input);
  } catch {
    return { error: "No se pudo guardar la factura. Verifica que no esté pagada e inténtalo de nuevo.", values: formValues(formData) };
  }

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  redirect(`/invoices/${invoiceId}`);
}

const invoiceStatusSchema = z.enum(INVOICE_STATUSES);

export async function updateInvoiceStatusAction(formData: FormData) {
  await requireAuth();

  const result = z
    .object({
      invoiceId: z.string().min(1),
      status: invoiceStatusSchema,
    })
    .safeParse({
      invoiceId: formData.get("invoiceId"),
      status: formData.get("status"),
    });

  if (!result.success) {
    return;
  }

  await updateInvoiceStatus(result.data.invoiceId, result.data.status);

  revalidatePath(`/invoices/${result.data.invoiceId}`);
  revalidatePath("/invoices");
}

export async function deleteInvoiceAction(formData: FormData) {
  await requireAuth();

  const invoiceId = formData.get("invoiceId");

  if (typeof invoiceId !== "string" || invoiceId.length === 0) {
    return;
  }

  // Sections and line items are removed by the database via ON DELETE CASCADE.
  await deleteInvoice(invoiceId);

  revalidatePath("/invoices");
  redirect("/invoices");
}

export type InvoiceSeriesFormState = {
  error?: string;
  success?: string;
  values?: Record<string, string>;
};

const checkbox = z.union([z.literal("on"), z.literal("")]).optional().transform((value) => value === "on");

const invoiceSeriesSchema = z.object({
  seriesId: z.union([z.literal(""), z.string().uuid()]).optional().transform((value) => value || undefined),
  code: z.string().trim().toUpperCase().optional(),
  name: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres").max(80, "El nombre es demasiado largo"),
  startNumber: z.union([z.literal(""), z.coerce.number().int("El número inicial debe ser entero")
    .min(1, "El número inicial debe ser 1 o mayor").max(99_999_999, "El número inicial es demasiado grande")])
    .optional()
    .transform((value) => (value === "" || value === undefined ? 1 : value)),
  isDefault: checkbox,
  archived: checkbox,
}).superRefine((value, context) => {
  if (!value.seriesId && !/^[A-Z0-9][A-Z0-9-]{0,11}$/.test(value.code ?? "")) {
    context.addIssue({
      code: "custom",
      path: ["code"],
      message: "El código debe tener de 1 a 12 caracteres: letras, números o guiones, empezando por letra o número",
    });
  }
});

function invoiceSeriesErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/invoice_series_account_code_unique|ya existe/i.test(message)) return "Ya existe una serie con ese código";
  if (/unauthorized|not authorized/i.test(message)) return "Solo los administradores pueden gestionar las series";
  return "No se pudo guardar la serie";
}

export async function saveInvoiceSeriesAction(
  _previousState: InvoiceSeriesFormState,
  formData: FormData,
): Promise<InvoiceSeriesFormState> {
  await requireAuth();

  const result = invoiceSeriesSchema.safeParse({
    seriesId: formData.get("seriesId") ?? "",
    code: formData.get("code") ?? undefined,
    name: formData.get("name"),
    startNumber: formData.get("startNumber") ?? "",
    isDefault: formData.get("isDefault") ?? "",
    archived: formData.get("archived") ?? "",
  });

  if (!result.success) {
    return { error: getFirstErrorMessage(result.error), values: formValues(formData) };
  }

  const { seriesId, code, name, startNumber, isDefault, archived } = result.data;

  try {
    await putInvoiceSeries(seriesId
      ? { seriesId, name, isDefault, archived }
      : { code, name, startNumber, isDefault });
  } catch (error) {
    return { error: invoiceSeriesErrorMessage(error), values: formValues(formData) };
  }

  revalidatePath("/settings/invoice-series");
  revalidatePath("/invoices/new");
  return { success: seriesId ? "Serie actualizada" : "Serie creada" };
}

export type SendInvoiceEmailFormState = {
  error?: string;
  success?: string;
  warning?: string;
  values?: Record<string, string>;
};

const sendInvoiceEmailSchema = z.object({
  to: z.string().trim().email("Indica un email de destino válido"),
  message: z.string().trim().max(2000, "El mensaje no puede superar 2000 caracteres").optional()
    .transform((value) => value || undefined),
});

function sendInvoiceEmailErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/not verified|sandbox/i.test(message)) {
    return "SES rechazó el envío: el remitente o el destinatario no está verificado (la cuenta puede seguir en modo sandbox).";
  }
  if (/unauthorized|not authorized/i.test(message)) return "No tienes permiso para enviar facturas de esta cuenta";
  // Messages raised by the send Lambda are already written for the user.
  if (/configurado|destino|mensaje|no encontrada|inválida/i.test(message)) return message;
  return "No se pudo enviar la factura. Inténtalo de nuevo.";
}

async function deliverFromForm(
  invoiceId: string,
  formData: FormData,
  deliver: typeof sendInvoiceEmail,
  successLabel: string,
): Promise<SendInvoiceEmailFormState> {
  await requireAuth();

  const result = sendInvoiceEmailSchema.safeParse({
    to: formData.get("to"),
    message: formData.get("message") ?? undefined,
  });

  if (!result.success) {
    return { error: getFirstErrorMessage(result.error), values: formValues(formData) };
  }

  let sent: Awaited<ReturnType<typeof sendInvoiceEmail>>;

  try {
    sent = await deliver({ invoiceId, to: result.data.to, message: result.data.message });
  } catch (error) {
    return { error: sendInvoiceEmailErrorMessage(error), values: formValues(formData) };
  }

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");

  const expires = new Intl.DateTimeFormat("es", { dateStyle: "long", timeZone: "UTC" }).format(new Date(sent.linkExpiresAt));
  return {
    success: `${successLabel} a ${sent.sentTo}. El enlace de descarga es válido hasta el ${expires}.`,
    warning: sent.warning ?? undefined,
  };
}

export async function sendInvoiceEmailAction(
  invoiceId: string,
  _previousState: SendInvoiceEmailFormState,
  formData: FormData,
): Promise<SendInvoiceEmailFormState> {
  return deliverFromForm(invoiceId, formData, sendInvoiceEmail, "Factura enviada");
}

export async function sendPaymentReminderAction(
  invoiceId: string,
  _previousState: SendInvoiceEmailFormState,
  formData: FormData,
): Promise<SendInvoiceEmailFormState> {
  return deliverFromForm(invoiceId, formData, sendPaymentReminder, "Recordatorio enviado");
}

export type ReminderSettingsFormState = {
  error?: string;
  success?: string;
  values?: Record<string, string>;
};

const reminderSettingsSchema = z.object({
  enabled: z.union([z.literal("on"), z.literal("")]).optional().transform((value) => value === "on"),
  offsets: z.array(z.number({ message: "Usa solo números enteros, por ejemplo -3, 0, 7" })
    .int("Usa solo números enteros, por ejemplo -3, 0, 7")
    .min(-30, "Los días van de -30 a 90")
    .max(90, "Los días van de -30 a 90"))
    .min(1, "Indica al menos un día de recordatorio")
    .transform((values) => [...new Set(values)].sort((a, b) => a - b))
    .refine((values) => values.length <= 6, "Indica como máximo 6 días de recordatorio"),
});

function parseOffsets(raw: FormDataEntryValue | null) {
  return String(raw ?? "").split(/[,\s]+/).filter(Boolean).map((value) => (/^-?\d+$/.test(value) ? Number(value) : Number.NaN));
}

export async function saveReminderSettingsAction(
  _previousState: ReminderSettingsFormState,
  formData: FormData,
): Promise<ReminderSettingsFormState> {
  await requireAuth();

  const result = reminderSettingsSchema.safeParse({
    enabled: formData.get("enabled") ?? "",
    offsets: parseOffsets(formData.get("offsets")),
  });

  if (!result.success) {
    return { error: getFirstErrorMessage(result.error), values: formValues(formData) };
  }

  try {
    await putReminderSettings(result.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return {
      error: /unauthorized|not authorized/i.test(message)
        ? "Solo los administradores pueden cambiar los recordatorios"
        : "No se pudieron guardar los recordatorios",
      values: formValues(formData),
    };
  }

  revalidatePath("/settings/reminders");
  return { success: result.data.enabled ? "Recordatorios activados" : "Recordatorios desactivados" };
}
