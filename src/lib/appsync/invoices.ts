import "server-only";

import { getServerIdToken } from "@/lib/cognito-session";
import type {
  CreateInvoiceFullInput,
  CreateInvoiceFullMutation,
  DeleteInvoiceMutation,
  GetInvoiceByNumberQuery,
  GetInvoiceQuery,
  ListInvoicesQuery,
  UpdateInvoiceFullInput,
  UpdateInvoiceFullMutation,
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

type DemoInvoiceInput = Record<string, unknown> & {
  sections?: Array<Record<string, unknown> & { lineItems?: Array<Record<string, unknown>> }>;
};

function createDemoInvoice(
  invoiceId: string,
  invoiceNumber: number,
  values: Omit<InvoiceRaw, "invoiceId" | "invoiceNumber" | "createdAt" | "updatedAt" | "sections">,
  now: string,
): InvoiceRaw {
  const sectionId = `${invoiceId}-section`;
  return {
    invoiceId,
    invoiceNumber,
    ...values,
    createdAt: now,
    updatedAt: now,
    sections: [
      {
        invoiceId,
        sectionId,
        title: values.project,
        position: 0,
        total: values.grandTotal,
        lineItems: [
          {
            sectionId,
            lineItemId: `${invoiceId}-line`,
            description: values.project,
            quantity: 1,
            amount: values.grandTotal,
            position: 0,
          },
        ],
      },
    ],
  };
}

function initialDemoInvoices(): InvoiceRaw[] {
  const now = new Date().toISOString();
  return [
    createDemoInvoice("20000000-0000-4000-8000-000000000048", 1048, { clientId: "10000000-0000-4000-8000-000000000001", date: "2026-07-08", dueDate: "2026-07-18", weekNumber: 28, billToName: "Northline Logistics", billToAddress: "4100 Tradeport Drive, Orlando, FL", project: "Warehouse #4 retrofit", currency: "USD", notes: "Net 15", grandTotal: 24500, status: "SENT" }, now),
    createDemoInvoice("20000000-0000-4000-8000-000000000047", 1047, { clientId: "10000000-0000-4000-8000-000000000002", date: "2026-07-02", dueDate: "2026-07-12", weekNumber: 27, billToName: "Greenridge Properties", billToAddress: "1820 Lakeview Avenue, Tampa, FL", project: "Inspección solar Q3", currency: "USD", notes: "Paid via ACH", grandTotal: 18750, status: "PAID" }, now),
    createDemoInvoice("20000000-0000-4000-8000-000000000046", 1046, { clientId: "10000000-0000-4000-8000-000000000004", date: "2026-06-12", dueDate: "2026-07-04", weekNumber: 24, billToName: "MetroCare Facilities", billToAddress: "75 Health Park Way, Kissimmee, FL", project: "Facility maintenance", currency: "USD", notes: "Follow-up required", grandTotal: 12800, status: "SENT" }, now),
    createDemoInvoice("20000000-0000-4000-8000-000000000045", 1045, { clientId: "10000000-0000-4000-8000-000000000005", date: "2026-07-10", dueDate: "2026-08-09", weekNumber: 28, billToName: "BrightSpan Construction", billToAddress: "901 Builder Lane, Lakeland, FL", project: "Electrical labor", currency: "USD", notes: null, grandTotal: 8200, status: "DRAFT" }, now),
  ];
}

function demoInvoiceStore() {
  const demoGlobal = globalThis as typeof globalThis & {
    __appNexoDemoInvoices?: InvoiceRaw[];
  };
  demoGlobal.__appNexoDemoInvoices ??= initialDemoInvoices();
  return demoGlobal.__appNexoDemoInvoices;
}

function invoiceFromDemoInput(input: DemoInvoiceInput): InvoiceRaw {
  const invoices = demoInvoiceStore();
  const now = new Date().toISOString();
  const invoiceId = crypto.randomUUID();
  const invoiceNumber = Math.max(1000, ...invoices.map((invoice) => invoice.invoiceNumber)) + 1;
  const sections = (input.sections ?? []).map((section, sectionPosition) => {
    const sectionId = crypto.randomUUID();
    return {
      invoiceId,
      sectionId,
      title: String(section.title ?? "Servicios"),
      position: sectionPosition,
      total: Number(section.total ?? 0),
      lineItems: (section.lineItems ?? []).map((item, itemPosition) => ({
        sectionId,
        lineItemId: crypto.randomUUID(),
        description: String(item.description ?? "Servicio"),
        quantity: Number(item.quantity ?? 0),
        amount: Number(item.amount ?? 0),
        position: itemPosition,
      })),
    };
  });

  return {
    invoiceId,
    invoiceNumber,
    clientId: input.clientId ? String(input.clientId) : null,
    date: String(input.date),
    dueDate: input.dueDate ? String(input.dueDate) : null,
    weekNumber: Number(input.weekNumber),
    billToName: String(input.billToName),
    billToAddress: String(input.billToAddress),
    project: String(input.project),
    currency: String(input.currency ?? "USD"),
    notes: input.notes ? String(input.notes) : null,
    grandTotal: Number(input.grandTotal),
    status: "DRAFT",
    createdAt: now,
    updatedAt: now,
    sections,
  };
}

const LIST_INVOICES_QUERY = /* GraphQL */ `
  query ListInvoices($status: InvoiceStatus, $limit: Int, $nextToken: String) {
    listInvoices(status: $status, limit: $limit, nextToken: $nextToken) {
      items {
        invoiceId
        invoiceNumber
        clientId
        date
        dueDate
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
      clientId
      date
      dueDate
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
      clientId
      date
      dueDate
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
      clientId
      date
      dueDate
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

const UPDATE_INVOICE_FULL_MUTATION = /* GraphQL */ `
  mutation UpdateInvoiceFull($invoiceId: ID!, $input: UpdateInvoiceFullInput!) {
    updateInvoiceFull(invoiceId: $invoiceId, input: $input) {
      invoiceId
      invoiceNumber
      clientId
      date
      dueDate
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
      clientId
      date
      dueDate
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
    clientId: invoice.clientId ?? null,
    date: parseDate(invoice.date),
    dueDate: invoice.dueDate ? parseDate(invoice.dueDate) : null,
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

    if (query.includes("ListInvoices")) {
      const status = variables?.status;
      const items = demoInvoiceStore().filter((invoice) => !status || invoice.status === status);
      return { listInvoices: { items, nextToken: null } } as T;
    }
    if (query.includes("GetInvoiceByNumber")) {
      const invoice = demoInvoiceStore().find((item) => item.invoiceNumber === Number(variables?.invoiceNumber));
      return { getInvoiceByNumber: invoice ?? null } as T;
    }
    if (query.includes("GetInvoice(")) {
      const invoice = demoInvoiceStore().find((item) => item.invoiceId === variables?.invoiceId);
      return { getInvoice: invoice ?? null } as T;
    }
    if (query.includes("CreateInvoiceFull")) {
      const invoice = invoiceFromDemoInput(input);
      demoInvoiceStore().unshift(invoice);
      return { createInvoiceFull: invoice } as T;
    }
    if (query.includes("UpdateInvoiceFull")) {
      const invoices = demoInvoiceStore();
      const index = invoices.findIndex((item) => item.invoiceId === variables?.invoiceId);
      const current = invoices[index];
      if (!current || current.status === "PAID") throw new Error("La factura no existe o ya está pagada");
      const rebuilt = invoiceFromDemoInput(input);
      const sections = (rebuilt.sections ?? []).map((section) => ({ ...section, invoiceId: current.invoiceId }));
      const invoice = { ...rebuilt, invoiceId: current.invoiceId, invoiceNumber: current.invoiceNumber,
        status: current.status, createdAt: current.createdAt, sections };
      invoices[index] = invoice;
      return { updateInvoiceFull: invoice } as T;
    }
    if (query.includes("UpdateInvoiceStatus")) {
      const invoice = demoInvoiceStore().find((item) => item.invoiceId === variables?.invoiceId);
      if (!invoice) throw new Error("No se encontró la factura demo");
      invoice.status = variables?.status as InvoiceStatus;
      invoice.updatedAt = now;
      return { updateInvoiceStatus: invoice } as T;
    }
    if (query.includes("ListClients")) return { listClients: { items: [
      { accountId, clientId: "10000000-0000-4000-8000-000000000001", name: "Northline Logistics", email: "ops@northline.example", phone: "+1 407 555 0100", address: "4100 Tradeport Drive, Orlando, FL", taxId: "US-10001" },
      { accountId, clientId: "10000000-0000-4000-8000-000000000002", name: "Greenridge Properties", email: "finance@greenridge.example", phone: "+1 813 555 0132", address: "1820 Lakeview Avenue, Tampa, FL", taxId: "US-10002" },
      { accountId, clientId: "10000000-0000-4000-8000-000000000003", name: "Harborview Hospitality", email: "facilities@harborview.example", phone: "+1 305 555 0188", address: "600 Ocean Drive, Miami, FL", taxId: "US-10003" },
      { accountId, clientId: "10000000-0000-4000-8000-000000000004", name: "MetroCare Facilities", email: "ap@metrocare.example", phone: "+1 407 555 0164", address: "75 Health Park Way, Kissimmee, FL", taxId: "US-10004" },
      { accountId, clientId: "10000000-0000-4000-8000-000000000005", name: "BrightSpan Construction", email: "projects@brightspan.example", phone: "+1 863 555 0190", address: "901 Builder Lane, Lakeland, FL", taxId: "US-10005" },
    ], nextToken: null } } as T;
    if (query.includes("GetAccount")) return { getAccount: { accountId, type: "COMPANY", displayName: "SunPeak Field Services", legalName: "SunPeak Field Services LLC", taxId: "US-DEMO-01", email: "hello@sunpeak.example", phone: "+1 407 555 0199", address: "Orlando, Florida" } } as T;
    if (query.includes("GetMyMembership")) return { getMyMembership: { accountId, userId: "dev-user", role: "OWNER", status: "ACTIVE", createdAt: now, updatedAt: now } } as T;
    if (query.includes("PutAccount")) return { putAccount: { accountId, ...input, createdAt: now, updatedAt: now } } as T;
    if (query.includes("PutClient")) return { putClient: { accountId, clientId: input.clientId ?? crypto.randomUUID(), ...input, createdAt: now, updatedAt: now } } as T;
    if (query.includes("DeleteClient")) return { deleteClient: true } as T;
    if (query.includes("PutBankAccount")) return { putBankAccount: { accountId, bankAccountId: crypto.randomUUID(), ...input, createdAt: now, updatedAt: now } } as T;
    if (query.includes("DeleteInvoice")) {
      const invoices = demoInvoiceStore();
      const index = invoices.findIndex((invoice) => invoice.invoiceId === variables?.invoiceId);
      if (index >= 0) invoices.splice(index, 1);
      return { deleteInvoice: index >= 0 } as T;
    }
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

export async function updateInvoiceFull(
  invoiceId: string,
  input: UpdateInvoiceFullInput,
): Promise<InvoiceRecord> {
  const data = await appsyncRequest<UpdateInvoiceFullMutation>(UPDATE_INVOICE_FULL_MUTATION, {
    invoiceId,
    input,
  });
  return normalizeInvoice(data.updateInvoiceFull);
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
