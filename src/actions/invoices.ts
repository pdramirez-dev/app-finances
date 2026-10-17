"use server";

import { format } from "date-fns";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { CreateInvoiceFullInput } from "@/lib/appsync/graphql.generated";
import { createInvoiceFull, deleteInvoice, updateInvoiceFull, updateInvoiceStatus } from "@/lib/appsync/invoices";
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

  const createdInvoice = await createInvoiceFull({ ...parsed.input, status: "DRAFT" });

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

  try {
    await updateInvoiceFull(invoiceId, parsed.input);
  } catch {
    return { error: "No se pudo guardar la factura. Verifica que no esté pagada e inténtalo de nuevo." };
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
