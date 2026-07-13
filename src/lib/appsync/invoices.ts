import "server-only";

import { getServerIdToken } from "@/lib/cognito-session";
import type {
  CreateInvoiceFullInput,
  CreateInvoiceFullMutation,
  DeleteInvoiceMutation,
  GetInvoiceByNumberQuery,
  GetInvoiceQuery,
  ListInvoicesQuery,
  UpdateInvoiceStatusMutation,
} from "@/lib/appsync/graphql.generated";
import type {
  InvoiceLineItemRecord,
  InvoiceRecord,
  InvoiceSectionRecord,
  InvoiceStatus,
} from "@/lib/invoice-types";

type GraphQLError = {
  message: string;
};

type GraphQLResponse<T> = {
  data?: T;
  errors?: GraphQLError[];
};

type InvoiceSectionRaw = NonNullable<GetInvoiceQuery["getInvoice"]>["sections"][number];
type InvoiceLineItemRaw = InvoiceSectionRaw["lineItems"][number];
type InvoiceRaw = ListInvoicesQuery["listInvoices"]["items"][number] & {
  sections?: InvoiceSectionRaw[];
};

const LIST_INVOICES_QUERY = /* GraphQL */ `
  query ListInvoices($status: InvoiceStatus, $limit: Int, $nextToken: String) {
    listInvoices(status: $status, limit: $limit, nextToken: $nextToken) {
      items {
        invoiceId
        invoiceNumber
        date
        weekNumber
        billToName
        billToAddress
        project
        currency
        notes
        grandTotal
        status
        createdAt
        updatedAt
      }
      nextToken
    }
  }
`;

const GET_INVOICE_QUERY = /* GraphQL */ `
  query GetInvoice($invoiceId: ID!) {
    getInvoice(invoiceId: $invoiceId) {
      invoiceId
      invoiceNumber
      date
      weekNumber
      billToName
      billToAddress
      project
      currency
      notes
      grandTotal
      status
      createdAt
      updatedAt
      sections {
        invoiceId
        sectionId
        title
        position
        total
        lineItems {
          sectionId
          lineItemId
          description
          quantity
          amount
          position
        }
      }
    }
  }
`;

const GET_INVOICE_BY_NUMBER_QUERY = /* GraphQL */ `
  query GetInvoiceByNumber($invoiceNumber: Int!) {
    getInvoiceByNumber(invoiceNumber: $invoiceNumber) {
      invoiceId
      invoiceNumber
      date
      weekNumber
      billToName
      billToAddress
      project
      currency
      notes
      grandTotal
      status
      createdAt
      updatedAt
    }
  }
`;

const CREATE_INVOICE_FULL_MUTATION = /* GraphQL */ `
  mutation CreateInvoiceFull($input: CreateInvoiceFullInput!) {
    createInvoiceFull(input: $input) {
      invoiceId
      invoiceNumber
      date
      weekNumber
      billToName
      billToAddress
      project
      currency
      notes
      grandTotal
      status
      createdAt
      updatedAt
    }
  }
`;

const UPDATE_INVOICE_STATUS_MUTATION = /* GraphQL */ `
  mutation UpdateInvoiceStatus($invoiceId: ID!, $status: InvoiceStatus!) {
    updateInvoiceStatus(invoiceId: $invoiceId, status: $status) {
      invoiceId
      invoiceNumber
      date
      weekNumber
      billToName
      billToAddress
      project
      currency
      notes
      grandTotal
      status
      createdAt
      updatedAt
    }
  }
`;

const DELETE_INVOICE_MUTATION = /* GraphQL */ `
  mutation DeleteInvoice($invoiceId: ID!) {
    deleteInvoice(invoiceId: $invoiceId)
  }
`;

function parseDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
}

function normalizeLineItem(item: InvoiceLineItemRaw): InvoiceLineItemRecord {
  return {
    sectionId: item.sectionId,
    lineItemId: item.lineItemId,
    description: item.description,
    quantity: item.quantity,
    amount: item.amount,
    position: item.position,
  };
}

function normalizeSection(section: InvoiceSectionRaw): InvoiceSectionRecord {
  return {
    invoiceId: section.invoiceId,
    sectionId: section.sectionId,
    title: section.title,
    position: section.position,
    total: section.total,
    lineItems: (section.lineItems ?? []).map(normalizeLineItem),
  };
}

function normalizeInvoice(invoice: InvoiceRaw): InvoiceRecord {
  return {
    invoiceId: invoice.invoiceId,
    invoiceNumber: invoice.invoiceNumber,
    date: parseDate(invoice.date),
    weekNumber: invoice.weekNumber,
    billToName: invoice.billToName,
    billToAddress: invoice.billToAddress,
    project: invoice.project,
    currency: invoice.currency,
    notes: invoice.notes ?? null,
    grandTotal: invoice.grandTotal,
    status: invoice.status,
    createdAt: parseDate(invoice.createdAt),
    updatedAt: parseDate(invoice.updatedAt),
    sections: (invoice.sections ?? []).map(normalizeSection),
  };
}

