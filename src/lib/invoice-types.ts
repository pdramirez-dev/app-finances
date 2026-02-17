export const INVOICE_STATUSES = ["DRAFT", "SENT", "PAID"] as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export type InvoiceLineItemRecord = {
  sectionId: string;
  lineItemId: string;
  description: string;
  quantity: number;
  amount: number;
  position: number;
};

export type InvoiceSectionRecord = {
  invoiceId: string;
  sectionId: string;
  title: string;
  position: number;
  total: number;
  lineItems: InvoiceLineItemRecord[];
};

export type InvoiceRecord = {
  invoiceId: string;
  invoiceNumber: number;
  date: Date;
  weekNumber: number;
  billToName: string;
  billToAddress: string;
  project: string;
  currency: string;
  notes: string | null;
  grandTotal: number;
  status: InvoiceStatus;
  createdAt: Date;
  updatedAt: Date;
  sections: InvoiceSectionRecord[];
};
