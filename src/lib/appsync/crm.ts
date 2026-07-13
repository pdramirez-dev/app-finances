import "server-only";

import { appsyncRequest, listInvoices } from "@/lib/appsync/invoices";
import { listClients } from "@/lib/appsync/workspace";

export type ContactKind = "Cliente" | "Lead" | "Partner";

export type ContactRecord = {
  id: string;
  name: string;
  role: string;
  clientId?: string | null;
  company: string;
  email: string;
  phone: string;
  location: string;
  kind: ContactKind;
  initials: string;
  lastContact: string;
  value: string;
  color: string;
  favorite: boolean;
};

export type PipelineStage = "lead" | "qualified" | "proposal" | "negotiation" | "won";
export type OpportunitySource = "Referido" | "Web" | "Evento" | "Prospección";

export type Opportunity = {
  id: string;
  company: string;
  contact: string;
  title: string;
  value: number;
  stage: PipelineStage;
  probability: number;
  owner: string;
  ownerInitials: string;
  source: OpportunitySource;
  nextAction: string;
  daysUntilAction: number;
  tags: string[];
};

export type ProjectStatus = "Planificación" | "En curso" | "En revisión" | "Completado";
export type CrmPriority = "Alta" | "Media" | "Baja";

export type ProjectRecord = {
  id: string;
  name: string;
  client: string;
  status: ProjectStatus;
  priority: CrmPriority;
  progress: number;
  due: string;
  dueShort: string;
  dueDate: string;
  budget: number;
  spent: number;
  team: string[];
  description: string;
  accent: string;
};

export type TaskKind = "Llamada" | "Correo" | "Reunión" | "Seguimiento";

export type CrmTask = {
  id: string;
  title: string;
  description?: string;
  dueDate: string;
  dueTime?: string;
  priority: CrmPriority;
  kind: TaskKind;
  owner: string;
  ownerInitials: string;
  relatedTo: string;
  completed: boolean;
};

export type CalendarEventType = "Reunión" | "Llamada" | "Seguimiento" | "Entrega";

export type CalendarEvent = {
  id: string;
  title: string;
  company: string;
  date: string;
  start: string;
  end: string;
  type: CalendarEventType;
  owner: string;
  ownerInitials: string;
  location?: string;
};

export type PaymentStatus = "Cobrado" | "Pendiente" | "Vencido" | "Por conciliar";
export type PaymentMethod = "Transferencia" | "Tarjeta" | "ACH" | "Cheque";

export type PaymentRecord = {
  id: string;
  client: string;
  invoice: string;
  amount: number;
  issued: string;
  due: string;
  paidAt?: string;
  method: PaymentMethod;
  status: PaymentStatus;
  reference: string;
  initials: string;
  accent: string;
};

export type BankMovement = {
  id: string;
  concept: string;
  amount: number;
  date: string;
  reference: string;
  paymentId?: string;
};

export type WorkspaceSearchResult = {
  id: string;
  title: string;
  description: string;
  category: "Cliente" | "Contacto" | "Oportunidad" | "Proyecto" | "Tarea" | "Evento" | "Factura" | "Pago";
  href: string;
};

export type CrmSummary = {
  totalClients: number;
  activeContacts: number;
  openOpportunities: number;
  openPipelineValue: number;
  weightedPipelineValue: number;
  activeProjects: number;
  pendingTasks: number;
  overdueTasks: number;
  unreconciledPayments: number;
  unreconciledAmount: number;
  invoicedAmount: number;
  collectedAmount: number;
  outstandingAmount: number;
  overdueAmount: number;
  conversionRate: number;
  grossMargin: number;
  currency: string;
};

export type PutContactInput = {
  contactId?: string;
  name: string;
  role?: string;
  company: string;
  email: string;
  phone?: string;
  location?: string;
  kind: ContactKind;
};

export type PutProjectInput = {
  projectId?: string;
  name: string;
  client: string;
  priority: CrmPriority;
  dueDate: string;
  budget: number;
  description?: string;
};

export type PutTaskInput = {
  taskId?: string;
  title: string;
  description?: string;
  dueDate: string;
  dueTime?: string;
  priority: CrmPriority;
  kind: TaskKind;
  relatedTo?: string;
};

export type PutCalendarEventInput = {
  eventId?: string;
  title: string;
  company: string;
  date: string;
  start: string;
  end: string;
  type: CalendarEventType;
  location?: string;
};

export type RegisterPaymentInput = {
  client: string;
  invoice: string;
  amount: number;
  method: PaymentMethod;
  reference: string;
};

type Connection<T> = { items: T[]; nextToken?: string | null };
type Raw = Record<string, unknown>;

const LIST_CONTACTS = /* GraphQL */ `
  query ListContacts($limit: Int, $nextToken: String) {
    listContacts(limit: $limit, nextToken: $nextToken) {
      items { contactId clientId name role email phone location kind lastContactAt estimatedValue currency isFavorite }
      nextToken
    }
  }
`;

const PUT_CONTACT = /* GraphQL */ `
  mutation PutContact($input: PutContactInput!) {
    putContact(input: $input) {
      contactId clientId name role email phone location kind lastContactAt estimatedValue currency isFavorite
    }
  }
`;

const SET_CONTACT_FAVORITE = /* GraphQL */ `
  mutation SetContactFavorite($contactId: ID!, $favorite: Boolean!) {
    setContactFavorite(contactId: $contactId, favorite: $favorite) {
      contactId clientId name role email phone location kind lastContactAt estimatedValue currency isFavorite
    }
  }
`;

