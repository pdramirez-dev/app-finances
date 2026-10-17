import { DEFAULT_PAGE_SIZE, invoiceNumberLabel, type SqlRequest } from "./sql-builders";

type Args = Record<string, any>;

const CONTACT_COLS = `c.id AS "contactId", c.account_id AS "accountId", c.client_id AS "clientId",
  c.name, c.role, c.email, c.phone, c.location, c.kind, c.last_contact_at AS "lastContactAt",
  c.estimated_value AS "estimatedValue", c.currency,
  EXISTS (SELECT 1 FROM contact_favorites f WHERE f.account_id = c.account_id AND f.contact_id = c.id AND f.user_id = :userId) AS "isFavorite",
  c.created_at AS "createdAt", c.updated_at AS "updatedAt"`;

const OPPORTUNITY_COLS = `o.id AS "opportunityId", o.account_id AS "accountId", o.client_id AS "clientId",
  o.contact_id AS "contactId", o.title, o.value, o.currency, o.stage, o.probability,
  o.owner_user_id AS "ownerUserId", o.source, o.next_action AS "nextAction",
  o.next_action_at AS "nextActionAt", o.tags, o.closed_at AS "closedAt",
  o.lost_reason AS "lostReason", o.created_at AS "createdAt", o.updated_at AS "updatedAt"`;

const PROJECT_COLS = `p.id AS "projectId", p.account_id AS "accountId", p.client_id AS "clientId",
  p.opportunity_id AS "opportunityId", p.name, p.description, p.status, p.priority, p.progress,
  p.due_date AS "dueDate", p.budget, p.spent, p.currency, p.owner_user_id AS "ownerUserId",
  p.team_user_ids AS "teamUserIds", p.created_at AS "createdAt", p.updated_at AS "updatedAt"`;

const TASK_COLS = `t.id AS "taskId", t.account_id AS "accountId", t.title, t.description,
  t.due_at AS "dueAt", t.priority, t.kind, t.status, t.owner_user_id AS "ownerUserId",
  t.completed_at AS "completedAt", t.client_id AS "clientId", t.contact_id AS "contactId",
  t.opportunity_id AS "opportunityId", t.project_id AS "projectId",
  t.created_at AS "createdAt", t.updated_at AS "updatedAt"`;

const EVENT_COLS = `e.id AS "eventId", e.account_id AS "accountId", e.title, e.description,
  e.starts_at AS "startsAt", e.ends_at AS "endsAt", e.timezone, e.all_day AS "allDay",
  e.event_type AS "eventType", e.owner_user_id AS "ownerUserId", e.location,
  e.client_id AS "clientId", e.contact_id AS "contactId", e.opportunity_id AS "opportunityId",
  e.project_id AS "projectId", e.created_at AS "createdAt", e.updated_at AS "updatedAt"`;

const PAYMENT_COLS = `p.id AS "paymentId", p.account_id AS "accountId", p.invoice_id AS "invoiceId",
  p.bank_account_id AS "bankAccountId", p.amount, p.currency, p.method, p.status,
  p.received_at AS "receivedAt", p.reference, p.notes, p.voided_at AS "voidedAt",
  p.voided_by AS "voidedBy", p.void_reason AS "voidReason",
  p.created_at AS "createdAt", p.updated_at AS "updatedAt"`;

const PAYMENT_COLS_BEFORE_STATUS = `p.id AS "paymentId", p.account_id AS "accountId",
  p.invoice_id AS "invoiceId", p.bank_account_id AS "bankAccountId", p.amount, p.currency, p.method`;

const PAYMENT_COLS_AFTER_STATUS = `p.received_at AS "receivedAt", p.reference, p.notes,
  p.voided_at AS "voidedAt", p.voided_by AS "voidedBy", p.void_reason AS "voidReason",
  p.created_at AS "createdAt"`;

function page(args: Args) {
  return { lim: args.limit ?? DEFAULT_PAGE_SIZE, off: args.offset ?? 0 };
}

function jsonArray(value: unknown) {
  return JSON.stringify(Array.isArray(value) ? value : []);
}

function relationChecks(alias: string, input: any, includeProject = true) {
  const checks = [
    `(CAST(:clientId AS uuid) IS NULL OR EXISTS (SELECT 1 FROM clients c WHERE c.account_id = :acc AND c.id = CAST(:clientId AS uuid)))`,
    `(CAST(:contactId AS uuid) IS NULL OR EXISTS (SELECT 1 FROM contacts c WHERE c.account_id = :acc AND c.id = CAST(:contactId AS uuid) AND (CAST(:clientId AS uuid) IS NULL OR c.client_id IS NULL OR c.client_id = CAST(:clientId AS uuid))))`,
    `(CAST(:opportunityId AS uuid) IS NULL OR EXISTS (SELECT 1 FROM opportunities o WHERE o.account_id = :acc AND o.id = CAST(:opportunityId AS uuid) AND (CAST(:clientId AS uuid) IS NULL OR o.client_id IS NULL OR o.client_id = CAST(:clientId AS uuid))))`,
  ];
  if (includeProject) checks.push(`(CAST(:projectId AS uuid) IS NULL OR EXISTS (SELECT 1 FROM projects p WHERE p.account_id = :acc AND p.id = CAST(:projectId AS uuid) AND (CAST(:clientId AS uuid) IS NULL OR p.client_id = CAST(:clientId AS uuid))))`);
  return { statement: `${alias} AS (SELECT 1 WHERE ${checks.join(" AND ")})`, params: {
    clientId: input.clientId ?? null,
    contactId: input.contactId ?? null,
    opportunityId: input.opportunityId ?? null,
    projectId: input.projectId ?? null,
  } };
}

