import "server-only";

import { getServerIdToken } from "@/lib/cognito-session";
import type {
  CreateInvoiceFullInput,
  CreateInvoiceFullMutation,
  DeleteInvoiceMutation,
  GetInvoiceByNumberQuery,
  GetInvoiceQuery,
  ListInvoiceSeriesQuery,
  ListInvoicesQuery,
  PutInvoiceSeriesInput,
  PutInvoiceSeriesMutation,
  GetReminderSettingsQuery,
  ListInvoiceRemindersQuery,
  PutReminderSettingsInput,
  PutReminderSettingsMutation,
  SendInvoiceEmailInput,
  SendInvoiceEmailMutation,
  SendPaymentReminderMutation,
  UpdateInvoiceFullInput,
  UpdateInvoiceFullMutation,
  UpdateInvoiceStatusMutation,
} from "@/lib/appsync/graphql.generated";
import type {
  InvoiceLineItemRecord,
  InvoiceRecord,
  InvoiceSectionRecord,
  InvoiceSeries,
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
type InvoiceSeriesRaw = ListInvoiceSeriesQuery["listInvoiceSeries"][number];
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
    createDemoInvoice("20000000-0000-4000-8000-000000000048", 1048, { seriesId: null, seriesCode: "", version: 1, clientId: "10000000-0000-4000-8000-000000000001", date: "2026-07-08", dueDate: "2026-07-18", weekNumber: 28, billToName: "Northline Logistics", billToAddress: "4100 Tradeport Drive, Orlando, FL", project: "Warehouse #4 retrofit", currency: "USD", notes: "Net 15", grandTotal: 24500, status: "SENT" }, now),
    createDemoInvoice("20000000-0000-4000-8000-000000000047", 1047, { seriesId: null, seriesCode: "", version: 1, clientId: "10000000-0000-4000-8000-000000000002", date: "2026-07-02", dueDate: "2026-07-12", weekNumber: 27, billToName: "Greenridge Properties", billToAddress: "1820 Lakeview Avenue, Tampa, FL", project: "Inspección solar Q3", currency: "USD", notes: "Paid via ACH", grandTotal: 18750, status: "PAID" }, now),
    createDemoInvoice("20000000-0000-4000-8000-000000000046", 1046, { seriesId: null, seriesCode: "", version: 1, clientId: "10000000-0000-4000-8000-000000000004", date: "2026-06-12", dueDate: "2026-07-04", weekNumber: 24, billToName: "MetroCare Facilities", billToAddress: "75 Health Park Way, Kissimmee, FL", project: "Facility maintenance", currency: "USD", notes: "Follow-up required", grandTotal: 12800, status: "SENT" }, now),
    createDemoInvoice("20000000-0000-4000-8000-000000000045", 1045, { seriesId: null, seriesCode: "", version: 1, clientId: "10000000-0000-4000-8000-000000000005", date: "2026-07-10", dueDate: "2026-08-09", weekNumber: 28, billToName: "BrightSpan Construction", billToAddress: "901 Builder Lane, Lakeland, FL", project: "Electrical labor", currency: "USD", notes: null, grandTotal: 8200, status: "DRAFT" }, now),
  ];
}

function demoInvoiceStore() {
  const demoGlobal = globalThis as typeof globalThis & {
    __appNexoDemoInvoices?: InvoiceRaw[];
  };
  demoGlobal.__appNexoDemoInvoices ??= initialDemoInvoices();
  return demoGlobal.__appNexoDemoInvoices;
}

type DemoInvoiceSeries = InvoiceSeriesRaw;

function demoSeriesState() {
  const demoGlobal = globalThis as typeof globalThis & {
    __appNexoDemoInvoiceSeries?: { series: DemoInvoiceSeries[]; defaultId: string | null };
  };
  demoGlobal.__appNexoDemoInvoiceSeries ??= { series: [], defaultId: null };
  return demoGlobal.__appNexoDemoInvoiceSeries;
}

function demoSeriesView(series: DemoInvoiceSeries): DemoInvoiceSeries {
  return { ...series, nextNumber: series.lastNumber + 1, isDefault: demoSeriesState().defaultId === series.seriesId };
}

