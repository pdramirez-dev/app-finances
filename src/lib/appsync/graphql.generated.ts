/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
export type AccountType =
  | 'COMPANY'
  | 'SELF_EMPLOYED';

export type CalendarEventType =
  | 'CALL'
  | 'DELIVERY'
  | 'FOLLOW_UP'
  | 'MEETING';

export type ClientStatus =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'PROSPECT';

export type ContactKind =
  | 'CLIENT'
  | 'LEAD'
  | 'PARTNER';

export type CreateInvoiceFullInput = {
  billToAddress: string;
  billToName: string;
  clientId?: string | number | null | undefined;
  currency?: string | null | undefined;
  date: string;
  dueDate?: string | null | undefined;
  grandTotal: number;
  notes?: string | null | undefined;
  project: string;
  sections: Array<CreateInvoiceFullSectionInput>;
  seriesId?: string | number | null | undefined;
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

export type CrmPriority =
  | 'HIGH'
  | 'LOW'
  | 'MEDIUM';

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

export type OpportunitySource =
  | 'EVENT'
  | 'OTHER'
  | 'OUTBOUND'
  | 'REFERRAL'
  | 'WEB';

export type OpportunityStage =
  | 'LEAD'
  | 'LOST'
  | 'NEGOTIATION'
  | 'PROPOSAL'
  | 'QUALIFIED'
  | 'WON';

export type PaymentMethod =
  | 'ACH'
  | 'BANK_TRANSFER'
  | 'CARD'
  | 'CASH'
  | 'CHECK'
  | 'OTHER';

export type PaymentStatus =
  | 'RECONCILED'
  | 'UNRECONCILED'
  | 'VOIDED';

export type ProjectStatus =
  | 'CANCELLED'
  | 'COMPLETED'
  | 'IN_PROGRESS'
  | 'PLANNING'
  | 'REVIEW';

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

export type PutBankMovementInput = {
  amount: number;
  bankAccountId?: string | number | null | undefined;
  bookedOn: string;
  currency?: string | null | undefined;
  description: string;
  externalId?: string | null | undefined;
  movementId?: string | number | null | undefined;
  rawPayload?: unknown;
  reference?: string | null | undefined;
  valueOn?: string | null | undefined;
};

export type PutCalendarEventInput = {
  allDay?: boolean | null | undefined;
  clientId?: string | number | null | undefined;
  contactId?: string | number | null | undefined;
  description?: string | null | undefined;
  endsAt: string;
  eventId?: string | number | null | undefined;
  eventType?: CalendarEventType | null | undefined;
  location?: string | null | undefined;
  opportunityId?: string | number | null | undefined;
  ownerUserId?: string | number | null | undefined;
  projectId?: string | number | null | undefined;
  startsAt: string;
  timezone?: string | null | undefined;
  title: string;
};

export type PutClientInput = {
  address?: string | null | undefined;
  clientId?: string | number | null | undefined;
  email?: string | null | undefined;
  industry?: string | null | undefined;
  name: string;
  notes?: string | null | undefined;
  ownerUserId?: string | number | null | undefined;
  phone?: string | null | undefined;
  status?: ClientStatus | null | undefined;
  tags?: Array<string> | null | undefined;
  taxId?: string | null | undefined;
  website?: string | null | undefined;
};

export type PutContactInput = {
  clientId?: string | number | null | undefined;
  contactId?: string | number | null | undefined;
  currency?: string | null | undefined;
  email?: string | null | undefined;
  estimatedValue?: number | null | undefined;
  kind?: ContactKind | null | undefined;
  lastContactAt?: string | null | undefined;
  location?: string | null | undefined;
  name: string;
  phone?: string | null | undefined;
  role?: string | null | undefined;
};

export type PutInvoiceSeriesInput = {
  archived?: boolean | null | undefined;
  code?: string | null | undefined;
  isDefault?: boolean | null | undefined;
  name: string;
  seriesId?: string | number | null | undefined;
  startNumber?: number | null | undefined;
};

export type PutProjectInput = {
  budget?: number | null | undefined;
  clientId: string | number;
  currency?: string | null | undefined;
  description?: string | null | undefined;
  dueDate?: string | null | undefined;
  name: string;
  opportunityId?: string | number | null | undefined;
  ownerUserId?: string | number | null | undefined;
  priority?: CrmPriority | null | undefined;
  progress?: number | null | undefined;
  projectId?: string | number | null | undefined;
  spent?: number | null | undefined;
  status?: ProjectStatus | null | undefined;
  teamUserIds?: Array<string | number> | null | undefined;
};

export type PutReminderSettingsInput = {
  enabled: boolean;
  offsets: Array<number>;
};

export type PutTaskInput = {
  clientId?: string | number | null | undefined;
  completedAt?: string | null | undefined;
  contactId?: string | number | null | undefined;
  description?: string | null | undefined;
  dueAt?: string | null | undefined;
  kind?: TaskKind | null | undefined;
  opportunityId?: string | number | null | undefined;
  ownerUserId?: string | number | null | undefined;
  priority?: CrmPriority | null | undefined;
  projectId?: string | number | null | undefined;
  status?: TaskStatus | null | undefined;
  taskId?: string | number | null | undefined;
  title: string;
};

export type RegisterPaymentInput = {
  amount: number;
  bankAccountId?: string | number | null | undefined;
  currency?: string | null | undefined;
  invoiceId: string | number;
  method: PaymentMethod;
  notes?: string | null | undefined;
  receivedAt?: string | null | undefined;
  reference: string;
};

export type SendInvoiceEmailInput = {
  invoiceId: string | number;
  message?: string | null | undefined;
  to: string;
};

export type TaskKind =
  | 'CALL'
  | 'EMAIL'
  | 'FOLLOW_UP'
  | 'MEETING';

export type TaskStatus =
  | 'CANCELLED'
  | 'COMPLETED'
  | 'PENDING';

export type UpdateInvoiceFullInput = {
  billToAddress: string;
  billToName: string;
  clientId?: string | number | null | undefined;
  currency?: string | null | undefined;
  date: string;
  dueDate?: string | null | undefined;
  expectedVersion: number;
  grandTotal: number;
  notes?: string | null | undefined;
  project: string;
  sections: Array<CreateInvoiceFullSectionInput>;
  weekNumber: number;
};

export type WorkspaceEntityType =
  | 'CALENDAR_EVENT'
  | 'CLIENT'
  | 'CONTACT'
  | 'INVOICE'
  | 'OPPORTUNITY'
  | 'PAYMENT'
  | 'PROJECT'
  | 'TASK';

export type ListContactsQueryVariables = Exact<{
  limit?: number | null | undefined;
  nextToken?: string | null | undefined;
}>;


export type ListContactsQuery = { listContacts: { nextToken: string | null, items: Array<{ contactId: string, clientId: string | null, name: string, role: string | null, email: string | null, phone: string | null, location: string | null, kind: ContactKind, lastContactAt: string | null, estimatedValue: number | null, currency: string, isFavorite: boolean }> } };

export type PutContactMutationVariables = Exact<{
  input: PutContactInput;
}>;


export type PutContactMutation = { putContact: { contactId: string, clientId: string | null, name: string, role: string | null, email: string | null, phone: string | null, location: string | null, kind: ContactKind, lastContactAt: string | null, estimatedValue: number | null, currency: string, isFavorite: boolean } };

export type SetContactFavoriteMutationVariables = Exact<{
  contactId: string | number;
  favorite: boolean;
}>;


export type SetContactFavoriteMutation = { setContactFavorite: { contactId: string, clientId: string | null, name: string, role: string | null, email: string | null, phone: string | null, location: string | null, kind: ContactKind, lastContactAt: string | null, estimatedValue: number | null, currency: string, isFavorite: boolean } };

export type ListOpportunitiesQueryVariables = Exact<{
  limit?: number | null | undefined;
  nextToken?: string | null | undefined;
}>;


export type ListOpportunitiesQuery = { listOpportunities: { nextToken: string | null, items: Array<{ opportunityId: string, clientId: string | null, contactId: string | null, title: string, value: number, currency: string, stage: OpportunityStage, probability: number, ownerUserId: string | null, source: OpportunitySource, nextAction: string | null, nextActionAt: string | null, tags: Array<string> }> } };

export type UpdateOpportunityStageMutationVariables = Exact<{
  opportunityId: string | number;
  stage: OpportunityStage;
}>;


export type UpdateOpportunityStageMutation = { updateOpportunityStage: { opportunityId: string, clientId: string | null, contactId: string | null, title: string, value: number, currency: string, stage: OpportunityStage, probability: number, ownerUserId: string | null, source: OpportunitySource, nextAction: string | null, nextActionAt: string | null, tags: Array<string> } };

export type ListProjectsQueryVariables = Exact<{
  limit?: number | null | undefined;
  nextToken?: string | null | undefined;
}>;


export type ListProjectsQuery = { listProjects: { nextToken: string | null, items: Array<{ projectId: string, clientId: string, opportunityId: string | null, name: string, description: string | null, status: ProjectStatus, priority: CrmPriority, progress: number, dueDate: string | null, budget: number, spent: number, currency: string, ownerUserId: string | null, teamUserIds: Array<string> }> } };

export type PutProjectMutationVariables = Exact<{
  input: PutProjectInput;
}>;


export type PutProjectMutation = { putProject: { projectId: string, clientId: string, opportunityId: string | null, name: string, description: string | null, status: ProjectStatus, priority: CrmPriority, progress: number, dueDate: string | null, budget: number, spent: number, currency: string, ownerUserId: string | null, teamUserIds: Array<string> } };

export type UpdateProjectStatusMutationVariables = Exact<{
  projectId: string | number;
  status: ProjectStatus;
}>;


export type UpdateProjectStatusMutation = { updateProjectStatus: { projectId: string, clientId: string, opportunityId: string | null, name: string, description: string | null, status: ProjectStatus, priority: CrmPriority, progress: number, dueDate: string | null, budget: number, spent: number, currency: string, ownerUserId: string | null, teamUserIds: Array<string> } };

export type ListTasksQueryVariables = Exact<{
  limit?: number | null | undefined;
  nextToken?: string | null | undefined;
}>;


export type ListTasksQuery = { listTasks: { nextToken: string | null, items: Array<{ taskId: string, title: string, description: string | null, dueAt: string | null, priority: CrmPriority, kind: TaskKind, status: TaskStatus, ownerUserId: string | null, completedAt: string | null, clientId: string | null, contactId: string | null, opportunityId: string | null, projectId: string | null }> } };

export type PutTaskMutationVariables = Exact<{
  input: PutTaskInput;
}>;


export type PutTaskMutation = { putTask: { taskId: string, title: string, description: string | null, dueAt: string | null, priority: CrmPriority, kind: TaskKind, status: TaskStatus, ownerUserId: string | null, completedAt: string | null, clientId: string | null, contactId: string | null, opportunityId: string | null, projectId: string | null } };

export type SetTaskCompletedMutationVariables = Exact<{
  taskId: string | number;
  completed: boolean;
}>;


export type SetTaskCompletedMutation = { setTaskCompleted: { taskId: string, title: string, description: string | null, dueAt: string | null, priority: CrmPriority, kind: TaskKind, status: TaskStatus, ownerUserId: string | null, completedAt: string | null, clientId: string | null, contactId: string | null, opportunityId: string | null, projectId: string | null } };

export type ListCalendarEventsQueryVariables = Exact<{
  from: string;
  to: string;
  limit?: number | null | undefined;
  nextToken?: string | null | undefined;
}>;


export type ListCalendarEventsQuery = { listCalendarEvents: { nextToken: string | null, items: Array<{ eventId: string, title: string, description: string | null, startsAt: string, endsAt: string, timezone: string, allDay: boolean, eventType: CalendarEventType, ownerUserId: string | null, location: string | null, clientId: string | null, contactId: string | null, opportunityId: string | null, projectId: string | null }> } };

export type PutCalendarEventMutationVariables = Exact<{
  input: PutCalendarEventInput;
}>;


export type PutCalendarEventMutation = { putCalendarEvent: { eventId: string, title: string, description: string | null, startsAt: string, endsAt: string, timezone: string, allDay: boolean, eventType: CalendarEventType, ownerUserId: string | null, location: string | null, clientId: string | null, contactId: string | null, opportunityId: string | null, projectId: string | null } };

export type ListPaymentsQueryVariables = Exact<{
  limit?: number | null | undefined;
  nextToken?: string | null | undefined;
}>;


export type ListPaymentsQuery = { listPayments: { nextToken: string | null, items: Array<{ paymentId: string, invoiceId: string, bankAccountId: string | null, amount: number, currency: string, method: PaymentMethod, status: PaymentStatus, receivedAt: string, reference: string, notes: string | null, voidedAt: string | null }> } };

export type ListBankMovementsQueryVariables = Exact<{
  limit?: number | null | undefined;
  nextToken?: string | null | undefined;
}>;


export type ListBankMovementsQuery = { listBankMovements: { nextToken: string | null, items: Array<{ movementId: string, bankAccountId: string | null, externalId: string | null, description: string, reference: string | null, amount: number, currency: string, bookedOn: string, valueOn: string | null, reconciled: boolean, allocatedAmount: number }> } };

export type RegisterPaymentMutationVariables = Exact<{
  input: RegisterPaymentInput;
}>;


export type RegisterPaymentMutation = { registerPayment: { paymentId: string, invoiceId: string, bankAccountId: string | null, amount: number, currency: string, method: PaymentMethod, status: PaymentStatus, receivedAt: string, reference: string, notes: string | null, voidedAt: string | null } };

export type PutBankMovementMutationVariables = Exact<{
  input: PutBankMovementInput;
}>;


export type PutBankMovementMutation = { putBankMovement: { movementId: string, bankAccountId: string | null, externalId: string | null, description: string, reference: string | null, amount: number, currency: string, bookedOn: string, valueOn: string | null, reconciled: boolean, allocatedAmount: number } };

export type ReconcilePaymentMutationVariables = Exact<{
  paymentId: string | number;
  movementId: string | number;
  allocatedAmount: number;
}>;


export type ReconcilePaymentMutation = { reconcilePayment: { paymentId: string, invoiceId: string, bankAccountId: string | null, amount: number, currency: string, method: PaymentMethod, status: PaymentStatus, receivedAt: string, reference: string, notes: string | null, voidedAt: string | null } };

export type GetCrmSummaryQueryVariables = Exact<{ [key: string]: never; }>;


export type GetCrmSummaryQuery = { getCrmSummary: { totalClients: number, activeContacts: number, openOpportunities: number, openPipelineValue: number, weightedPipelineValue: number, activeProjects: number, pendingTasks: number, overdueTasks: number, unreconciledPayments: number, unreconciledAmount: number, invoicedAmount: number, collectedAmount: number, outstandingAmount: number, overdueAmount: number, conversionRate: number, grossMargin: number, currency: string } };

export type SearchWorkspaceQueryVariables = Exact<{
  query: string;
  limit?: number | null | undefined;
  nextToken?: string | null | undefined;
}>;


export type SearchWorkspaceQuery = { searchWorkspace: { nextToken: string | null, items: Array<{ entityType: WorkspaceEntityType, entityId: string, title: string, subtitle: string | null }> } };

export type ListInvoicesQueryVariables = Exact<{
  status?: InvoiceStatus | null | undefined;
  limit?: number | null | undefined;
  nextToken?: string | null | undefined;
}>;


export type ListInvoicesQuery = { listInvoices: { nextToken: string | null, items: Array<{ invoiceId: string, invoiceNumber: number, clientId: string | null, seriesId: string | null, seriesCode: string, version: number, date: string, dueDate: string | null, weekNumber: number, billToName: string, billToAddress: string, project: string, currency: string, notes: string | null, grandTotal: number, status: InvoiceStatus, createdAt: string, updatedAt: string }> } };

export type GetInvoiceQueryVariables = Exact<{
  invoiceId: string | number;
}>;


export type GetInvoiceQuery = { getInvoice: { invoiceId: string, invoiceNumber: number, clientId: string | null, seriesId: string | null, seriesCode: string, version: number, date: string, dueDate: string | null, weekNumber: number, billToName: string, billToAddress: string, project: string, currency: string, notes: string | null, grandTotal: number, status: InvoiceStatus, createdAt: string, updatedAt: string, sections: Array<{ invoiceId: string, sectionId: string, title: string, position: number, total: number, lineItems: Array<{ sectionId: string, lineItemId: string, description: string, quantity: number, amount: number, position: number }> }> } | null };

export type GetInvoiceByNumberQueryVariables = Exact<{
  invoiceNumber: number;
  seriesCode?: string | null | undefined;
}>;


export type GetInvoiceByNumberQuery = { getInvoiceByNumber: { invoiceId: string, invoiceNumber: number, clientId: string | null, seriesId: string | null, seriesCode: string, version: number, date: string, dueDate: string | null, weekNumber: number, billToName: string, billToAddress: string, project: string, currency: string, notes: string | null, grandTotal: number, status: InvoiceStatus, createdAt: string, updatedAt: string } | null };

export type CreateInvoiceFullMutationVariables = Exact<{
  input: CreateInvoiceFullInput;
}>;


export type CreateInvoiceFullMutation = { createInvoiceFull: { invoiceId: string, invoiceNumber: number, clientId: string | null, seriesId: string | null, seriesCode: string, version: number, date: string, dueDate: string | null, weekNumber: number, billToName: string, billToAddress: string, project: string, currency: string, notes: string | null, grandTotal: number, status: InvoiceStatus, createdAt: string, updatedAt: string } };

export type UpdateInvoiceFullMutationVariables = Exact<{
  invoiceId: string | number;
  input: UpdateInvoiceFullInput;
}>;


export type UpdateInvoiceFullMutation = { updateInvoiceFull: { invoiceId: string, invoiceNumber: number, clientId: string | null, seriesId: string | null, seriesCode: string, version: number, date: string, dueDate: string | null, weekNumber: number, billToName: string, billToAddress: string, project: string, currency: string, notes: string | null, grandTotal: number, status: InvoiceStatus, createdAt: string, updatedAt: string } };

export type ListInvoiceSeriesQueryVariables = Exact<{ [key: string]: never; }>;


export type ListInvoiceSeriesQuery = { listInvoiceSeries: Array<{ seriesId: string, accountId: string, code: string, name: string, lastNumber: number, nextNumber: number, isDefault: boolean, archived: boolean, createdAt: string, updatedAt: string }> };

export type PutInvoiceSeriesMutationVariables = Exact<{
  input: PutInvoiceSeriesInput;
}>;


export type PutInvoiceSeriesMutation = { putInvoiceSeries: { seriesId: string, accountId: string, code: string, name: string, lastNumber: number, nextNumber: number, isDefault: boolean, archived: boolean, createdAt: string, updatedAt: string } };

export type SendInvoiceEmailMutationVariables = Exact<{
  input: SendInvoiceEmailInput;
}>;


export type SendInvoiceEmailMutation = { sendInvoiceEmail: { invoiceId: string, sentTo: string, linkExpiresAt: string, statusUpdated: boolean, warning: string | null } };

export type SendPaymentReminderMutationVariables = Exact<{
  input: SendInvoiceEmailInput;
}>;


export type SendPaymentReminderMutation = { sendPaymentReminder: { invoiceId: string, sentTo: string, linkExpiresAt: string, statusUpdated: boolean, warning: string | null } };

export type GetReminderSettingsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetReminderSettingsQuery = { getReminderSettings: { accountId: string, enabled: boolean, enabledAt: string | null, offsets: Array<number> } };

export type PutReminderSettingsMutationVariables = Exact<{
  input: PutReminderSettingsInput;
}>;


export type PutReminderSettingsMutation = { putReminderSettings: { accountId: string, enabled: boolean, enabledAt: string | null, offsets: Array<number> } };

export type ListInvoiceRemindersQueryVariables = Exact<{
  invoiceId: string | number;
}>;


export type ListInvoiceRemindersQuery = { listInvoiceReminders: Array<{ reminderId: string, invoiceId: string, kind: string, offsetDays: number | null, scheduledFor: string | null, recipient: string, status: string, createdAt: string, sentAt: string | null }> };

export type UpdateInvoiceStatusMutationVariables = Exact<{
  invoiceId: string | number;
  status: InvoiceStatus;
}>;


export type UpdateInvoiceStatusMutation = { updateInvoiceStatus: { invoiceId: string, invoiceNumber: number, clientId: string | null, seriesId: string | null, seriesCode: string, version: number, date: string, dueDate: string | null, weekNumber: number, billToName: string, billToAddress: string, project: string, currency: string, notes: string | null, grandTotal: number, status: InvoiceStatus, createdAt: string, updatedAt: string } };

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