export function getContact(acc: string, args: Args, userId: string): SqlRequest {
  return { statement: `SELECT ${CONTACT_COLS} FROM contacts c WHERE c.account_id = :acc AND c.id = :id`, params: { acc, id: args.contactId, userId } };
}

export function listContacts(acc: string, args: Args, userId: string): SqlRequest {
  const where = ["c.account_id = :acc"];
  const params: Record<string, unknown> = { acc, userId, ...page(args) };
  if (args.kind) { where.push("c.kind = CAST(:kind AS contact_kind)"); params.kind = args.kind; }
  if (args.clientId) { where.push("c.client_id = :clientId"); params.clientId = args.clientId; }
  if (args.search) { where.push("(c.name ILIKE :search OR c.email ILIKE :search OR c.role ILIKE :search)"); params.search = `%${args.search}%`; }
  return { statement: `SELECT ${CONTACT_COLS} FROM contacts c WHERE ${where.join(" AND ")} ORDER BY lower(c.name), c.id LIMIT :lim OFFSET :off`, params };
}

export function putContact(acc: string, args: Args, userId: string): SqlRequest {
  const i = args.input;
  return {
    statement: `WITH valid_client AS (
        SELECT 1 WHERE CAST(:clientId AS uuid) IS NULL OR EXISTS (
          SELECT 1 FROM clients WHERE account_id = :acc AND id = CAST(:clientId AS uuid)
        )
      ), saved AS (
        INSERT INTO contacts (id, account_id, client_id, name, role, email, phone, location, kind,
          last_contact_at, estimated_value, currency, updated_at)
        SELECT COALESCE(CAST(:id AS uuid), gen_random_uuid()), :acc, CAST(:clientId AS uuid), :name, :role, :email,
          :phone, :location, CAST(:kind AS contact_kind), CAST(:lastContactAt AS timestamptz), :estimatedValue, upper(:currency), now()
        FROM valid_client
        ON CONFLICT (id) DO UPDATE SET client_id = EXCLUDED.client_id, name = EXCLUDED.name,
          role = EXCLUDED.role, email = EXCLUDED.email, phone = EXCLUDED.phone,
          location = EXCLUDED.location, kind = EXCLUDED.kind,
          last_contact_at = EXCLUDED.last_contact_at, estimated_value = EXCLUDED.estimated_value,
          currency = EXCLUDED.currency, updated_at = now()
        WHERE contacts.account_id = :acc
        RETURNING *
      ) SELECT ${CONTACT_COLS} FROM saved c`,
    params: { acc, userId, id: i.contactId ?? null, clientId: i.clientId ?? null,
      name: i.name, role: i.role ?? null, email: i.email ?? null, phone: i.phone ?? null,
      location: i.location ?? null, kind: i.kind ?? "LEAD", lastContactAt: i.lastContactAt ?? null,
      estimatedValue: i.estimatedValue ?? null, currency: i.currency ?? "USD" },
  };
}

export function deleteContact(acc: string, args: Args): SqlRequest {
  return { statement: `DELETE FROM contacts WHERE account_id = :acc AND id = :id RETURNING id AS "contactId"`, params: { acc, id: args.contactId } };
}

export function setContactFavorite(acc: string, args: Args, userId: string): SqlRequest {
  return {
    statement: args.favorite
      ? `WITH changed AS (
          INSERT INTO contact_favorites (account_id, contact_id, user_id)
          SELECT :acc, c.id, :userId FROM contacts c WHERE c.account_id = :acc AND c.id = :id
          ON CONFLICT (account_id, contact_id, user_id) DO NOTHING RETURNING contact_id
        ) SELECT ${CONTACT_COLS} FROM contacts c WHERE c.account_id = :acc AND c.id = :id`
      : `WITH changed AS (
          DELETE FROM contact_favorites WHERE account_id = :acc AND contact_id = :id AND user_id = :userId
          RETURNING contact_id
        ) SELECT ${CONTACT_COLS} FROM contacts c WHERE c.account_id = :acc AND c.id = :id`,
    params: { acc, id: args.contactId, userId },
  };
}

export function getOpportunity(acc: string, args: Args): SqlRequest {
  return { statement: `SELECT ${OPPORTUNITY_COLS} FROM opportunities o WHERE o.account_id = :acc AND o.id = :id`, params: { acc, id: args.opportunityId } };
}

export function listOpportunities(acc: string, args: Args): SqlRequest {
  const where = ["o.account_id = :acc"];
  const params: Record<string, unknown> = { acc, ...page(args) };
  if (args.stage) { where.push("o.stage = CAST(:stage AS opportunity_stage)"); params.stage = args.stage; }
  if (args.ownerUserId) { where.push("o.owner_user_id = :owner"); params.owner = args.ownerUserId; }
  if (args.source) { where.push("o.source = CAST(:source AS opportunity_source)"); params.source = args.source; }
  if (args.search) { where.push("o.title ILIKE :search"); params.search = `%${args.search}%`; }
  return { statement: `SELECT ${OPPORTUNITY_COLS} FROM opportunities o WHERE ${where.join(" AND ")} ORDER BY o.updated_at DESC, o.id DESC LIMIT :lim OFFSET :off`, params };
}

