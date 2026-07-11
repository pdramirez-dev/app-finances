import "server-only";

import { getServerIdToken } from "@/lib/cognito-session";
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

type InvoiceLineItemRaw = {
  sectionId: string;
  lineItemId: string;
  description: string;
  quantity: number;
  amount: number;
  position: number;
};

type InvoiceSectionRaw = {
  invoiceId: string;
  sectionId: string;
  title: string;
  position: number;
  total: number;
  lineItems?: InvoiceLineItemRaw[];
};

type InvoiceRaw = {
  invoiceId: string;
  accountId?: string;
  clientId?: string | null;
  invoiceNumber: number;
  date: string;
  weekNumber: number;
  billToName: string;
  billToAddress: string;
  project: string;
  currency: string;
  notes?: string | null;
  grandTotal: number;
  status: InvoiceStatus;
  createdAt: string;
  updatedAt: string;
  sections?: InvoiceSectionRaw[];
};

type ListInvoicesResult = {
  listInvoices: {
    items: InvoiceRaw[];
    nextToken: string | null;
  };
};

type GetInvoiceResult = {
  getInvoice: InvoiceRaw | null;
};

type GetInvoiceByNumberResult = {
  getInvoiceByNumber: InvoiceRaw | null;
};

type PutInvoiceResult = {
  putInvoice: InvoiceRaw;
};

type PutInvoiceSectionResult = {
  putInvoiceSection: InvoiceSectionRaw;
};

type PutInvoiceLineItemResult = {
  putInvoiceLineItem: InvoiceLineItemRaw;
};

type UpdateInvoiceStatusResult = {
  updateInvoiceStatus: InvoiceRaw;
};

const LIST_INVOICES_QUERY = `
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

const GET_INVOICE_QUERY = `
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

const GET_INVOICE_BY_NUMBER_QUERY = `
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

const PUT_INVOICE_MUTATION = `
  mutation PutInvoice($input: PutInvoiceInput!) {
    putInvoice(input: $input) {
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

const PUT_INVOICE_SECTION_MUTATION = `
  mutation PutInvoiceSection($input: PutInvoiceSectionInput!) {
    putInvoiceSection(input: $input) {
      invoiceId
      sectionId
      title
      position
      total
    }
  }
`;

const PUT_INVOICE_LINE_ITEM_MUTATION = `
  mutation PutInvoiceLineItem($input: PutInvoiceLineItemInput!) {
    putInvoiceLineItem(input: $input) {
      sectionId
      lineItemId
      description
      quantity
      amount
      position
    }
  }
`;

const UPDATE_INVOICE_STATUS_MUTATION = `
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

const DELETE_INVOICE_MUTATION = `
  mutation DeleteInvoice($invoiceId: ID!) {
    deleteInvoice(invoiceId: $invoiceId)
  }
`;

const DELETE_INVOICE_SECTION_MUTATION = `
  mutation DeleteInvoiceSection($invoiceId: ID!, $sectionId: ID!) {
    deleteInvoiceSection(invoiceId: $invoiceId, sectionId: $sectionId)
  }
`;

const DELETE_INVOICE_LINE_ITEM_MUTATION = `
  mutation DeleteInvoiceLineItem($sectionId: ID!, $lineItemId: ID!) {
    deleteInvoiceLineItem(sectionId: $sectionId, lineItemId: $lineItemId)
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

async function appsyncRequest<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
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
    const data: ListInvoicesResult = await appsyncRequest<ListInvoicesResult>(LIST_INVOICES_QUERY, {
      status: options?.status,
      limit,
      nextToken: cursor,
    });

    for (const item of data.listInvoices.items) {
      invoices.push(normalizeInvoice(item));
    }

    cursor = data.listInvoices.nextToken;
  } while (cursor);

  invoices.sort((a, b) => b.invoiceNumber - a.invoiceNumber);
  return invoices;
}

export async function getInvoiceById(invoiceId: string): Promise<InvoiceRecord | null> {
  const data = await appsyncRequest<GetInvoiceResult>(GET_INVOICE_QUERY, { invoiceId });
  return data.getInvoice ? normalizeInvoice(data.getInvoice) : null;
}

export async function getInvoiceByNumber(invoiceNumber: number): Promise<InvoiceRecord | null> {
  const data = await appsyncRequest<GetInvoiceByNumberResult>(GET_INVOICE_BY_NUMBER_QUERY, {
    invoiceNumber,
  });
  return data.getInvoiceByNumber ? normalizeInvoice(data.getInvoiceByNumber) : null;
}

export type PutInvoiceInput = {
  invoiceId?: string;
  invoiceNumber?: number;
  date: string;
  weekNumber: number;
  billToName: string;
  billToAddress: string;
  project: string;
  currency?: string;
  notes?: string | null;
  grandTotal: number;
  status?: InvoiceStatus;
  createdAt?: string;
};

export async function putInvoice(input: PutInvoiceInput): Promise<InvoiceRecord> {
  const data = await appsyncRequest<PutInvoiceResult>(PUT_INVOICE_MUTATION, {
    input,
  });
  return normalizeInvoice(data.putInvoice);
}

export async function putInvoiceSection(input: {
  invoiceId: string;
  sectionId?: string;
  title: string;
  position: number;
  total: number;
}): Promise<InvoiceSectionRecord> {
  const data = await appsyncRequest<PutInvoiceSectionResult>(PUT_INVOICE_SECTION_MUTATION, {
    input,
  });
  return normalizeSection(data.putInvoiceSection);
}

export async function putInvoiceLineItem(input: {
  sectionId: string;
  lineItemId?: string;
  description: string;
  quantity: number;
  amount: number;
  position: number;
}): Promise<InvoiceLineItemRecord> {
  const data = await appsyncRequest<PutInvoiceLineItemResult>(PUT_INVOICE_LINE_ITEM_MUTATION, {
    input,
  });
  return normalizeLineItem(data.putInvoiceLineItem);
}

export async function updateInvoiceStatus(
  invoiceId: string,
  status: InvoiceStatus,
): Promise<InvoiceRecord> {
  const data = await appsyncRequest<UpdateInvoiceStatusResult>(UPDATE_INVOICE_STATUS_MUTATION, {
    invoiceId,
    status,
  });
  return normalizeInvoice(data.updateInvoiceStatus);
}

export async function deleteInvoice(invoiceId: string): Promise<boolean> {
  const data = await appsyncRequest<{ deleteInvoice: boolean }>(DELETE_INVOICE_MUTATION, { invoiceId });
  return data.deleteInvoice;
}

export async function deleteInvoiceSection(invoiceId: string, sectionId: string): Promise<boolean> {
  const data = await appsyncRequest<{ deleteInvoiceSection: boolean }>(
    DELETE_INVOICE_SECTION_MUTATION,
    { invoiceId, sectionId },
  );
  return data.deleteInvoiceSection;
}

export async function deleteInvoiceLineItem(sectionId: string, lineItemId: string): Promise<boolean> {
  const data = await appsyncRequest<{ deleteInvoiceLineItem: boolean }>(
    DELETE_INVOICE_LINE_ITEM_MUTATION,
    { sectionId, lineItemId },
  );
  return data.deleteInvoiceLineItem;
}
