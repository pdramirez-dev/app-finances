"use server";

import { format } from "date-fns";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { CreateInvoiceFullInput } from "@/lib/appsync/graphql.generated";
import {
  createInvoiceFull,
  deleteInvoice,
  putInvoiceSeries,
  updateInvoiceFull,
  updateInvoiceStatus,
} from "@/lib/appsync/invoices";
import { INVOICE_STATUSES } from "@/lib/invoice-types";
import { calculateGrandTotal, calculateSectionTotal } from "@/lib/invoices";
import { requireAuth } from "@/lib/require-auth";
import { createInvoiceInputSchema, invoiceSectionsInputSchema } from "@/lib/validations";

export type CreateInvoiceActionState = {
  error?: string;
};

function getFirstErrorMessage(error: z.ZodError) {
  const firstIssue = error.issues.at(0);
  return firstIssue?.message ?? "Invalid form values";
}

type ParsedInvoiceForm =
  | { error: string }
  | { input: Omit<CreateInvoiceFullInput, "status"> };

function parseInvoiceForm(formData: FormData): ParsedInvoiceForm {
  const sectionsRaw = formData.get("sections");

  if (typeof sectionsRaw !== "string") {
    return { error: "Sections are required" };
  }

  let parsedSections: unknown;

  try {
    parsedSections = JSON.parse(sectionsRaw);
  } catch {
    return { error: "Sections JSON is invalid" };
  }

  const sectionsResult = invoiceSectionsInputSchema.safeParse(parsedSections);

  if (!sectionsResult.success) {
    return { error: getFirstErrorMessage(sectionsResult.error) };
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
    return { error: getFirstErrorMessage(payloadResult.error) };
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

  if ("error" in parsed) {
    return { error: parsed.error };
  }

  const seriesId = z.union([z.literal(""), z.string().uuid()]).safeParse(formData.get("seriesId") ?? "");

  if (!seriesId.success) {
    return { error: "Selecciona una serie válida" };
  }

  let createdInvoice: Awaited<ReturnType<typeof createInvoiceFull>>;

  try {
    createdInvoice = await createInvoiceFull({
      ...parsed.input,
      seriesId: seriesId.data || undefined,
      status: "DRAFT",
    });
  } catch {
    return { error: "No se pudo crear la factura. Verifica que la serie siga activa e inténtalo de nuevo." };
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

  if ("error" in parsed) {
    return { error: parsed.error };
  }

  const expectedVersion = Number(formData.get("expectedVersion"));

  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
    return { error: "Recarga la página e inténtalo de nuevo" };
  }

  try {
    await updateInvoiceFull(invoiceId, { ...parsed.input, expectedVersion });
  } catch {
    return { error: "No se pudo guardar la factura: cambió mientras la editabas, ya está pagada, el total queda por debajo de lo cobrado o cambiaría la moneda con pagos registrados. Recarga la página e inténtalo de nuevo." };
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
    return { error: getFirstErrorMessage(result.error) };
  }

  const { seriesId, code, name, startNumber, isDefault, archived } = result.data;

  try {
    await putInvoiceSeries(seriesId
      ? { seriesId, name, isDefault, archived }
      : { code, name, startNumber, isDefault });
  } catch (error) {
    return { error: invoiceSeriesErrorMessage(error) };
  }

  revalidatePath("/settings/invoice-series");
  revalidatePath("/invoices/new");
  return { success: seriesId ? "Serie actualizada" : "Serie creada" };
}