export function putOpportunity(acc: string, args: Args, userId: string): SqlRequest {
  const i = args.input;
  const valid = relationChecks("valid_refs", i, false);
  return {
    statement: `WITH ${valid.statement}, saved AS (
      INSERT INTO opportunities (id, account_id, client_id, contact_id, title, value, currency, stage,
        probability, owner_user_id, source, next_action, next_action_at, tags, closed_at, lost_reason, updated_at)
      SELECT COALESCE(CAST(:id AS uuid), gen_random_uuid()), :acc, CAST(:clientId AS uuid), CAST(:contactId AS uuid), :title,
        :value, upper(:currency), CAST(:stage AS opportunity_stage), :probability,
        COALESCE(:owner, :userId), CAST(:source AS opportunity_source),
        :nextAction, CAST(:nextActionAt AS timestamptz),
        ARRAY(SELECT jsonb_array_elements_text(CAST(:tags AS jsonb))),
        CASE WHEN CAST(:stage AS opportunity_stage) IN ('WON','LOST') THEN COALESCE(CAST(:closedAt AS timestamptz), now()) ELSE NULL END,
        CASE WHEN CAST(:stage AS opportunity_stage) = 'LOST' THEN :lostReason ELSE NULL END, now()
      FROM valid_refs
      ON CONFLICT (id) DO UPDATE SET client_id = EXCLUDED.client_id, contact_id = EXCLUDED.contact_id,
        title = EXCLUDED.title, value = EXCLUDED.value, currency = EXCLUDED.currency,
        stage = EXCLUDED.stage, probability = EXCLUDED.probability, owner_user_id = EXCLUDED.owner_user_id,
        source = EXCLUDED.source, next_action = EXCLUDED.next_action,
        next_action_at = EXCLUDED.next_action_at, tags = EXCLUDED.tags,
        closed_at = EXCLUDED.closed_at, lost_reason = EXCLUDED.lost_reason, updated_at = now()
      WHERE opportunities.account_id = :acc RETURNING *
    ) SELECT ${OPPORTUNITY_COLS} FROM saved o`,
    params: { acc, userId, ...valid.params, id: i.opportunityId ?? null, title: i.title,
      value: i.value, currency: i.currency ?? "USD", stage: i.stage ?? "LEAD",
      probability: i.probability ?? 0, owner: i.ownerUserId ?? null, source: i.source ?? "OTHER",
      nextAction: i.nextAction ?? null, nextActionAt: i.nextActionAt ?? null,
      tags: jsonArray(i.tags), closedAt: i.closedAt ?? null, lostReason: i.lostReason ?? null },
  };
}

export function deleteOpportunity(acc: string, args: Args): SqlRequest {
  return { statement: `DELETE FROM opportunities WHERE account_id = :acc AND id = :id RETURNING id AS "opportunityId"`, params: { acc, id: args.opportunityId } };
}

export function updateOpportunityStage(acc: string, args: Args): SqlRequest {
  return {
    statement: `UPDATE opportunities o SET stage = CAST(:stage AS opportunity_stage),
      probability = CASE CAST(:stage AS opportunity_stage) WHEN 'LEAD' THEN 15 WHEN 'QUALIFIED' THEN 35 WHEN 'PROPOSAL' THEN 60 WHEN 'NEGOTIATION' THEN 80 WHEN 'WON' THEN 100 ELSE probability END,
      closed_at = CASE WHEN CAST(:stage AS opportunity_stage) IN ('WON','LOST') THEN COALESCE(closed_at, now()) ELSE NULL END,
      lost_reason = CASE WHEN CAST(:stage AS opportunity_stage) = 'LOST' THEN lost_reason ELSE NULL END,
      updated_at = now()
      WHERE o.account_id = :acc AND o.id = :id RETURNING ${OPPORTUNITY_COLS}`,
    params: { acc, id: args.opportunityId, stage: args.stage },
  };
}

export function getProject(acc: string, args: Args): SqlRequest {
  return { statement: `SELECT ${PROJECT_COLS} FROM projects p WHERE p.account_id = :acc AND p.id = :id`, params: { acc, id: args.projectId } };
}

export function listProjects(acc: string, args: Args): SqlRequest {
  const where = ["p.account_id = :acc"];
  const params: Record<string, unknown> = { acc, ...page(args) };
  if (args.status) { where.push("p.status = CAST(:status AS project_status)"); params.status = args.status; }
  if (args.clientId) { where.push("p.client_id = :clientId"); params.clientId = args.clientId; }
  if (args.search) { where.push("(p.name ILIKE :search OR p.description ILIKE :search)"); params.search = `%${args.search}%`; }
  return { statement: `SELECT ${PROJECT_COLS} FROM projects p WHERE ${where.join(" AND ")} ORDER BY p.updated_at DESC, p.id DESC LIMIT :lim OFFSET :off`, params };
}

export function putProject(acc: string, args: Args, userId: string): SqlRequest {
  const i = args.input;
  return {
    statement: `WITH valid_refs AS (
      SELECT 1 WHERE EXISTS (SELECT 1 FROM clients c WHERE c.account_id = :acc AND c.id = :clientId)
        AND (CAST(:opportunityId AS uuid) IS NULL OR EXISTS (
          SELECT 1 FROM opportunities o WHERE o.account_id = :acc AND o.id = CAST(:opportunityId AS uuid)
            AND (o.client_id IS NULL OR o.client_id = :clientId)
        ))
    ), saved AS (
      INSERT INTO projects (id, account_id, client_id, opportunity_id, name, description, status,
        priority, progress, due_date, budget, spent, currency, owner_user_id, team_user_ids, updated_at)
      SELECT COALESCE(CAST(:id AS uuid), gen_random_uuid()), :acc, :clientId, CAST(:opportunityId AS uuid), :name,
        :description, CAST(:status AS project_status), CAST(:priority AS crm_priority),
        :progress, CAST(:dueDate AS date), :budget, :spent,
        upper(:currency), COALESCE(:owner, :userId),
        ARRAY(SELECT jsonb_array_elements_text(CAST(:team AS jsonb))), now() FROM valid_refs
      ON CONFLICT (id) DO UPDATE SET client_id = EXCLUDED.client_id,
        opportunity_id = EXCLUDED.opportunity_id, name = EXCLUDED.name,
        description = EXCLUDED.description, status = EXCLUDED.status, priority = EXCLUDED.priority,
        progress = EXCLUDED.progress, due_date = EXCLUDED.due_date, budget = EXCLUDED.budget,
        spent = EXCLUDED.spent, currency = EXCLUDED.currency,
        owner_user_id = EXCLUDED.owner_user_id, team_user_ids = EXCLUDED.team_user_ids, updated_at = now()
      WHERE projects.account_id = :acc RETURNING *
    ) SELECT ${PROJECT_COLS} FROM saved p`,
    params: { acc, userId, id: i.projectId ?? null, clientId: i.clientId,
      opportunityId: i.opportunityId ?? null, name: i.name, description: i.description ?? null,
      status: i.status ?? "PLANNING", priority: i.priority ?? "MEDIUM", progress: i.progress ?? 0,
      dueDate: i.dueDate ?? null, budget: i.budget ?? 0, spent: i.spent ?? 0,
      currency: i.currency ?? "USD", owner: i.ownerUserId ?? null, team: jsonArray(i.teamUserIds) },
  };
}