export async function appsyncRequest<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  if (process.env.NODE_ENV === "development" && process.env.DEV_AUTH_BYPASS === "true") {
    const now = new Date().toISOString();
    const accountId = "00000000-0000-4000-8000-000000000001";
    const input = (variables?.input ?? {}) as Record<string, unknown>;

    if (query.includes("ListInvoices")) return { listInvoices: { items: [], nextToken: null } } as T;
    if (query.includes("GetInvoiceByNumber")) return { getInvoiceByNumber: null } as T;
    if (query.includes("GetInvoice(")) return { getInvoice: null } as T;
    if (query.includes("ListClients")) return { listClients: { items: [
      { accountId, clientId: "10000000-0000-4000-8000-000000000001", name: "Acme Studio", email: "billing@acme.test", phone: "+1 555 0100", address: "100 Market Street", taxId: "US-10001" },
      { accountId, clientId: "10000000-0000-4000-8000-000000000002", name: "Northwind Labs", email: "finance@northwind.test", phone: "+1 555 0132", address: "42 Lake Avenue", taxId: "US-10002" },
    ], nextToken: null } } as T;
    if (query.includes("GetAccount")) return { getAccount: { accountId, type: "COMPANY", displayName: "Lightning Services", legalName: "Lightning Services of Tampa LLC", taxId: "US-DEMO-01", email: "hello@lightning.test", phone: "+1 555 0199", address: "Tampa, Florida" } } as T;
    if (query.includes("GetMyMembership")) return { getMyMembership: { accountId, userId: "dev-user", role: "OWNER", status: "ACTIVE", createdAt: now, updatedAt: now } } as T;
    if (query.includes("PutAccount")) return { putAccount: { accountId, ...input, createdAt: now, updatedAt: now } } as T;
    if (query.includes("PutClient")) return { putClient: { accountId, clientId: input.clientId ?? crypto.randomUUID(), ...input, createdAt: now, updatedAt: now } } as T;
    if (query.includes("DeleteClient")) return { deleteClient: true } as T;
    if (query.includes("PutBankAccount")) return { putBankAccount: { accountId, bankAccountId: crypto.randomUUID(), ...input, createdAt: now, updatedAt: now } } as T;
    if (query.includes("DeleteInvoice")) return { deleteInvoice: true } as T;
    throw new Error("Esta operación no está disponible en el modo demo local");
  }

  const graphqlUrl =
    process.env.APPSYNC_GRAPHQL_URL ?? process.env.NEXT_PUBLIC_APPSYNC_GRAPHQL_URL ?? "";

  if (!graphqlUrl) {
    throw new Error("Missing APPSYNC_GRAPHQL_URL");
  }

  const idToken = await getServerIdToken();

  if (!idToken) {
    throw new Error("Missing Cognito ID token in session");
  }

  const response = await fetch(graphqlUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: idToken,
    },
    cache: "no-store",
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`AppSync request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as GraphQLResponse<T>;

  if (payload.errors && payload.errors.length > 0) {
    throw new Error(payload.errors[0]?.message ?? "AppSync GraphQL error");
  }

  if (!payload.data) {
    throw new Error("AppSync response does not contain data");
  }

  return payload.data;
}

export async function listInvoices(options?: {
  status?: InvoiceStatus;
  limit?: number;
}): Promise<InvoiceRecord[]> {
  const limit = options?.limit ?? 100;
  const invoices: InvoiceRecord[] = [];
  let cursor: string | null = null;

  do {
    const data: ListInvoicesQuery = await appsyncRequest<ListInvoicesQuery>(LIST_INVOICES_QUERY, {
      status: options?.status,
      limit,
      nextToken: cursor,
    });

    for (const item of data.listInvoices.items) {
      invoices.push(normalizeInvoice(item));
    }

    cursor = data.listInvoices.nextToken ?? null;
  } while (cursor);

  invoices.sort((a, b) => b.invoiceNumber - a.invoiceNumber);
  return invoices;
}

export async function getInvoiceById(invoiceId: string): Promise<InvoiceRecord | null> {
  const data = await appsyncRequest<GetInvoiceQuery>(GET_INVOICE_QUERY, { invoiceId });
  return data.getInvoice ? normalizeInvoice(data.getInvoice) : null;
}

export async function getInvoiceByNumber(invoiceNumber: number): Promise<InvoiceRecord | null> {
  const data = await appsyncRequest<GetInvoiceByNumberQuery>(GET_INVOICE_BY_NUMBER_QUERY, {
    invoiceNumber,
  });
  return data.getInvoiceByNumber ? normalizeInvoice(data.getInvoiceByNumber) : null;
}

export async function createInvoiceFull(input: CreateInvoiceFullInput): Promise<InvoiceRecord> {
  const data = await appsyncRequest<CreateInvoiceFullMutation>(CREATE_INVOICE_FULL_MUTATION, {
    input,
  });
  return normalizeInvoice(data.createInvoiceFull);
}

export async function updateInvoiceStatus(
  invoiceId: string,
  status: InvoiceStatus,
): Promise<InvoiceRecord> {
  const data = await appsyncRequest<UpdateInvoiceStatusMutation>(UPDATE_INVOICE_STATUS_MUTATION, {
    invoiceId,
    status,
  });
  return normalizeInvoice(data.updateInvoiceStatus);
}

export async function deleteInvoice(invoiceId: string): Promise<boolean> {
  const data = await appsyncRequest<DeleteInvoiceMutation>(DELETE_INVOICE_MUTATION, { invoiceId });
  return data.deleteInvoice;
}