const LIST_OPPORTUNITIES = /* GraphQL */ `
  query ListOpportunities($limit: Int, $nextToken: String) {
    listOpportunities(limit: $limit, nextToken: $nextToken) {
      items { opportunityId clientId contactId title value currency stage probability ownerUserId source nextAction nextActionAt tags }
      nextToken
    }
  }
`;

const UPDATE_OPPORTUNITY_STAGE = /* GraphQL */ `
  mutation UpdateOpportunityStage($opportunityId: ID!, $stage: OpportunityStage!) {
    updateOpportunityStage(opportunityId: $opportunityId, stage: $stage) {
      opportunityId clientId contactId title value currency stage probability ownerUserId source nextAction nextActionAt tags
    }
  }
`;

const LIST_PROJECTS = /* GraphQL */ `
  query ListProjects($limit: Int, $nextToken: String) {
    listProjects(limit: $limit, nextToken: $nextToken) {
      items { projectId clientId opportunityId name description status priority progress dueDate budget spent currency ownerUserId teamUserIds }
      nextToken
    }
  }
`;

const PUT_PROJECT = /* GraphQL */ `
  mutation PutProject($input: PutProjectInput!) {
    putProject(input: $input) { projectId clientId opportunityId name description status priority progress dueDate budget spent currency ownerUserId teamUserIds }
  }
`;

const UPDATE_PROJECT_STATUS = /* GraphQL */ `
  mutation UpdateProjectStatus($projectId: ID!, $status: ProjectStatus!) {
    updateProjectStatus(projectId: $projectId, status: $status) { projectId clientId opportunityId name description status priority progress dueDate budget spent currency ownerUserId teamUserIds }
  }
`;

const LIST_TASKS = /* GraphQL */ `
  query ListTasks($limit: Int, $nextToken: String) {
    listTasks(limit: $limit, nextToken: $nextToken) {
      items { taskId title description dueAt priority kind status ownerUserId completedAt clientId contactId opportunityId projectId }
      nextToken
    }
  }
`;

const PUT_TASK = /* GraphQL */ `
  mutation PutTask($input: PutTaskInput!) {
    putTask(input: $input) { taskId title description dueAt priority kind status ownerUserId completedAt clientId contactId opportunityId projectId }
  }
`;

const SET_TASK_COMPLETED = /* GraphQL */ `
  mutation SetTaskCompleted($taskId: ID!, $completed: Boolean!) {
    setTaskCompleted(taskId: $taskId, completed: $completed) { taskId title description dueAt priority kind status ownerUserId completedAt clientId contactId opportunityId projectId }
  }
`;

const LIST_CALENDAR_EVENTS = /* GraphQL */ `
  query ListCalendarEvents($from: AWSDateTime!, $to: AWSDateTime!, $limit: Int, $nextToken: String) {
    listCalendarEvents(from: $from, to: $to, limit: $limit, nextToken: $nextToken) {
      items { eventId title description startsAt endsAt timezone allDay eventType ownerUserId location clientId contactId opportunityId projectId }
      nextToken
    }
  }
`;

const PUT_CALENDAR_EVENT = /* GraphQL */ `
  mutation PutCalendarEvent($input: PutCalendarEventInput!) {
    putCalendarEvent(input: $input) { eventId title description startsAt endsAt timezone allDay eventType ownerUserId location clientId contactId opportunityId projectId }
  }
`;

const LIST_PAYMENTS = /* GraphQL */ `
  query ListPayments($limit: Int, $nextToken: String) {
    listPayments(limit: $limit, nextToken: $nextToken) {
      items { paymentId invoiceId bankAccountId amount currency method status receivedAt reference notes voidedAt }
      nextToken
    }
  }
`;

const LIST_BANK_MOVEMENTS = /* GraphQL */ `
  query ListBankMovements($limit: Int, $nextToken: String) {
    listBankMovements(limit: $limit, nextToken: $nextToken) {
      items { movementId bankAccountId externalId description reference amount currency bookedOn valueOn reconciled allocatedAmount }
      nextToken
    }
  }
`;

const REGISTER_PAYMENT = /* GraphQL */ `
  mutation RegisterPayment($input: RegisterPaymentInput!) {
    registerPayment(input: $input) { paymentId invoiceId bankAccountId amount currency method status receivedAt reference notes voidedAt }
  }
`;

const PUT_BANK_MOVEMENT = /* GraphQL */ `
  mutation PutBankMovement($input: PutBankMovementInput!) {
    putBankMovement(input: $input) { movementId bankAccountId externalId description reference amount currency bookedOn valueOn reconciled allocatedAmount }
  }
`;

const RECONCILE_PAYMENT = /* GraphQL */ `
  mutation ReconcilePayment($paymentId: ID!, $movementId: ID!, $allocatedAmount: Float!) {
    reconcilePayment(paymentId: $paymentId, movementId: $movementId, allocatedAmount: $allocatedAmount) { paymentId invoiceId bankAccountId amount currency method status receivedAt reference notes voidedAt }
  }
`;

const GET_CRM_SUMMARY = /* GraphQL */ `
  query GetCrmSummary {
    getCrmSummary { totalClients activeContacts openOpportunities openPipelineValue weightedPipelineValue activeProjects pendingTasks overdueTasks unreconciledPayments unreconciledAmount invoicedAmount collectedAmount outstandingAmount overdueAmount conversionRate grossMargin currency }
  }
`;