export function deleteProject(acc: string, args: Args): SqlRequest {
  return { statement: `DELETE FROM projects WHERE account_id = :acc AND id = :id RETURNING id AS "projectId"`, params: { acc, id: args.projectId } };
}

export function updateProjectStatus(acc: string, args: Args): SqlRequest {
  return {
    statement: `UPDATE projects p SET status = CAST(:status AS project_status),
      progress = CASE WHEN CAST(:status AS project_status) = 'COMPLETED' THEN 100 WHEN CAST(:status AS project_status) = 'REVIEW' THEN GREATEST(progress, 85) WHEN CAST(:status AS project_status) = 'IN_PROGRESS' THEN GREATEST(progress, 25) ELSE progress END,
      updated_at = now() WHERE p.account_id = :acc AND p.id = :id RETURNING ${PROJECT_COLS}`,
    params: { acc, id: args.projectId, status: args.status },
  };
}

export function getTask(acc: string, args: Args): SqlRequest {
  return { statement: `SELECT ${TASK_COLS} FROM crm_tasks t WHERE t.account_id = :acc AND t.id = :id`, params: { acc, id: args.taskId } };
}

export function listTasks(acc: string, args: Args): SqlRequest {
  const where = ["t.account_id = :acc"];
  const params: Record<string, unknown> = { acc, ...page(args) };
  if (args.status) { where.push("t.status = CAST(:status AS task_status)"); params.status = args.status; }
  if (args.ownerUserId) { where.push("t.owner_user_id = :owner"); params.owner = args.ownerUserId; }
  if (args.priority) { where.push("t.priority = CAST(:priority AS crm_priority)"); params.priority = args.priority; }
  if (args.dueFrom) { where.push("t.due_at >= CAST(:dueFrom AS timestamptz)"); params.dueFrom = args.dueFrom; }
  if (args.dueTo) { where.push("t.due_at <= CAST(:dueTo AS timestamptz)"); params.dueTo = args.dueTo; }
  if (args.search) { where.push("(t.title ILIKE :search OR t.description ILIKE :search)"); params.search = `%${args.search}%`; }
  return { statement: `SELECT ${TASK_COLS} FROM crm_tasks t WHERE ${where.join(" AND ")} ORDER BY t.due_at NULLS LAST, t.id LIMIT :lim OFFSET :off`, params };
}

export function putTask(acc: string, args: Args, userId: string): SqlRequest {
  const i = args.input;
  const valid = relationChecks("valid_refs", i);
  const status = i.status ?? "PENDING";
  return {
    statement: `WITH ${valid.statement}, saved AS (
      INSERT INTO crm_tasks (id, account_id, title, description, due_at, priority, kind, status,
        owner_user_id, completed_at, client_id, contact_id, opportunity_id, project_id, updated_at)
      SELECT COALESCE(CAST(:id AS uuid), gen_random_uuid()), :acc, :title, :description, CAST(:dueAt AS timestamptz),
        CAST(:priority AS crm_priority), CAST(:kind AS task_kind), CAST(:status AS task_status),
        COALESCE(:owner, :userId),
        CASE WHEN CAST(:status AS task_status) = 'COMPLETED' THEN COALESCE(CAST(:completedAt AS timestamptz), now()) ELSE NULL END,
        CAST(:clientId AS uuid), CAST(:contactId AS uuid), CAST(:opportunityId AS uuid), CAST(:projectId AS uuid), now()
      FROM valid_refs
      ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description,
        due_at = EXCLUDED.due_at, priority = EXCLUDED.priority, kind = EXCLUDED.kind,
        status = EXCLUDED.status, owner_user_id = EXCLUDED.owner_user_id,
        completed_at = EXCLUDED.completed_at, client_id = EXCLUDED.client_id,
        contact_id = EXCLUDED.contact_id, opportunity_id = EXCLUDED.opportunity_id,
        project_id = EXCLUDED.project_id, updated_at = now()
      WHERE crm_tasks.account_id = :acc RETURNING *
    ) SELECT ${TASK_COLS} FROM saved t`,
    params: { acc, userId, ...valid.params, id: i.taskId ?? null, title: i.title,
      description: i.description ?? null, dueAt: i.dueAt ?? null, priority: i.priority ?? "MEDIUM",
      kind: i.kind ?? "FOLLOW_UP", status, owner: i.ownerUserId ?? null,
      completedAt: i.completedAt ?? null },
  };
}

export function deleteTask(acc: string, args: Args): SqlRequest {
  return { statement: `DELETE FROM crm_tasks WHERE account_id = :acc AND id = :id RETURNING id AS "taskId"`, params: { acc, id: args.taskId } };
}

