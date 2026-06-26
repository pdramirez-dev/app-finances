import { z } from "zod";

const amountSchema = z.number().refine(Number.isFinite, "Invalid amount");

export const invoiceLineItemSchema = z.object({
  description: z.string().trim().min(1, "Description is required"),
  quantity: z.coerce.number().positive("Quantity must be greater than 0"),
  amount: z.coerce.number().pipe(amountSchema),
});

export const invoiceSectionSchema = z.object({
  title: z.string().trim().min(1, "Section title is required"),
  items: z.array(invoiceLineItemSchema).min(1, "At least one line item is required"),
});

export const invoiceSectionsInputSchema = z
  .array(invoiceSectionSchema)
  .min(1, "At least one section is required");

export const createInvoiceInputSchema = z.object({
  date: z
    .string()
    .min(1, "Date is required")
    .transform((value) => new Date(`${value}T00:00:00`))
    .refine((value) => !Number.isNaN(value.getTime()), "Invalid date"),
  weekNumber: z.coerce.number().int().min(1).max(53),
  billToName: z.string().trim().min(1, "Bill to name is required"),
  billToAddress: z.string().trim().min(1, "Bill to address is required"),
  project: z.string().trim().min(1, "Project is required"),
  notes: z
    .string()
    .trim()
    .max(2000, "Notes are too long")
    .optional()
    .transform((value) => value || null),
  sections: invoiceSectionsInputSchema,
});

export type InvoiceLineItemInput = z.infer<typeof invoiceLineItemSchema>;
export type InvoiceSectionInput = z.infer<typeof invoiceSectionSchema>;
export type CreateInvoiceInput = z.infer<typeof createInvoiceInputSchema>;
