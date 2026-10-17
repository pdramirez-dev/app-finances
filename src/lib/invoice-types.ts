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
  seriesId: string | null;
  seriesCode: string;
  /** Bumped by every edit and payment; edits must send the version they started from. */
  version: number;
  clientId: string | null;
  date: Date;
  dueDate: Date | null;
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

export type InvoiceSeries = {
  seriesId: string;
  code: string;
  name: string;
  lastNumber: number;
  nextNumber: number;
  isDefault: boolean;
  archived: boolean;
};