export function setTaskCompleted(acc: string, args: Args): SqlRequest {
  return {
    statement: `UPDATE crm_tasks t SET status = CASE WHEN :completed THEN 'COMPLETED'::task_status ELSE 'PENDING'::task_status END,
      completed_at = CASE WHEN :completed THEN now() ELSE NULL END, updated_at = now()
      WHERE t.account_id = :acc AND t.id = :id RETURNING ${TASK_COLS}`,
    params: { acc, id: args.taskId, completed: Boolean(args.completed) },
  };
}

export function getCalendarEvent(acc: string, args: Args): SqlRequest {
  return { statement: `SELECT ${EVENT_COLS} FROM calendar_events e WHERE e.account_id = :acc AND e.id = :id`, params: { acc, id: args.eventId } };
}

export function listCalendarEvents(acc: string, args: Args): SqlRequest {
  const where = ["e.account_id = :acc", "e.starts_at < CAST(:to AS timestamptz)", "e.ends_at > CAST(:from AS timestamptz)"];
  const params: Record<string, unknown> = { acc, from: args.from, to: args.to, ...page(args) };
  if (args.ownerUserId) { where.push("e.owner_user_id = :owner"); params.owner = args.ownerUserId; }
  if (args.eventType) { where.push("e.event_type = CAST(:eventType AS calendar_event_type)"); params.eventType = args.eventType; }
  return { statement: `SELECT ${EVENT_COLS} FROM calendar_events e WHERE ${where.join(" AND ")} ORDER BY e.starts_at, e.id LIMIT :lim OFFSET :off`, params };
}

export function putCalendarEvent(acc: string, args: Args, userId: string): SqlRequest {
  const i = args.input;
  const valid = relationChecks("valid_refs", i, false);
  return {
    statement: `WITH ${valid.statement}, saved AS (
      INSERT INTO calendar_events (id, account_id, title, description, starts_at, ends_at, timezone,
        all_day, event_type, owner_user_id, location, client_id, contact_id, opportunity_id, project_id, updated_at)
      SELECT COALESCE(CAST(:id AS uuid), gen_random_uuid()), :acc, :title, :description, CAST(:startsAt AS timestamptz),
        CAST(:endsAt AS timestamptz), :timezone, :allDay,
        CAST(:eventType AS calendar_event_type), COALESCE(:owner, :userId), :location,
        CAST(:clientId AS uuid), CAST(:contactId AS uuid), CAST(:opportunityId AS uuid), CAST(:projectId AS uuid), now() FROM valid_refs
      ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description,
        starts_at = EXCLUDED.starts_at, ends_at = EXCLUDED.ends_at, timezone = EXCLUDED.timezone,
        all_day = EXCLUDED.all_day, event_type = EXCLUDED.event_type,
        owner_user_id = EXCLUDED.owner_user_id, location = EXCLUDED.location,
        client_id = EXCLUDED.client_id, contact_id = EXCLUDED.contact_id,
        opportunity_id = EXCLUDED.opportunity_id, project_id = EXCLUDED.project_id, updated_at = now()
      WHERE calendar_events.account_id = :acc RETURNING *
    ) SELECT ${EVENT_COLS} FROM saved e`,
    params: { acc, userId, ...valid.params, id: i.eventId ?? null, title: i.title,
      description: i.description ?? null, startsAt: i.startsAt, endsAt: i.endsAt,
      timezone: i.timezone ?? "UTC", allDay: Boolean(i.allDay), eventType: i.eventType ?? "MEETING",
      owner: i.ownerUserId ?? null, location: i.location ?? null },
  };
}

export function deleteCalendarEvent(acc: string, args: Args): SqlRequest {
  return { statement: `DELETE FROM calendar_events WHERE account_id = :acc AND id = :id RETURNING id AS "eventId"`, params: { acc, id: args.eventId } };
}

export function getPayment(acc: string, args: Args): SqlRequest {
  return { statement: `SELECT ${PAYMENT_COLS} FROM payments p WHERE p.account_id = :acc AND p.id = :id`, params: { acc, id: args.paymentId } };
}

export function listPayments(acc: string, args: Args): SqlRequest {
  const where = ["p.account_id = :acc"];
  const params: Record<string, unknown> = { acc, ...page(args) };
  if (args.status) { where.push("p.status = CAST(:status AS payment_status)"); params.status = args.status; }
  if (args.invoiceId) { where.push("p.invoice_id = :invoiceId"); params.invoiceId = args.invoiceId; }
  if (args.method) { where.push("p.method = CAST(:method AS payment_method)"); params.method = args.method; }
  return { statement: `SELECT ${PAYMENT_COLS} FROM payments p WHERE ${where.join(" AND ")} ORDER BY p.received_at DESC, p.id DESC LIMIT :lim OFFSET :off`, params };
}

