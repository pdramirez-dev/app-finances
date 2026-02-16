"use server";

import { InvoiceStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { calculateGrandTotal, calculateSectionTotal } from "@/lib/invoices";
import { prisma } from "@/lib/prisma";
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
    invoiceNumber: formData.get("invoiceNumber"),
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

  const duplicateInvoice = await prisma.invoice.findUnique({
    where: { invoiceNumber: payload.invoiceNumber },
    select: { id: true },
  });

  if (duplicateInvoice) {
    return { error: "Invoice number already exists" };
  }

  const grandTotal = calculateGrandTotal(payload.sections);

  const createdInvoice = await prisma.invoice.create({
    data: {
      invoiceNumber: payload.invoiceNumber,
      date: payload.date,
      weekNumber: payload.weekNumber,
      billToName: payload.billToName,
      billToAddress: payload.billToAddress,
      project: payload.project,
      notes: payload.notes,
      grandTotal,
      sections: {
        create: payload.sections.map((section, sectionIndex) => ({
          title: section.title,
          position: sectionIndex,
          total: calculateSectionTotal(section),
          lineItems: {
            create: section.items.map((item, itemIndex) => ({
              description: item.description,
              quantity: item.quantity,
              amount: item.amount,
              position: itemIndex,
            })),
          },
        })),
      },
    },
    select: { id: true },
  });

  revalidatePath("/invoices");
  redirect(`/invoices/${createdInvoice.id}`);
}

export async function updateInvoiceStatusAction(formData: FormData) {
  await requireAuth();

  const result = z
    .object({
      invoiceId: z.string().min(1),
      status: z.nativeEnum(InvoiceStatus),
    })
    .safeParse({
      invoiceId: formData.get("invoiceId"),
      status: formData.get("status"),
    });

  if (!result.success) {
    return;
  }

  await prisma.invoice.update({
    where: { id: result.data.invoiceId },
    data: { status: result.data.status },
  });

  revalidatePath(`/invoices/${result.data.invoiceId}`);
  revalidatePath("/invoices");
}

export async function deleteInvoiceAction(formData: FormData) {
  await requireAuth();

  const invoiceId = formData.get("invoiceId");

  if (typeof invoiceId !== "string" || invoiceId.length === 0) {
    return;
  }

  await prisma.invoice.delete({
    where: { id: invoiceId },
  });

  revalidatePath("/invoices");
  redirect("/invoices");
}
