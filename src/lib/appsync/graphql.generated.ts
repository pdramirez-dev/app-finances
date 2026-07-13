/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
export type AccountType =
  | 'COMPANY'
  | 'SELF_EMPLOYED';

export type CreateInvoiceFullInput = {
  billToAddress: string;
  billToName: string;
  clientId?: string | number | null | undefined;
  currency?: string | null | undefined;
  date: string;
  grandTotal: number;
  notes?: string | null | undefined;
  project: string;
  sections: Array<CreateInvoiceFullSectionInput>;
  status?: InvoiceStatus | null | undefined;
  weekNumber: number;
};

export type CreateInvoiceFullLineItemInput = {
  amount: number;
  description: string;
  quantity: number;
};

export type CreateInvoiceFullSectionInput = {
  lineItems: Array<CreateInvoiceFullLineItemInput>;
  title: string;
  total: number;
};

export type InvoiceStatus =
  | 'DRAFT'
  | 'PAID'
  | 'SENT';

export type MembershipRole =
  | 'ADMIN'
  | 'MEMBER'
  | 'OWNER';

export type MembershipStatus =
  | 'ACTIVE'
  | 'SUSPENDED';

export type PutAccountInput = {
  address?: string | null | undefined;
  displayName: string;
  email?: string | null | undefined;
  legalName?: string | null | undefined;
  phone?: string | null | undefined;
  taxId?: string | null | undefined;
  type: AccountType;
};

export type PutBankAccountInput = {
  accountNumberMasked?: string | null | undefined;
  bankAccountId?: string | number | null | undefined;
  bankName: string;
  beneficiaryName: string;
  country?: string | null | undefined;
  currency: string;
  ibanMasked?: string | null | undefined;
  routingNumberMasked?: string | null | undefined;
  swiftCode?: string | null | undefined;
};

export type PutClientInput = {
  address?: string | null | undefined;
  clientId?: string | number | null | undefined;
  email?: string | null | undefined;
  name: string;
  phone?: string | null | undefined;
  taxId?: string | null | undefined;
};

export type ListInvoicesQueryVariables = Exact<{
  status?: InvoiceStatus | null | undefined;
  limit?: number | null | undefined;
  nextToken?: string | null | undefined;
}>;


export type ListInvoicesQuery = { listInvoices: { nextToken: string | null, items: Array<{ invoiceId: string, invoiceNumber: number, date: string, weekNumber: number, billToName: string, billToAddress: string, project: string, currency: string, notes: string | null, grandTotal: number, status: InvoiceStatus, createdAt: string, updatedAt: string }> } };

export type GetInvoiceQueryVariables = Exact<{
  invoiceId: string | number;
}>;


export type GetInvoiceQuery = { getInvoice: { invoiceId: string, invoiceNumber: number, date: string, weekNumber: number, billToName: string, billToAddress: string, project: string, currency: string, notes: string | null, grandTotal: number, status: InvoiceStatus, createdAt: string, updatedAt: string, sections: Array<{ invoiceId: string, sectionId: string, title: string, position: number, total: number, lineItems: Array<{ sectionId: string, lineItemId: string, description: string, quantity: number, amount: number, position: number }> }> } | null };

export type GetInvoiceByNumberQueryVariables = Exact<{
  invoiceNumber: number;
}>;


export type GetInvoiceByNumberQuery = { getInvoiceByNumber: { invoiceId: string, invoiceNumber: number, date: string, weekNumber: number, billToName: string, billToAddress: string, project: string, currency: string, notes: string | null, grandTotal: number, status: InvoiceStatus, createdAt: string, updatedAt: string } | null };

export type CreateInvoiceFullMutationVariables = Exact<{
  input: CreateInvoiceFullInput;
}>;


export type CreateInvoiceFullMutation = { createInvoiceFull: { invoiceId: string, invoiceNumber: number, date: string, weekNumber: number, billToName: string, billToAddress: string, project: string, currency: string, notes: string | null, grandTotal: number, status: InvoiceStatus, createdAt: string, updatedAt: string } };

export type UpdateInvoiceStatusMutationVariables = Exact<{
  invoiceId: string | number;
  status: InvoiceStatus;
}>;


export type UpdateInvoiceStatusMutation = { updateInvoiceStatus: { invoiceId: string, invoiceNumber: number, date: string, weekNumber: number, billToName: string, billToAddress: string, project: string, currency: string, notes: string | null, grandTotal: number, status: InvoiceStatus, createdAt: string, updatedAt: string } };

export type DeleteInvoiceMutationVariables = Exact<{
  invoiceId: string | number;
}>;


export type DeleteInvoiceMutation = { deleteInvoice: boolean };

export type GetAccountQueryVariables = Exact<{ [key: string]: never; }>;


export type GetAccountQuery = { getAccount: { accountId: string, type: AccountType, displayName: string, legalName: string | null, taxId: string | null, email: string | null, phone: string | null, address: string | null } | null };

export type PutAccountMutationVariables = Exact<{
  input: PutAccountInput;
}>;


export type PutAccountMutation = { putAccount: { accountId: string, type: AccountType, displayName: string, legalName: string | null, taxId: string | null, email: string | null, phone: string | null, address: string | null } };

export type ListClientsQueryVariables = Exact<{
  limit?: number | null | undefined;
  nextToken?: string | null | undefined;
}>;


export type ListClientsQuery = { listClients: { nextToken: string | null, items: Array<{ accountId: string, clientId: string, name: string, email: string | null, phone: string | null, address: string | null, taxId: string | null }> } };

export type PutClientMutationVariables = Exact<{
  input: PutClientInput;
}>;


export type PutClientMutation = { putClient: { accountId: string, clientId: string, name: string, email: string | null, phone: string | null, address: string | null, taxId: string | null } };

export type DeleteClientMutationVariables = Exact<{
  clientId: string | number;
}>;


export type DeleteClientMutation = { deleteClient: boolean };

export type PutBankAccountMutationVariables = Exact<{
  input: PutBankAccountInput;
}>;


export type PutBankAccountMutation = { putBankAccount: { bankAccountId: string } };

export type GetMyMembershipQueryVariables = Exact<{ [key: string]: never; }>;


export type GetMyMembershipQuery = { getMyMembership: { accountId: string, userId: string, role: MembershipRole, status: MembershipStatus, createdAt: string, updatedAt: string } };