export function registerPayment(acc: string, args: Args): SqlRequest {
  const i = args.input;
  return {
    // Locking the invoice serializes payments with invoice edits: a payment that
    // waits behind a currency change re-checks the new currency, and bumping the
    // version makes any edit opened before this payment stale.
    statement: `WITH target_invoice AS (
      SELECT i.id, i.currency FROM invoices i
      WHERE i.account_id = :acc AND i.id = :invoiceId
        AND upper(i.currency) = upper(COALESCE(:currency, i.currency))
      FOR UPDATE
    ), bumped AS (
      UPDATE invoices SET version = version + 1 WHERE id IN (SELECT id FROM target_invoice)
      RETURNING id
    ), saved AS (
      INSERT INTO payments (account_id, invoice_id, bank_account_id, amount, currency, method,
        status, received_at, reference, notes, updated_at)
      SELECT :acc, ti.id, CAST(:bankAccountId AS uuid), :amount, upper(ti.currency),
        CAST(:method AS payment_method),
        'UNRECONCILED', COALESCE(CAST(:receivedAt AS timestamptz), now()), :reference, :notes, now()
      FROM target_invoice ti
      WHERE CAST(:bankAccountId AS uuid) IS NULL OR EXISTS (
        SELECT 1 FROM bank_accounts b WHERE b.account_id = :acc AND b.id = CAST(:bankAccountId AS uuid)
      )
      ON CONFLICT (account_id, reference) DO UPDATE SET updated_at = payments.updated_at
      WHERE payments.invoice_id = EXCLUDED.invoice_id
        AND payments.amount = EXCLUDED.amount
        AND payments.currency = EXCLUDED.currency
        AND payments.method = EXCLUDED.method
      RETURNING *
    ) SELECT ${PAYMENT_COLS} FROM saved p`,
    params: { acc, invoiceId: i.invoiceId, bankAccountId: i.bankAccountId ?? null,
      amount: i.amount, currency: i.currency ?? null, method: i.method,
      receivedAt: i.receivedAt ?? null, reference: i.reference, notes: i.notes ?? null },
  };
}

export function voidPayment(acc: string, args: Args, userId: string): SqlRequest {
  return {
    statement: `UPDATE payments p SET status = 'VOIDED', voided_at = now(), voided_by = :userId,
      void_reason = :reason, updated_at = now()
      WHERE p.account_id = :acc AND p.id = :id AND p.status <> 'VOIDED'
        AND NOT EXISTS (SELECT 1 FROM payment_reconciliations r
          WHERE r.account_id = :acc AND r.payment_id = p.id AND r.reversed_at IS NULL)
      RETURNING ${PAYMENT_COLS}`,
    params: { acc, id: args.paymentId, userId, reason: args.reason },
  };
}

export function putBankMovement(acc: string, args: Args): SqlRequest {
  const i = args.input;
  return {
    statement: `WITH existing AS (
      SELECT id FROM bank_movements
      WHERE account_id = :acc
        AND bank_account_id IS NOT DISTINCT FROM CAST(:bankAccountId AS uuid)
        AND external_id = :externalId
    ), saved AS (
      INSERT INTO bank_movements (id, account_id, bank_account_id, external_id, description,
        reference, amount, currency, booked_on, value_on, raw_payload, updated_at)
      SELECT COALESCE((SELECT id FROM existing), CAST(:id AS uuid), gen_random_uuid()), :acc, CAST(:bankAccountId AS uuid), :externalId,
        :description, :reference, :amount, upper(:currency), CAST(:bookedOn AS date), CAST(:valueOn AS date),
        CAST(:rawPayload AS jsonb), now()
      WHERE CAST(:bankAccountId AS uuid) IS NULL OR EXISTS (
        SELECT 1 FROM bank_accounts b WHERE b.account_id = :acc AND b.id = CAST(:bankAccountId AS uuid)
      )
      ON CONFLICT (id) DO UPDATE SET updated_at = bank_movements.updated_at
      WHERE bank_movements.account_id = :acc
        AND bank_movements.bank_account_id IS NOT DISTINCT FROM EXCLUDED.bank_account_id
        AND bank_movements.external_id IS NOT DISTINCT FROM EXCLUDED.external_id
        AND bank_movements.description = EXCLUDED.description
        AND bank_movements.reference IS NOT DISTINCT FROM EXCLUDED.reference
        AND bank_movements.amount = EXCLUDED.amount
        AND bank_movements.currency = EXCLUDED.currency
        AND bank_movements.booked_on = EXCLUDED.booked_on
        AND bank_movements.value_on IS NOT DISTINCT FROM EXCLUDED.value_on
        AND bank_movements.raw_payload IS NOT DISTINCT FROM EXCLUDED.raw_payload
      RETURNING *
    ) SELECT s.id AS "movementId", s.account_id AS "accountId", s.bank_account_id AS "bankAccountId",
      s.external_id AS "externalId", s.description, s.reference, s.amount, s.currency,
      s.booked_on AS "bookedOn", s.value_on AS "valueOn",
      (s.amount > 0 AND COALESCE(r.allocated, 0) >= s.amount) AS reconciled,
      COALESCE(r.allocated, 0) AS "allocatedAmount",
      s.created_at AS "createdAt", s.updated_at AS "updatedAt"
      FROM saved s
      LEFT JOIN LATERAL (
        SELECT sum(pr.allocated_amount) AS allocated FROM payment_reconciliations pr
        WHERE pr.account_id = s.account_id AND pr.bank_movement_id = s.id
          AND pr.reversed_at IS NULL
      ) r ON true`,
    params: { acc, id: i.movementId ?? null, bankAccountId: i.bankAccountId ?? null,
      externalId: i.externalId ?? null, description: i.description, reference: i.reference ?? null,
      amount: i.amount, currency: i.currency ?? "USD", bookedOn: i.bookedOn,
      valueOn: i.valueOn ?? null,
      rawPayload: i.rawPayload === null || i.rawPayload === undefined
        ? null
        : typeof i.rawPayload === "string" ? i.rawPayload : JSON.stringify(i.rawPayload) },
  };
}

