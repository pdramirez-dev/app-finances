import { z } from "@/lib/zod";

const amountSchema = z.number().refine(Number.isFinite, "Importe inválido");

export const invoiceLineItemSchema = z.object({
  description: z.string().trim().min(1, "Indica la descripción del concepto"),
  quantity: z.coerce.number().positive("La cantidad debe ser mayor que 0"),
  amount: z.coerce.number().pipe(amountSchema),
});

export const invoiceSectionSchema = z.object({
  title: z.string().trim().min(1, "Indica el título de la sección"),
  items: z.array(invoiceLineItemSchema).min(1, "Cada sección necesita al menos un concepto"),
});

export const invoiceSectionsInputSchema = z
  .array(invoiceSectionSchema)
  .min(1, "La factura necesita al menos una sección");

export const createInvoiceInputSchema = z.object({
  clientId: z.string().trim().optional().transform((value) => value || undefined),
  date: z
    .string()
    .min(1, "Indica la fecha")
    .transform((value) => new Date(`${value}T00:00:00`))
    .refine((value) => !Number.isNaN(value.getTime()), "Fecha inválida"),
  dueDate: z
    .string()
    .min(1, "Indica la fecha de vencimiento")
    .transform((value) => new Date(`${value}T00:00:00`))
    .refine((value) => !Number.isNaN(value.getTime()), "Fecha de vencimiento inválida"),
  weekNumber: z.coerce.number({ message: "Indica el número de semana" })
    .int("El número de semana debe ser entero")
    .min(1, "El número de semana va de 1 a 53")
    .max(53, "El número de semana va de 1 a 53"),
  billToName: z.string().trim().min(1, "Indica a quién se factura"),
  billToAddress: z.string().trim().min(1, "Indica la dirección de facturación"),
  project: z.string().trim().min(1, "Indica el proyecto"),
  notes: z
    .string()
    .trim()
    .max(2000, "Las notas no pueden superar 2000 caracteres")
    .optional()
    .transform((value) => value || null),
  sections: invoiceSectionsInputSchema,
}).refine((value) => value.dueDate >= value.date, {
  path: ["dueDate"],
  message: "El vencimiento no puede ser anterior a la fecha de la factura",
});

export type InvoiceLineItemInput = z.infer<typeof invoiceLineItemSchema>;
export type InvoiceSectionInput = z.infer<typeof invoiceSectionSchema>;
export type CreateInvoiceInput = z.infer<typeof createInvoiceInputSchema>;

const optionalText = z.string().trim().optional().transform((value) => value || undefined);
const optionalEmail = z.union([z.literal(""), z.email("Ingresa un email válido")]).optional()
  .transform((value) => value || undefined);
const contactFields = {
  email: optionalEmail,
  phone: optionalText,
  address: optionalText,
  taxId: optionalText,
};

export const accountInputSchema = z.object({
  type: z.enum(["SELF_EMPLOYED", "COMPANY"], { message: "Elige el tipo de cuenta" }),
  displayName: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres"),
  legalName: optionalText,
  ...contactFields,
});

export const clientInputSchema = z.object({
  clientId: optionalText,
  name: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres"),
  ...contactFields,
});

// Only masked identifiers are accepted: a few visible characters after a mask.
const maskedIdentifier = z.union([
  z.literal(""),
  z.string().trim().regex(/^[*xX•\s.-]+[A-Za-z0-9]{1,6}$/, "Usa un valor enmascarado, por ejemplo •••• 1234"),
]).optional().transform((value) => value || undefined);

export const bankAccountInputSchema = z.object({
  beneficiaryName: z.string().trim().min(2, "Indica el beneficiario"),
  bankName: z.string().trim().min(2, "Indica el banco"),
  accountNumberMasked: maskedIdentifier,
  routingNumberMasked: maskedIdentifier,
  ibanMasked: maskedIdentifier,
  swiftCode: z.union([z.literal(""), z.string().trim().regex(/^[A-Za-z0-9]{8}([A-Za-z0-9]{3})?$/, "El SWIFT tiene 8 u 11 letras o números")])
    .optional().transform((value) => value || undefined),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Usa un código de moneda de 3 letras, por ejemplo USD"),
  country: optionalText,
});