const SEARCH_WORKSPACE = /* GraphQL */ `
  query SearchWorkspace($query: String!, $limit: Int, $nextToken: String) {
    searchWorkspace(query: $query, limit: $limit, nextToken: $nextToken) {
      items { entityType entityId title subtitle }
      nextToken
    }
  }
`;

function isDevDemo() {
  return process.env.NODE_ENV === "development" && process.env.DEV_AUTH_BYPASS === "true";
}

function string(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function number(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function boolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "AF";
}

function displayDate(value: string, options: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short" }) {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("es-ES", options).format(date).replace(".", "");
}

function enumValue<T extends string>(value: unknown, map: Record<string, T>, fallback: T): T {
  const key = string(value).toUpperCase();
  return map[key] ?? fallback;
}

function normalizeContact(raw: Raw): ContactRecord {
  const name = string(raw.name, "Contacto");
  const kind = enumValue(raw.kind, { CLIENT: "Cliente", CLIENTE: "Cliente", LEAD: "Lead", PARTNER: "Partner" }, "Lead");
  return {
    id: string(raw.contactId ?? raw.id), name, role: string(raw.role, "Contacto principal"),
    clientId: string(raw.clientId) || null, company: string(raw.company, string(raw.clientId, "Sin empresa")), email: string(raw.email),
    phone: string(raw.phone, "Sin teléfono"), location: string(raw.location, "Sin ubicación"), kind,
    initials: initials(name), lastContact: string(raw.lastContact, string(raw.lastContactAt) ? displayDate(string(raw.lastContactAt).slice(0, 10)) : "Sin actividad"),
    value: typeof raw.estimatedValue === "number" ? new Intl.NumberFormat("en-US", { style: "currency", currency: string(raw.currency, "USD"), maximumFractionDigits: 0 }).format(raw.estimatedValue) : string(raw.value, kind === "Partner" ? "—" : "Por estimar"),
    color: "bg-slate-100 text-slate-700", favorite: boolean(raw.favorite ?? raw.isFavorite),
  };
}

const stageMap: Record<string, PipelineStage> = { LEAD: "lead", QUALIFIED: "qualified", PROPOSAL: "proposal", NEGOTIATION: "negotiation", WON: "won" };
const stageInput: Record<PipelineStage, string> = { lead: "LEAD", qualified: "QUALIFIED", proposal: "PROPOSAL", negotiation: "NEGOTIATION", won: "WON" };

function normalizeOpportunity(raw: Raw): Opportunity {
  const owner = string(raw.owner, string(raw.ownerUserId, "Sin asignar"));
  const actionAt = string(raw.nextActionAt);
  const daysUntilAction = actionAt ? Math.ceil((new Date(actionAt).getTime() - Date.now()) / 86_400_000) : number(raw.daysUntilAction);
  return {
    id: string(raw.opportunityId ?? raw.id), company: string(raw.company, string(raw.clientId)), contact: string(raw.contact, string(raw.contactId)), title: string(raw.title),
    value: number(raw.value), stage: enumValue(raw.stage, stageMap, "lead"), probability: number(raw.probability),
    owner, ownerInitials: string(raw.ownerInitials, initials(owner)),
    source: enumValue(raw.source, { REFERRAL: "Referido", REFERIDO: "Referido", WEB: "Web", EVENT: "Evento", EVENTO: "Evento", OUTBOUND: "Prospección", PROSPECCIÓN: "Prospección" }, "Web"),
    nextAction: string(raw.nextAction, "Sin próxima acción"), daysUntilAction,
    tags: Array.isArray(raw.tags) ? raw.tags.filter((tag): tag is string => typeof tag === "string") : [],
  };
}

function normalizeProject(raw: Raw): ProjectRecord {
  const dueDate = string(raw.dueDate);
  const team = Array.isArray(raw.teamUserIds) ? raw.teamUserIds : Array.isArray(raw.team) ? raw.team : [];
  const status = enumValue(raw.status, { PLANNING: "Planificación", PLANIFICACIÓN: "Planificación", IN_PROGRESS: "En curso", "EN CURSO": "En curso", REVIEW: "En revisión", "EN REVISIÓN": "En revisión", COMPLETED: "Completado", COMPLETADO: "Completado" }, "Planificación");
  const accent = status === "Completado" ? "bg-emerald-500" : status === "En revisión" ? "bg-amber-500" : status === "En curso" ? "bg-cyan-500" : "bg-slate-400";
  return {
    id: string(raw.projectId ?? raw.id), name: string(raw.name), client: string(raw.client, string(raw.clientId)), status,
    priority: enumValue(raw.priority, { HIGH: "Alta", ALTA: "Alta", MEDIUM: "Media", MEDIA: "Media", LOW: "Baja", BAJA: "Baja" }, "Media"),
    progress: number(raw.progress), dueDate, due: dueDate ? displayDate(dueDate, { day: "numeric", month: "long", year: "numeric" }) : "Fecha por definir",
    dueShort: dueDate ? displayDate(dueDate) : "Por definir", budget: number(raw.budget), spent: number(raw.spent),
    team: team.filter((member): member is string => typeof member === "string").map(initials),
    description: string(raw.description), accent,
  };
}

function normalizeTask(raw: Raw): CrmTask {
  const owner = string(raw.owner, string(raw.ownerUserId, "Sin asignar"));
  const dueAt = string(raw.dueAt);
  const due = dueAt ? new Date(dueAt) : null;
  const relatedTo = string(raw.relatedTo, string(raw.projectId ?? raw.opportunityId ?? raw.contactId ?? raw.clientId, "Sin vincular"));
  return {
    id: string(raw.taskId ?? raw.id), title: string(raw.title), description: string(raw.description) || undefined,
    dueDate: string(raw.dueDate, due && !Number.isNaN(due.getTime()) ? due.toISOString().slice(0, 10) : ""),
    dueTime: string(raw.dueTime, due && !Number.isNaN(due.getTime()) ? due.toISOString().slice(11, 16) : "") || undefined,
    priority: enumValue(raw.priority, { HIGH: "Alta", ALTA: "Alta", MEDIUM: "Media", MEDIA: "Media", LOW: "Baja", BAJA: "Baja" }, "Media"),
    kind: enumValue(raw.kind, { CALL: "Llamada", LLAMADA: "Llamada", EMAIL: "Correo", CORREO: "Correo", MEETING: "Reunión", REUNIÓN: "Reunión", FOLLOW_UP: "Seguimiento", SEGUIMIENTO: "Seguimiento" }, "Seguimiento"),
    owner, ownerInitials: string(raw.ownerInitials, initials(owner)), relatedTo,
    completed: boolean(raw.completed, string(raw.status).toUpperCase() === "COMPLETED"),
  };
}

function normalizeCalendarEvent(raw: Raw): CalendarEvent {
  const owner = string(raw.owner, string(raw.ownerUserId, "Sin asignar"));
  const startsAt = string(raw.startsAt);
  const endsAt = string(raw.endsAt);
  const startDate = startsAt ? new Date(startsAt) : null;
  const endDate = endsAt ? new Date(endsAt) : null;
  return {
    id: string(raw.eventId ?? raw.id), title: string(raw.title), company: string(raw.company, string(raw.clientId)),
    date: string(raw.date, startDate && !Number.isNaN(startDate.getTime()) ? startDate.toISOString().slice(0, 10) : ""),
    start: string(raw.start, startDate && !Number.isNaN(startDate.getTime()) ? startDate.toISOString().slice(11, 16) : ""),
    end: string(raw.end, endDate && !Number.isNaN(endDate.getTime()) ? endDate.toISOString().slice(11, 16) : ""),
    type: enumValue(raw.eventType ?? raw.type, { MEETING: "Reunión", REUNIÓN: "Reunión", CALL: "Llamada", LLAMADA: "Llamada", FOLLOW_UP: "Seguimiento", SEGUIMIENTO: "Seguimiento", DELIVERY: "Entrega", ENTREGA: "Entrega" }, "Reunión"),
    owner, ownerInitials: string(raw.ownerInitials, initials(owner)), location: string(raw.location) || undefined,
  };
}

function normalizePayment(raw: Raw): PaymentRecord {
  const client = string(raw.client, "Cliente");
  const receivedAt = string(raw.receivedAt);
  return {
    id: string(raw.paymentId ?? raw.id), client, invoice: string(raw.invoice, string(raw.invoiceId)), amount: number(raw.amount),
    issued: string(raw.issued, receivedAt ? displayDate(receivedAt.slice(0, 10)) : ""), due: string(raw.due), paidAt: string(raw.paidAt, receivedAt ? displayDate(receivedAt.slice(0, 10)) : "") || undefined,
    method: enumValue(raw.method, { BANK_TRANSFER: "Transferencia", TRANSFER: "Transferencia", TRANSFERENCIA: "Transferencia", CARD: "Tarjeta", TARJETA: "Tarjeta", ACH: "ACH", CHECK: "Cheque", CHEQUE: "Cheque" }, "Transferencia"),
    status: enumValue(raw.status, { RECONCILED: "Cobrado", COLLECTED: "Cobrado", COBRADO: "Cobrado", PENDING: "Pendiente", PENDIENTE: "Pendiente", OVERDUE: "Vencido", VENCIDO: "Vencido", UNRECONCILED: "Por conciliar", "POR CONCILIAR": "Por conciliar", VOIDED: "Pendiente" }, "Pendiente"),
    reference: string(raw.reference), initials: initials(client), accent: "bg-slate-100 text-slate-700",
  };
}

function normalizeMovement(raw: Raw): BankMovement {
  return { id: string(raw.movementId ?? raw.id), concept: string(raw.concept, string(raw.description)), amount: number(raw.amount), date: string(raw.date, string(raw.bookedOn)), reference: string(raw.reference), paymentId: string(raw.paymentId) || undefined };
}

async function listAll<T>(query: string, field: string, normalize: (raw: Raw) => T, variables: Record<string, unknown> = {}) {
  const items: T[] = [];
  let nextToken: string | null = null;
  do {
    const data: Record<string, Connection<Raw>> = await appsyncRequest<Record<string, Connection<Raw>>>(query, { ...variables, limit: 100, nextToken });
    const connection: Connection<Raw> | undefined = data[field];
    if (!connection) throw new Error(`AppSync response does not contain ${field}`);
    items.push(...connection.items.map(normalize));
    nextToken = connection.nextToken ?? null;
  } while (nextToken);
  return items;
}

const demoContacts: ContactRecord[] = [
  { id: "30000000-0000-4000-8000-000000000001", name: "Daniel Cooper", role: "Director de Operaciones", company: "Northline Logistics", email: "daniel@northline.example", phone: "+1 407 555 0100", location: "Orlando, FL", kind: "Cliente", initials: "DC", lastContact: "Hoy, 10:42", value: "$64,800", color: "bg-blue-100 text-blue-700", favorite: true },
  { id: "30000000-0000-4000-8000-000000000002", name: "Olivia Martin", role: "Directora de Facilities", company: "Harborview Hospitality", email: "olivia@harborview.example", phone: "+1 305 555 0188", location: "Miami, FL", kind: "Lead", initials: "OM", lastContact: "Ayer, 16:20", value: "$31,500", color: "bg-cyan-100 text-cyan-700", favorite: false },
  { id: "30000000-0000-4000-8000-000000000003", name: "Laura Bennett", role: "Portfolio Manager", company: "Greenridge Properties", email: "laura@greenridge.example", phone: "+1 813 555 0132", location: "Tampa, FL", kind: "Cliente", initials: "LB", lastContact: "08 jul", value: "$51,200", color: "bg-emerald-100 text-emerald-700", favorite: true },
];

const demoOpportunities: Opportunity[] = [
  { id: "40000000-0000-4000-8000-000000001048", company: "MetroCare Facilities", contact: "James Wilson", title: "Facility coverage East Region", value: 18400, stage: "lead", probability: 20, owner: "María Santos", ownerInitials: "MS", source: "Web", nextAction: "Llamada de alcance", daysUntilAction: 0, tags: ["Facilities", "Inbound"] },
  { id: "40000000-0000-4000-8000-000000001045", company: "Greenridge Properties", contact: "Laura Bennett", title: "Inspección solar Q3", value: 76000, stage: "qualified", probability: 40, owner: "Pablo Díaz", ownerInitials: "PD", source: "Evento", nextAction: "Validar alcance por ubicación", daysUntilAction: -1, tags: ["Solar", "Prioridad"] },
  { id: "40000000-0000-4000-8000-000000001041", company: "Northline Logistics", contact: "Daniel Cooper", title: "Retrofit eléctrico Warehouse #4", value: 42800, stage: "proposal", probability: 65, owner: "Pablo Díaz", ownerInitials: "PD", source: "Web", nextAction: "Revisar propuesta técnica", daysUntilAction: 0, tags: ["Eléctrico", "Prioridad"] },
  { id: "40000000-0000-4000-8000-000000001037", company: "Harborview Hospitality", contact: "Olivia Martin", title: "Mantenimiento HVAC anual", value: 31500, stage: "negotiation", probability: 80, owner: "María Santos", ownerInitials: "MS", source: "Evento", nextAction: "Cerrar términos del SLA", daysUntilAction: -2, tags: ["HVAC", "Prioridad"] },
  { id: "40000000-0000-4000-8000-000000001029", company: "Palm Coast Warehousing", contact: "Carlos Ortega", title: "Iluminación exterior del centro", value: 21600, stage: "won", probability: 100, owner: "Alex Rivera", ownerInitials: "AR", source: "Web", nextAction: "Programar cuadrilla", daysUntilAction: 4, tags: ["Iluminación"] },
];

const demoProjects: ProjectRecord[] = [
  normalizeProject({ projectId: "50000000-0000-4000-8000-000000000001", name: "Retrofit eléctrico Warehouse #4", client: "Northline Logistics", status: "IN_PROGRESS", priority: "HIGH", progress: 68, dueDate: "2026-07-22", budget: 42800, spent: 26740, team: ["PD", "AR", "MS"], description: "Renovación eléctrica, control de iluminación y puesta en marcha del almacén." }),
  normalizeProject({ projectId: "50000000-0000-4000-8000-000000000002", name: "Inspección solar Q3", client: "Greenridge Properties", status: "PLANNING", priority: "MEDIUM", progress: 18, dueDate: "2026-08-18", budget: 76000, spent: 9100, team: ["PD", "AR"], description: "Inspección y mantenimiento preventivo de instalaciones solares." }),
];

const demoTasks: CrmTask[] = [
  { id: "60000000-0000-4000-8000-000000000301", title: "Revisar propuesta con Northline", description: "Ajustar alcance del retrofit y enviar la versión final.", dueDate: "2026-07-12", dueTime: "10:30", priority: "Alta", kind: "Seguimiento", owner: "Pablo Díaz", ownerInitials: "PD", relatedTo: "Northline Logistics", completed: false },
  { id: "60000000-0000-4000-8000-000000000302", title: "Llamar a James Wilson", dueDate: "2026-07-12", dueTime: "12:00", priority: "Alta", kind: "Llamada", owner: "María Santos", ownerInitials: "MS", relatedTo: "MetroCare Facilities", completed: false },
];

const demoEvents: CalendarEvent[] = [
  { id: "70000000-0000-4000-8000-000000000207", title: "Comité de decisión", company: "Northline Logistics", date: "2026-07-12", start: "09:30", end: "10:30", type: "Reunión", owner: "Laura Ramos", ownerInitials: "LR", location: "Google Meet" },
  { id: "70000000-0000-4000-8000-000000000209", title: "Presentación a operaciones", company: "Harborview Hotels", date: "2026-07-14", start: "15:00", end: "16:00", type: "Reunión", owner: "Sofía León", ownerInitials: "SL", location: "Zoom" },
];

const demoPayments: PaymentRecord[] = [
  { id: "80000000-0000-4000-8000-000000000001", client: "SunPeak", invoice: "INV-2026-0148", amount: 14800, issued: "Jun 18, 2026", due: "Jul 18, 2026", paidAt: "Jul 11, 2026", method: "ACH", status: "Cobrado", reference: "ACH-880194", initials: "SP", accent: "bg-amber-100 text-amber-800" },
  { id: "80000000-0000-4000-8000-000000000002", client: "Northline", invoice: "INV-2026-0152", amount: 9250, issued: "Jun 24, 2026", due: "Jul 24, 2026", method: "Transferencia", status: "Pendiente", reference: "PO-NL-4921", initials: "NL", accent: "bg-indigo-100 text-indigo-700" },
  { id: "80000000-0000-4000-8000-000000000004", client: "Harborview", invoice: "INV-2026-0145", amount: 7450, issued: "Jun 12, 2026", due: "Jul 12, 2026", paidAt: "Jul 10, 2026", method: "Tarjeta", status: "Por conciliar", reference: "STR-309177", initials: "HV", accent: "bg-cyan-100 text-cyan-700" },
];

const demoMovements: BankMovement[] = [
  { id: "90000000-0000-4000-8000-000000000101", concept: "Harborview LLC", amount: 7450, date: "Jul 10, 2026", reference: "STR-309177", paymentId: "80000000-0000-4000-8000-000000000004" },
];

async function clientMaps() {
  const clients = await listClients();
  return {
    byId: new Map(clients.map((client) => [client.clientId, client.name])),
    byName: new Map(clients.map((client) => [client.name.trim().toLocaleLowerCase("es"), client.clientId])),
  };
}

async function clientIdForName(name: string) {
  const { byName } = await clientMaps();
  return byName.get(name.trim().toLocaleLowerCase("es"));
}

export async function listContacts() {
  if (isDevDemo()) return demoContacts;
  const [contacts, clients] = await Promise.all([
    listAll(LIST_CONTACTS, "listContacts", normalizeContact),
    clientMaps(),
  ]);
  return contacts.map((contact) => ({ ...contact, company: contact.clientId ? clients.byId.get(contact.clientId) ?? contact.company : contact.company }));
}

export async function listOpportunities() {
  if (isDevDemo()) return demoOpportunities;
  const [opportunities, clients, contacts] = await Promise.all([
    listAll(LIST_OPPORTUNITIES, "listOpportunities", normalizeOpportunity),
    clientMaps(),
    listContacts(),
  ]);
  const contactsById = new Map(contacts.map((contact) => [contact.id, contact.name]));
  return opportunities.map((opportunity) => ({
    ...opportunity,
    company: clients.byId.get(opportunity.company) ?? (opportunity.company || "Sin empresa"),
    contact: contactsById.get(opportunity.contact) ?? (opportunity.contact || "Sin contacto"),
  }));
}

export async function listProjects() {
  if (isDevDemo()) return demoProjects;
  const [projects, clients] = await Promise.all([
    listAll(LIST_PROJECTS, "listProjects", normalizeProject),
    clientMaps(),
  ]);
  return projects.map((project) => ({ ...project, client: clients.byId.get(project.client) ?? project.client }));
}
export async function listTasks() { return isDevDemo() ? demoTasks : listAll(LIST_TASKS, "listTasks", normalizeTask); }
export async function listCalendarEvents(from: string, to: string) {
  if (isDevDemo()) return demoEvents.filter((event) => event.date >= from && event.date <= to);
  const [events, clients] = await Promise.all([
    listAll(LIST_CALENDAR_EVENTS, "listCalendarEvents", normalizeCalendarEvent, { from: `${from}T00:00:00.000Z`, to: `${to}T23:59:59.999Z` }),
    clientMaps(),
  ]);
  return events.map((event) => ({ ...event, company: clients.byId.get(event.company) ?? (event.company || "Sin empresa") }));
}

export async function listPayments() {
  if (isDevDemo()) return demoPayments;
  const [payments, invoices] = await Promise.all([
    listAll(LIST_PAYMENTS, "listPayments", normalizePayment),
    listInvoices(),
  ]);
  const invoicesById = new Map(invoices.map((invoice) => [invoice.invoiceId, invoice]));
  return payments.map((payment) => {
    const invoice = invoicesById.get(payment.invoice);
    return invoice ? {
      ...payment,
      client: invoice.billToName,
      invoice: `INV-${invoice.date.getFullYear()}-${String(invoice.invoiceNumber).padStart(4, "0")}`,
      issued: displayDate(invoice.date.toISOString().slice(0, 10)),
      due: invoice.dueDate ? displayDate(invoice.dueDate.toISOString().slice(0, 10)) : "—",
      initials: initials(invoice.billToName),
    } : payment;
  });
}

export async function listBankMovements() {
  if (isDevDemo()) return demoMovements;
  const [movements, payments] = await Promise.all([
    listAll(LIST_BANK_MOVEMENTS, "listBankMovements", normalizeMovement, { reconciled: false }),
    listPayments(),
  ]);
  return movements.map((movement) => ({
    ...movement,
    paymentId: payments.find((payment) => payment.amount === movement.amount && (!movement.reference || payment.reference === movement.reference))?.id,
  }));
}

export async function putContact(input: PutContactInput) {
  if (isDevDemo()) return normalizeContact({ contactId: input.contactId ?? crypto.randomUUID(), ...input, favorite: false, lastContact: "Ahora" });
  const clientId = await clientIdForName(input.company);
  const data = await appsyncRequest<{ putContact: Raw }>(PUT_CONTACT, { input: {
    contactId: input.contactId,
    clientId,
    name: input.name,
    role: input.role,
    email: input.email,
    phone: input.phone,
    location: input.location,
    kind: input.kind === "Cliente" ? "CLIENT" : input.kind.toUpperCase(),
    currency: "USD",
  } });
  return { ...normalizeContact(data.putContact), company: input.company };
}

export async function setContactFavorite(contactId: string, favorite: boolean) {
  if (isDevDemo()) return { ...(demoContacts.find((item) => item.id === contactId) ?? demoContacts[0]), id: contactId, favorite };
  const data = await appsyncRequest<{ setContactFavorite: Raw }>(SET_CONTACT_FAVORITE, { contactId, favorite });
  return normalizeContact(data.setContactFavorite);
}

export async function updateOpportunityStage(opportunityId: string, stage: PipelineStage) {
  if (isDevDemo()) return { ...(demoOpportunities.find((item) => item.id === opportunityId) ?? demoOpportunities[0]), id: opportunityId, stage };
  const data = await appsyncRequest<{ updateOpportunityStage: Raw }>(UPDATE_OPPORTUNITY_STAGE, { opportunityId, stage: stageInput[stage] });
  return normalizeOpportunity(data.updateOpportunityStage);
}

const projectStatusInput: Record<ProjectStatus, string> = { "Planificación": "PLANNING", "En curso": "IN_PROGRESS", "En revisión": "REVIEW", Completado: "COMPLETED" };
const priorityInput: Record<CrmPriority, string> = { Alta: "HIGH", Media: "MEDIUM", Baja: "LOW" };

export async function putProject(input: PutProjectInput) {
  if (isDevDemo()) return normalizeProject({ projectId: input.projectId ?? crypto.randomUUID(), ...input, status: "PLANNING", priority: priorityInput[input.priority], progress: 5, spent: 0, team: ["PD"] });
  const clientId = await clientIdForName(input.client);
  if (!clientId) throw new Error("Selecciona un cliente existente para crear el proyecto");
  const data = await appsyncRequest<{ putProject: Raw }>(PUT_PROJECT, { input: {
    projectId: input.projectId,
    clientId,
    name: input.name,
    description: input.description,
    status: "PLANNING",
    priority: priorityInput[input.priority],
    progress: 5,
    dueDate: input.dueDate,
    budget: input.budget,
    spent: 0,
    currency: "USD",
    teamUserIds: [],
  } });
  return { ...normalizeProject(data.putProject), client: input.client };
}

export async function updateProjectStatus(projectId: string, status: ProjectStatus) {
  if (isDevDemo()) return normalizeProject({ ...(demoProjects.find((item) => item.id === projectId) ?? demoProjects[0]), projectId, status: projectStatusInput[status] });
  const data = await appsyncRequest<{ updateProjectStatus: Raw }>(UPDATE_PROJECT_STATUS, { projectId, status: projectStatusInput[status] });
  return normalizeProject(data.updateProjectStatus);
}

const taskKindInput: Record<TaskKind, string> = { Llamada: "CALL", Correo: "EMAIL", "Reunión": "MEETING", Seguimiento: "FOLLOW_UP" };

export async function putTask(input: PutTaskInput) {
  if (isDevDemo()) return normalizeTask({ taskId: input.taskId ?? crypto.randomUUID(), ...input, priority: priorityInput[input.priority], kind: taskKindInput[input.kind], owner: "Pablo Díaz", completed: false });
  const dueAt = input.dueDate ? new Date(`${input.dueDate}T${input.dueTime || "23:59"}:00`).toISOString() : undefined;
  const data = await appsyncRequest<{ putTask: Raw }>(PUT_TASK, { input: {
    taskId: input.taskId,
    title: input.title,
    description: input.description,
    dueAt,
    priority: priorityInput[input.priority],
    kind: taskKindInput[input.kind],
    status: "PENDING",
  } });
  return { ...normalizeTask(data.putTask), relatedTo: input.relatedTo || "Sin vincular" };
}

export async function setTaskCompleted(taskId: string, completed: boolean) {
  if (isDevDemo()) return { ...(demoTasks.find((item) => item.id === taskId) ?? demoTasks[0]), id: taskId, completed };
  const data = await appsyncRequest<{ setTaskCompleted: Raw }>(SET_TASK_COMPLETED, { taskId, completed });
  return normalizeTask(data.setTaskCompleted);
}

const eventTypeInput: Record<CalendarEventType, string> = { "Reunión": "MEETING", Llamada: "CALL", Seguimiento: "FOLLOW_UP", Entrega: "DELIVERY" };

export async function putCalendarEvent(input: PutCalendarEventInput) {
  if (isDevDemo()) return normalizeCalendarEvent({ eventId: input.eventId ?? crypto.randomUUID(), ...input, type: eventTypeInput[input.type], owner: "Pablo Díaz" });
  const clientId = await clientIdForName(input.company);
  const startsAt = new Date(`${input.date}T${input.start}:00`).toISOString();
  const endsAt = new Date(`${input.date}T${input.end}:00`).toISOString();
  const data = await appsyncRequest<{ putCalendarEvent: Raw }>(PUT_CALENDAR_EVENT, { input: {
    eventId: input.eventId,
    title: input.title,
    startsAt,
    endsAt,
    timezone: "America/New_York",
    allDay: false,
    eventType: eventTypeInput[input.type],
    location: input.location,
    clientId,
  } });
  return { ...normalizeCalendarEvent(data.putCalendarEvent), company: input.company };
}

const paymentMethodInput: Record<PaymentMethod, string> = { Transferencia: "BANK_TRANSFER", Tarjeta: "CARD", ACH: "ACH", Cheque: "CHECK" };

export async function registerPayment(input: RegisterPaymentInput) {
  if (isDevDemo()) return normalizePayment({ paymentId: crypto.randomUUID(), ...input, method: paymentMethodInput[input.method], status: "UNRECONCILED", issued: new Date().toISOString().slice(0, 10), due: new Date().toISOString().slice(0, 10), paidAt: new Date().toISOString().slice(0, 10) });
  const invoices = await listInvoices();
  const invoiceNumber = Number(input.invoice.match(/(\d+)$/)?.[1]);
  const invoice = invoices.find((item) => item.invoiceNumber === invoiceNumber || item.invoiceId === input.invoice);
  if (!invoice) throw new Error("Selecciona una factura existente para registrar el pago");
  const data = await appsyncRequest<{ registerPayment: Raw }>(REGISTER_PAYMENT, { input: {
    invoiceId: invoice.invoiceId,
    amount: input.amount,
    currency: invoice.currency,
    method: paymentMethodInput[input.method],
    receivedAt: new Date().toISOString(),
    reference: input.reference,
  } });
  return { ...normalizePayment(data.registerPayment), client: invoice.billToName, invoice: input.invoice, due: "—", initials: initials(invoice.billToName) };
}

export async function putBankMovement(input: Omit<BankMovement, "id"> & { movementId?: string }) {
  if (isDevDemo()) return { id: input.movementId ?? crypto.randomUUID(), ...input };
  const data = await appsyncRequest<{ putBankMovement: Raw }>(PUT_BANK_MOVEMENT, { input: {
    movementId: input.movementId,
    description: input.concept,
    reference: input.reference,
    amount: input.amount,
    currency: "USD",
    bookedOn: input.date,
  } });
  return normalizeMovement(data.putBankMovement);
}

export async function reconcilePayment(paymentId: string, movementId?: string) {
  if (isDevDemo()) return { ...(demoPayments.find((item) => item.id === paymentId) ?? demoPayments[0]), id: paymentId, status: "Cobrado" as const };
  const [payments, movements] = await Promise.all([listPayments(), movementId ? Promise.resolve([]) : listBankMovements()]);
  const payment = payments.find((item) => item.id === paymentId);
  if (!payment) throw new Error("No se encontró el pago");
  const resolvedMovementId = movementId ?? movements.find((item) => item.paymentId === paymentId || (item.amount === payment.amount && item.reference === payment.reference))?.id;
  if (!resolvedMovementId) throw new Error("Selecciona un movimiento bancario para conciliar");
  const data = await appsyncRequest<{ reconcilePayment: Raw }>(RECONCILE_PAYMENT, { paymentId, movementId: resolvedMovementId, allocatedAmount: payment.amount });
  return { ...payment, ...normalizePayment(data.reconcilePayment), client: payment.client, invoice: payment.invoice, issued: payment.issued, due: payment.due, initials: payment.initials };
}

export async function getCrmSummary(): Promise<CrmSummary> {
  if (isDevDemo()) return { totalClients: 5, activeContacts: 3, openOpportunities: 4, openPipelineValue: 168700, weightedPipelineValue: 96300, activeProjects: 2, pendingTasks: 2, overdueTasks: 1, unreconciledPayments: 1, unreconciledAmount: 7450, invoicedAmount: 64250, collectedAmount: 18750, outstandingAmount: 45500, overdueAmount: 12800, conversionRate: 32.8, grossMargin: 37.8, currency: "USD" };
  const data = await appsyncRequest<{ getCrmSummary: CrmSummary }>(GET_CRM_SUMMARY);
  return data.getCrmSummary;
}

export async function searchWorkspace(query: string, limit = 8): Promise<WorkspaceSearchResult[]> {
  if (isDevDemo()) {
    const normalized = query.trim().toLocaleLowerCase("es");
    const results: WorkspaceSearchResult[] = [
      ...demoContacts.map((item) => ({ id: item.id, title: item.name, description: `Contacto · ${item.company}`, category: "Contacto" as const, href: `/contacts?search=${encodeURIComponent(item.name)}` })),
      ...demoOpportunities.map((item) => ({ id: item.id, title: item.title, description: `Oportunidad · ${item.company}`, category: "Oportunidad" as const, href: `/pipeline?search=${encodeURIComponent(item.title)}` })),
      ...demoProjects.map((item) => ({ id: item.id, title: item.name, description: `Proyecto · ${item.client}`, category: "Proyecto" as const, href: `/projects?search=${encodeURIComponent(item.name)}` })),
    ];
    return results.filter((item) => !normalized || `${item.title} ${item.description}`.toLocaleLowerCase("es").includes(normalized)).slice(0, limit);
  }
  const data = await appsyncRequest<{ searchWorkspace: Connection<{ entityType: string; entityId: string; title: string; subtitle?: string | null }> }>(SEARCH_WORKSPACE, { query, limit });
  const routeByType: Record<string, { category: WorkspaceSearchResult["category"]; route: string }> = {
    CLIENT: { category: "Cliente", route: "/clients" }, CONTACT: { category: "Contacto", route: "/contacts" },
    OPPORTUNITY: { category: "Oportunidad", route: "/pipeline" }, PROJECT: { category: "Proyecto", route: "/projects" },
    TASK: { category: "Tarea", route: "/tasks" }, CALENDAR_EVENT: { category: "Evento", route: "/calendar" },
    INVOICE: { category: "Factura", route: "/invoices" }, PAYMENT: { category: "Pago", route: "/payments" },
  };
  return data.searchWorkspace.items.map((item) => {
    const target = routeByType[item.entityType] ?? routeByType.CLIENT;
    return { id: item.entityId, title: item.title, description: item.subtitle ?? target.category, category: target.category, href: `${target.route}?search=${encodeURIComponent(item.title)}` };
  });
}