export function listBankMovements(acc: string, args: Args): SqlRequest {
  const reconciledFilter = args.reconciled === true
    ? "AND m.amount > 0 AND COALESCE(r.allocated, 0) >= m.amount"
    : args.reconciled === false ? "AND (m.amount <= 0 OR COALESCE(r.allocated, 0) < m.amount)" : "";
  return {
    statement: `SELECT m.id AS "movementId", m.account_id AS "accountId",
      m.bank_account_id AS "bankAccountId", m.external_id AS "externalId", m.description,
      m.reference, m.amount, m.currency, m.booked_on AS "bookedOn", m.value_on AS "valueOn",
      (m.amount > 0 AND COALESCE(r.allocated, 0) >= m.amount) AS reconciled,
      COALESCE(r.allocated, 0) AS "allocatedAmount",
      m.created_at AS "createdAt", m.updated_at AS "updatedAt"
      FROM bank_movements m
      LEFT JOIN LATERAL (
        SELECT sum(pr.allocated_amount) AS allocated FROM payment_reconciliations pr
        WHERE pr.account_id = m.account_id AND pr.bank_movement_id = m.id AND pr.reversed_at IS NULL
      ) r ON true
      WHERE m.account_id = :acc
        AND (CAST(:bankAccountId AS uuid) IS NULL OR m.bank_account_id = CAST(:bankAccountId AS uuid))
        ${reconciledFilter}
      ORDER BY m.booked_on DESC, m.id DESC LIMIT :lim OFFSET :off`,
    params: { acc, bankAccountId: args.bankAccountId ?? null, ...page(args) },
  };
}

export function reconcilePayment(acc: string, args: Args, userId: string): SqlRequest {
  return {
    statement: `WITH locked_payment AS (
      SELECT p.* FROM payments p WHERE p.account_id = :acc AND p.id = :paymentId FOR UPDATE
    ), locked_movement AS (
      SELECT m.* FROM bank_movements m WHERE m.account_id = :acc AND m.id = :movementId FOR UPDATE
    ), remaining AS (
      SELECT p.id AS payment_id, m.id AS movement_id,
        p.amount - COALESCE((SELECT sum(r.allocated_amount) FROM payment_reconciliations r
          WHERE r.account_id = :acc AND r.payment_id = p.id AND r.reversed_at IS NULL), 0) AS payment_remaining,
        m.amount - COALESCE((SELECT sum(r.allocated_amount) FROM payment_reconciliations r
          WHERE r.account_id = :acc AND r.bank_movement_id = m.id AND r.reversed_at IS NULL), 0) AS movement_remaining
      FROM locked_payment p CROSS JOIN locked_movement m
      WHERE p.status <> 'VOIDED' AND upper(p.currency) = upper(m.currency) AND m.amount > 0
    ), existing AS (
      SELECT r.payment_id FROM payment_reconciliations r
      WHERE r.account_id = :acc AND r.payment_id = :paymentId AND r.bank_movement_id = :movementId
        AND r.reversed_at IS NULL
    ), inserted AS (
      INSERT INTO payment_reconciliations (account_id, payment_id, bank_movement_id,
        allocated_amount, reconciled_by)
      SELECT :acc, payment_id, movement_id,
        COALESCE(:allocatedAmount, LEAST(payment_remaining, movement_remaining)), :userId
      FROM remaining WHERE payment_remaining > 0 AND movement_remaining > 0
        AND COALESCE(:allocatedAmount, LEAST(payment_remaining, movement_remaining)) > 0
        AND COALESCE(:allocatedAmount, LEAST(payment_remaining, movement_remaining))
          <= LEAST(payment_remaining, movement_remaining)
        AND NOT EXISTS (SELECT 1 FROM existing)
      ON CONFLICT DO NOTHING RETURNING payment_id, allocated_amount
    ), target AS (
      SELECT payment_id, 0::numeric AS new_allocation FROM existing
      UNION ALL
      SELECT payment_id, allocated_amount AS new_allocation FROM inserted
    ) SELECT ${PAYMENT_COLS_BEFORE_STATUS},
      CASE WHEN COALESCE((SELECT sum(r.allocated_amount) FROM payment_reconciliations r
        WHERE r.account_id = :acc AND r.payment_id = p.id AND r.reversed_at IS NULL), 0)
          + target.new_allocation >= p.amount
        THEN 'RECONCILED'::payment_status ELSE 'UNRECONCILED'::payment_status END AS status,
      ${PAYMENT_COLS_AFTER_STATUS},
      CASE WHEN target.new_allocation > 0 THEN now() ELSE p.updated_at END AS "updatedAt"
      FROM payments p JOIN target ON target.payment_id = p.id
      WHERE p.account_id = :acc`,
    params: { acc, paymentId: args.paymentId, movementId: args.movementId,
      allocatedAmount: args.allocatedAmount ?? null, userId },
  };
}

export function undoReconciliation(acc: string, args: Args, userId: string): SqlRequest {
  return {
    statement: `WITH reversed AS (
      UPDATE payment_reconciliations SET reversed_at = now(), reversed_by = :userId,
        reversal_reason = :reason, updated_at = now()
      WHERE account_id = :acc AND payment_id = :paymentId AND bank_movement_id = :movementId
        AND reversed_at IS NULL RETURNING id AS reconciliation_id, payment_id
    ) SELECT ${PAYMENT_COLS_BEFORE_STATUS},
      CASE WHEN COALESCE((SELECT sum(active.allocated_amount)
        FROM payment_reconciliations active
        WHERE active.account_id = :acc AND active.payment_id = p.id
          AND active.reversed_at IS NULL AND active.id <> r.reconciliation_id), 0) >= p.amount
        THEN 'RECONCILED'::payment_status ELSE 'UNRECONCILED'::payment_status END AS status,
      ${PAYMENT_COLS_AFTER_STATUS}, now() AS "updatedAt"
      FROM payments p JOIN reversed r ON r.payment_id = p.id
      WHERE p.account_id = :acc`,
    params: { acc, paymentId: args.paymentId, movementId: args.movementId,
      userId, reason: args.reason },
  };
}

