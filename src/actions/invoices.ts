"use server";

import { format } from "date-fns";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createInvoiceFull, deleteInvoice, updateInvoiceStatus } from "@/lib/appsync/invoices";
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

export async function createInvoiceAction(
  _previousState: CreateInvoiceActionState,
  formData: FormData,
): Promise<CreateInvoiceActionState> {
  await requireAuth();

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
  const grandTotal = calculateGrandTotal(payload.sections);
  const createdInvoice = await createInvoiceFull({
    clientId: payload.clientId,
    date: format(payload.date, "yyyy-MM-dd"),
    weekNumber: payload.weekNumber,
    billToName: payload.billToName,
    billToAddress: payload.billToAddress,
    project: payload.project,
    notes: payload.notes,
    grandTotal,
    status: "DRAFT",
    sections: payload.sections.map((section) => ({
      title: section.title,
      total: calculateSectionTotal(section),
      lineItems: section.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        amount: item.amount,
      })),
    })),
  });

  revalidatePath("/invoices");
  redirect(`/invoices/${createdInvoice.invoiceId}`);
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