function demoReminderState() {
  const demoGlobal = globalThis as typeof globalThis & {
    __appNexoDemoReminders?: {
      settings: GetReminderSettingsQuery["getReminderSettings"];
      log: ListInvoiceRemindersQuery["listInvoiceReminders"];
    };
  };
  demoGlobal.__appNexoDemoReminders ??= {
    settings: { accountId: "00000000-0000-4000-8000-000000000001", enabled: false, enabledAt: null, offsets: [-3, 0, 7, 14] },
    log: [],
  };
  return demoGlobal.__appNexoDemoReminders;
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
    seriesId: null,
    seriesCode: "",
    version: 1,
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
        seriesId
        seriesCode
        version
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
      seriesId
      seriesCode
      version
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
  query GetInvoiceByNumber($invoiceNumber: Int!, $seriesCode: String) {
    getInvoiceByNumber(invoiceNumber: $invoiceNumber, seriesCode: $seriesCode) {
      invoiceId
      invoiceNumber
      clientId
      seriesId
      seriesCode
      version
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
      seriesId
      seriesCode
      version
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
      seriesId
      seriesCode
      version
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

const LIST_INVOICE_SERIES_QUERY = /* GraphQL */ `
  query ListInvoiceSeries {
    listInvoiceSeries {
      seriesId
      accountId
      code
      name
      lastNumber
      nextNumber
      isDefault
      archived
      createdAt
      updatedAt
    }
  }
`;

const PUT_INVOICE_SERIES_MUTATION = /* GraphQL */ `
  mutation PutInvoiceSeries($input: PutInvoiceSeriesInput!) {
    putInvoiceSeries(input: $input) {
      seriesId
      accountId
      code
      name
      lastNumber
      nextNumber
      isDefault
      archived
      createdAt
      updatedAt
    }
  }
`;

const SEND_INVOICE_EMAIL_MUTATION = /* GraphQL */ `
  mutation SendInvoiceEmail($input: SendInvoiceEmailInput!) {
    sendInvoiceEmail(input: $input) {
      invoiceId
      sentTo
      linkExpiresAt
      statusUpdated
      warning
    }
  }
`;

const SEND_PAYMENT_REMINDER_MUTATION = /* GraphQL */ `
  mutation SendPaymentReminder($input: SendInvoiceEmailInput!) {
    sendPaymentReminder(input: $input) {
      invoiceId
      sentTo
      linkExpiresAt
      statusUpdated
      warning
    }
  }
`;

const GET_REMINDER_SETTINGS_QUERY = /* GraphQL */ `
  query GetReminderSettings {
    getReminderSettings {
      accountId
      enabled
      enabledAt
      offsets
    }
  }
`;

const PUT_REMINDER_SETTINGS_MUTATION = /* GraphQL */ `
  mutation PutReminderSettings($input: PutReminderSettingsInput!) {
    putReminderSettings(input: $input) {
      accountId
      enabled
      enabledAt
      offsets
    }
  }
`;

const LIST_INVOICE_REMINDERS_QUERY = /* GraphQL */ `
  query ListInvoiceReminders($invoiceId: ID!) {
    listInvoiceReminders(invoiceId: $invoiceId) {
      reminderId
      invoiceId
      kind
      offsetDays
      scheduledFor
      recipient
      status
      createdAt
      sentAt
    }
  }
`;

const UPDATE_INVOICE_STATUS_MUTATION = /* GraphQL */ `
  mutation UpdateInvoiceStatus($invoiceId: ID!, $status: InvoiceStatus!) {
    updateInvoiceStatus(invoiceId: $invoiceId, status: $status) {
      invoiceId
      invoiceNumber
      clientId
      seriesId
      seriesCode
      version
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
    seriesId: invoice.seriesId ?? null,
    seriesCode: invoice.seriesCode ?? "",
    version: invoice.version ?? 1,
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
      const invoice = demoInvoiceStore().find((item) => item.invoiceNumber === Number(variables?.invoiceNumber)
        && item.seriesCode === String(variables?.seriesCode ?? ""));
      return { getInvoiceByNumber: invoice ?? null } as T;
    }
    if (query.includes("GetInvoice(")) {
      const invoice = demoInvoiceStore().find((item) => item.invoiceId === variables?.invoiceId);
      return { getInvoice: invoice ?? null } as T;
    }
    if (query.includes("GetReminderSettings")) return { getReminderSettings: demoReminderState().settings } as T;
    if (query.includes("PutReminderSettings")) {
      const state = demoReminderState();
      const enabled = Boolean(input.enabled);
      state.settings = {
        accountId,
        enabled,
        enabledAt: enabled ? state.settings.enabledAt ?? now : null,
        offsets: [...new Set((input.offsets as number[]) ?? [])].sort((a, b) => a - b),
      };
      return { putReminderSettings: state.settings } as T;
    }
    if (query.includes("ListInvoiceReminders")) {
      return { listInvoiceReminders: demoReminderState().log.filter((item) => item.invoiceId === variables?.invoiceId) } as T;
    }
    if (query.includes("SendPaymentReminder")) {
      const invoice = demoInvoiceStore().find((item) => item.invoiceId === input.invoiceId);
      if (!invoice) throw new Error("Factura no encontrada");
      if (invoice.status !== "SENT") throw new Error("Solo se envían recordatorios de facturas enviadas y no pagadas");
      demoReminderState().log.unshift({ reminderId: crypto.randomUUID(), invoiceId: invoice.invoiceId, kind: "MANUAL",
        offsetDays: null, scheduledFor: null, recipient: String(input.to), status: "SENT", createdAt: now, sentAt: now });
      return { sendPaymentReminder: { invoiceId: invoice.invoiceId, sentTo: String(input.to),
        linkExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), statusUpdated: false,
        warning: "Modo demo: no se envió ningún email real" } } as T;
    }
    if (query.includes("SendInvoiceEmail")) {
      // Demo mode does not send anything: it only mirrors the status change.
      const invoice = demoInvoiceStore().find((item) => item.invoiceId === input.invoiceId);
      if (!invoice) throw new Error("Factura no encontrada");
      const statusUpdated = invoice.status === "DRAFT";
      if (statusUpdated) invoice.status = "SENT";
      return { sendInvoiceEmail: {
        invoiceId: invoice.invoiceId,
        sentTo: String(input.to),
        linkExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        statusUpdated,
        warning: "Modo demo: no se envió ningún email real",
      } } as T;
    }
    if (query.includes("ListInvoiceSeries")) {
      return { listInvoiceSeries: demoSeriesState().series.map(demoSeriesView) } as T;
    }
    if (query.includes("PutInvoiceSeries")) {
      const state = demoSeriesState();
      let series = state.series.find((item) => item.seriesId === input.seriesId);
      if (input.seriesId && !series) throw new Error("No se encontró la serie demo");
      if (!series) {
        if (state.series.some((item) => item.code === input.code)) throw new Error("Ya existe una serie con ese código");
        series = { accountId, seriesId: crypto.randomUUID(), code: String(input.code), name: String(input.name),
          lastNumber: Math.max(Number(input.startNumber ?? 1) - 1, 0), nextNumber: 0, isDefault: false,
          archived: false, createdAt: now, updatedAt: now };
        state.series.push(series);
      }
      series.name = String(input.name);
      series.archived = Boolean(input.archived);
      series.updatedAt = now;
      if (input.isDefault && !series.archived) state.defaultId = series.seriesId;
      else if (state.defaultId === series.seriesId) state.defaultId = null;
      return { putInvoiceSeries: demoSeriesView(series) } as T;
    }
    if (query.includes("CreateInvoiceFull")) {
      const invoice = invoiceFromDemoInput(input);
      if (input.seriesId) {
        const series = demoSeriesState().series.find((item) => item.seriesId === input.seriesId && !item.archived);
        if (!series) throw new Error("La serie no existe o está archivada");
        series.lastNumber += 1;
        Object.assign(invoice, { seriesId: series.seriesId, seriesCode: series.code, invoiceNumber: series.lastNumber });
      }
      demoInvoiceStore().unshift(invoice);
      return { createInvoiceFull: invoice } as T;
    }
    if (query.includes("UpdateInvoiceFull")) {
      const invoices = demoInvoiceStore();
      const index = invoices.findIndex((item) => item.invoiceId === variables?.invoiceId);
      const current = invoices[index];
      if (!current || current.status === "PAID") throw new Error("La factura no existe o ya está pagada");
      if (current.version !== Number(input.expectedVersion)) throw new Error("La factura cambió mientras la editabas");
      const rebuilt = invoiceFromDemoInput(input);
      const sections = (rebuilt.sections ?? []).map((section) => ({ ...section, invoiceId: current.invoiceId }));
      const invoice = { ...rebuilt, invoiceId: current.invoiceId, invoiceNumber: current.invoiceNumber,
        seriesId: current.seriesId, seriesCode: current.seriesCode, version: current.version + 1,
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

  // Numbers repeat across series, so order by creation time.
  invoices.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return invoices;
}

export async function getInvoiceById(invoiceId: string): Promise<InvoiceRecord | null> {
  const data = await appsyncRequest<GetInvoiceQuery>(GET_INVOICE_QUERY, { invoiceId });
  return data.getInvoice ? normalizeInvoice(data.getInvoice) : null;
}

export async function getInvoiceByNumber(
  invoiceNumber: number,
  seriesCode = "",
): Promise<InvoiceRecord | null> {
  const data = await appsyncRequest<GetInvoiceByNumberQuery>(GET_INVOICE_BY_NUMBER_QUERY, {
    invoiceNumber,
    seriesCode,
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

function normalizeSeries(series: InvoiceSeriesRaw): InvoiceSeries {
  return {
    seriesId: series.seriesId,
    code: series.code,
    name: series.name,
    lastNumber: series.lastNumber,
    nextNumber: series.nextNumber,
    isDefault: series.isDefault,
    archived: series.archived,
  };
}

export async function listInvoiceSeries(): Promise<InvoiceSeries[]> {
  const data = await appsyncRequest<ListInvoiceSeriesQuery>(LIST_INVOICE_SERIES_QUERY);
  return data.listInvoiceSeries.map(normalizeSeries);
}

export async function putInvoiceSeries(input: PutInvoiceSeriesInput): Promise<InvoiceSeries> {
  const data = await appsyncRequest<PutInvoiceSeriesMutation>(PUT_INVOICE_SERIES_MUTATION, { input });
  return normalizeSeries(data.putInvoiceSeries);
}

export type InvoiceEmailResult = SendInvoiceEmailMutation["sendInvoiceEmail"];

export async function sendInvoiceEmail(input: SendInvoiceEmailInput): Promise<InvoiceEmailResult> {
  const data = await appsyncRequest<SendInvoiceEmailMutation>(SEND_INVOICE_EMAIL_MUTATION, { input });
  return data.sendInvoiceEmail;
}

export async function sendPaymentReminder(input: SendInvoiceEmailInput): Promise<InvoiceEmailResult> {
  const data = await appsyncRequest<SendPaymentReminderMutation>(SEND_PAYMENT_REMINDER_MUTATION, { input });
  return data.sendPaymentReminder;
}

export type ReminderSettings = GetReminderSettingsQuery["getReminderSettings"];
export type InvoiceReminder = ListInvoiceRemindersQuery["listInvoiceReminders"][number];

export async function getReminderSettings(): Promise<ReminderSettings> {
  const data = await appsyncRequest<GetReminderSettingsQuery>(GET_REMINDER_SETTINGS_QUERY);
  return data.getReminderSettings;
}

export async function putReminderSettings(input: PutReminderSettingsInput): Promise<ReminderSettings> {
  const data = await appsyncRequest<PutReminderSettingsMutation>(PUT_REMINDER_SETTINGS_MUTATION, { input });
  return data.putReminderSettings;
}

export async function listInvoiceReminders(invoiceId: string): Promise<InvoiceReminder[]> {
  const data = await appsyncRequest<ListInvoiceRemindersQuery>(LIST_INVOICE_REMINDERS_QUERY, { invoiceId });
  return data.listInvoiceReminders;
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