export function getCrmSummary(acc: string): SqlRequest {
  return {
    statement: `SELECT
      (SELECT count(*)::int FROM clients WHERE account_id = :acc) AS "totalClients",
      (SELECT count(*)::int FROM contacts WHERE account_id = :acc) AS "activeContacts",
      (SELECT count(*)::int FROM opportunities WHERE account_id = :acc AND stage NOT IN ('WON','LOST')) AS "openOpportunities",
      (SELECT COALESCE(sum(value),0) FROM opportunities WHERE account_id = :acc AND stage NOT IN ('WON','LOST') AND upper(currency) = 'USD') AS "openPipelineValue",
      (SELECT COALESCE(sum(value * probability / 100.0),0) FROM opportunities WHERE account_id = :acc AND stage NOT IN ('WON','LOST') AND upper(currency) = 'USD') AS "weightedPipelineValue",
      (SELECT count(*)::int FROM projects WHERE account_id = :acc AND status IN ('PLANNING','IN_PROGRESS','REVIEW')) AS "activeProjects",
      (SELECT count(*)::int FROM crm_tasks WHERE account_id = :acc AND status = 'PENDING') AS "pendingTasks",
      (SELECT count(*)::int FROM crm_tasks WHERE account_id = :acc AND status = 'PENDING' AND due_at < now()) AS "overdueTasks",
      (SELECT count(*)::int FROM payments WHERE account_id = :acc AND status = 'UNRECONCILED') AS "unreconciledPayments",
      (SELECT COALESCE(sum(p.amount - COALESCE((SELECT sum(r.allocated_amount)
        FROM payment_reconciliations r WHERE r.account_id = p.account_id
          AND r.payment_id = p.id AND r.reversed_at IS NULL), 0)), 0)
        FROM payments p WHERE p.account_id = :acc AND p.status = 'UNRECONCILED'
          AND upper(p.currency) = 'USD') AS "unreconciledAmount",
      (SELECT COALESCE(sum(i.grand_total), 0) FROM invoices i
        WHERE i.account_id = :acc AND upper(i.currency) = 'USD'
          AND i.date >= date_trunc('month', current_date)::date) AS "invoicedAmount",
      (SELECT COALESCE(sum(p.amount), 0) FROM payments p
        WHERE p.account_id = :acc AND p.status = 'RECONCILED' AND upper(p.currency) = 'USD'
          AND p.received_at >= date_trunc('month', now())) AS "collectedAmount",
      (SELECT COALESCE(sum(GREATEST(i.grand_total - COALESCE((
        SELECT sum(p.amount) FROM payments p WHERE p.account_id = i.account_id
          AND p.invoice_id = i.id AND p.status = 'RECONCILED'
      ), 0), 0)), 0) FROM invoices i
        WHERE i.account_id = :acc AND upper(i.currency) = 'USD' AND i.status <> 'PAID') AS "outstandingAmount",
      (SELECT COALESCE(sum(GREATEST(i.grand_total - COALESCE((
        SELECT sum(p.amount) FROM payments p WHERE p.account_id = i.account_id
          AND p.invoice_id = i.id AND p.status = 'RECONCILED'
      ), 0), 0)), 0) FROM invoices i
        WHERE i.account_id = :acc AND upper(i.currency) = 'USD' AND i.status <> 'PAID'
          AND i.due_date < current_date) AS "overdueAmount",
      (SELECT CASE WHEN count(*) FILTER (WHERE stage IN ('WON','LOST')) = 0 THEN 0
        ELSE (count(*) FILTER (WHERE stage = 'WON') * 100.0 /
          count(*) FILTER (WHERE stage IN ('WON','LOST'))) END
        FROM opportunities WHERE account_id = :acc) AS "conversionRate",
      (SELECT CASE WHEN COALESCE(sum(budget),0) = 0 THEN 0
        ELSE GREATEST((sum(budget) - sum(spent)) * 100.0 / sum(budget), 0) END
        FROM projects WHERE account_id = :acc AND upper(currency) = 'USD') AS "grossMargin",
      'USD' AS currency`,
    params: { acc },
  };
}




export function searchWorkspace(acc: string, args: Args): SqlRequest {
  const term = `%${String(args.query ?? "").trim()}%`;
  return {
    statement: `SELECT * FROM (
      SELECT 'CLIENT' AS "entityType", id AS "entityId", name AS title, COALESCE(industry, email) AS subtitle, updated_at FROM clients WHERE account_id = :acc AND name ILIKE :term
      UNION ALL SELECT 'CONTACT', id, name, COALESCE(role, email), updated_at FROM contacts WHERE account_id = :acc AND (name ILIKE :term OR email ILIKE :term)
      UNION ALL SELECT 'OPPORTUNITY', id, title, stage::text, updated_at FROM opportunities WHERE account_id = :acc AND title ILIKE :term
      UNION ALL SELECT 'PROJECT', id, name, status::text, updated_at FROM projects WHERE account_id = :acc AND name ILIKE :term
      UNION ALL SELECT 'TASK', id, title, status::text, updated_at FROM crm_tasks WHERE account_id = :acc AND title ILIKE :term
      UNION ALL SELECT 'CALENDAR_EVENT', id, title, event_type::text, updated_at FROM calendar_events WHERE account_id = :acc AND title ILIKE :term
      UNION ALL SELECT 'INVOICE', id, 'Factura #' || ${invoiceNumberLabel()}, bill_to_name, updated_at FROM invoices WHERE account_id = :acc AND (bill_to_name ILIKE :term OR project ILIKE :term OR ${invoiceNumberLabel()} ILIKE :term)
      UNION ALL SELECT 'PAYMENT', id, reference, status::text, updated_at FROM payments WHERE account_id = :acc AND reference ILIKE :term
    ) results ORDER BY updated_at DESC, "entityId" DESC LIMIT :lim OFFSET :off`,
    params: { acc, term, ...page(args) },
  };
}
