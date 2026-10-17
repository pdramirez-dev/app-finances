DO $$ BEGIN
  CREATE TYPE client_status AS ENUM ('ACTIVE', 'PROSPECT', 'INACTIVE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE contact_kind AS ENUM ('CLIENT', 'LEAD', 'PARTNER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE opportunity_stage AS ENUM ('LEAD', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE opportunity_source AS ENUM ('REFERRAL', 'WEB', 'EVENT', 'OUTBOUND', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE crm_priority AS ENUM ('HIGH', 'MEDIUM', 'LOW');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE project_status AS ENUM ('PLANNING', 'IN_PROGRESS', 'REVIEW', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE task_kind AS ENUM ('CALL', 'EMAIL', 'MEETING', 'FOLLOW_UP');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE task_status AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE calendar_event_type AS ENUM ('MEETING', 'CALL', 'FOLLOW_UP', 'DELIVERY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM ('BANK_TRANSFER', 'CARD', 'ACH', 'CHECK', 'CASH', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('UNRECONCILED', 'RECONCILED', 'VOIDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS industry text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS status client_status NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS owner_user_id text,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS notes text;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS due_date date;

DO $$ BEGIN
  ALTER TABLE bank_accounts
    ADD CONSTRAINT bank_accounts_account_id_id_unique UNIQUE (account_id, id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE invoices
    ADD CONSTRAINT invoices_account_id_id_unique UNIQUE (account_id, id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  client_id uuid,
  name text NOT NULL,
  role text,
  email text,
  phone text,
  location text,
  kind contact_kind NOT NULL DEFAULT 'LEAD',
  last_contact_at timestamptz,
  estimated_value numeric(14,2),
  currency text NOT NULL DEFAULT 'USD',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contacts_account_id_id_unique UNIQUE (account_id, id),
  CONSTRAINT contacts_account_client_fk FOREIGN KEY (account_id, client_id)
    REFERENCES clients (account_id, id) ON DELETE RESTRICT,
  CONSTRAINT contacts_name_not_blank CHECK (btrim(name) <> ''),
  CONSTRAINT contacts_estimated_value_nonnegative CHECK (estimated_value IS NULL OR estimated_value >= 0),
  CONSTRAINT contacts_currency_iso_length CHECK (char_length(currency) = 3)
);
CREATE INDEX IF NOT EXISTS contacts_by_account_kind_name
  ON contacts (account_id, kind, lower(name));
CREATE INDEX IF NOT EXISTS contacts_by_account_client
  ON contacts (account_id, client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS contacts_by_account_email
  ON contacts (account_id, lower(email)) WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS contact_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL,
  user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contact_favorites_account_id_id_unique UNIQUE (account_id, id),
  CONSTRAINT contact_favorites_account_contact_user_unique UNIQUE (account_id, contact_id, user_id),
  CONSTRAINT contact_favorites_account_contact_fk FOREIGN KEY (account_id, contact_id)
    REFERENCES contacts (account_id, id) ON DELETE CASCADE,
  CONSTRAINT contact_favorites_user_not_blank CHECK (btrim(user_id) <> '')
);
CREATE INDEX IF NOT EXISTS contact_favorites_by_account_user
  ON contact_favorites (account_id, user_id, contact_id);

CREATE TABLE IF NOT EXISTS opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  client_id uuid,
  contact_id uuid,
  title text NOT NULL,
  value numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  stage opportunity_stage NOT NULL DEFAULT 'LEAD',
  probability smallint NOT NULL DEFAULT 0,
  owner_user_id text,
  source opportunity_source NOT NULL DEFAULT 'OTHER',
  next_action text,
  next_action_at timestamptz,
  tags text[] NOT NULL DEFAULT '{}',
  closed_at timestamptz,
  lost_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT opportunities_account_id_id_unique UNIQUE (account_id, id),
  CONSTRAINT opportunities_account_client_fk FOREIGN KEY (account_id, client_id)
    REFERENCES clients (account_id, id) ON DELETE RESTRICT,
  CONSTRAINT opportunities_account_contact_fk FOREIGN KEY (account_id, contact_id)
    REFERENCES contacts (account_id, id) ON DELETE RESTRICT,
  CONSTRAINT opportunities_title_not_blank CHECK (btrim(title) <> ''),
  CONSTRAINT opportunities_value_nonnegative CHECK (value >= 0),
  CONSTRAINT opportunities_probability_range CHECK (probability BETWEEN 0 AND 100),
  CONSTRAINT opportunities_currency_iso_length CHECK (char_length(currency) = 3),
  CONSTRAINT opportunities_lost_reason_stage CHECK (lost_reason IS NULL OR stage = 'LOST')
);
CREATE INDEX IF NOT EXISTS opportunities_by_account_stage_updated
  ON opportunities (account_id, stage, updated_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS opportunities_by_account_owner_stage
  ON opportunities (account_id, owner_user_id, stage) WHERE owner_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS opportunities_by_account_next_action
  ON opportunities (account_id, next_action_at)
  WHERE next_action_at IS NOT NULL AND stage NOT IN ('WON', 'LOST');
CREATE INDEX IF NOT EXISTS opportunities_by_account_client
  ON opportunities (account_id, client_id) WHERE client_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  opportunity_id uuid,
  name text NOT NULL,
  description text,
  status project_status NOT NULL DEFAULT 'PLANNING',
  priority crm_priority NOT NULL DEFAULT 'MEDIUM',
  progress smallint NOT NULL DEFAULT 0,
  due_date date,
  budget numeric(14,2) NOT NULL DEFAULT 0,
  spent numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  owner_user_id text,
  team_user_ids text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT projects_account_id_id_unique UNIQUE (account_id, id),
  CONSTRAINT projects_account_client_fk FOREIGN KEY (account_id, client_id)
    REFERENCES clients (account_id, id) ON DELETE RESTRICT,
  CONSTRAINT projects_account_opportunity_fk FOREIGN KEY (account_id, opportunity_id)
    REFERENCES opportunities (account_id, id) ON DELETE RESTRICT,
  CONSTRAINT projects_name_not_blank CHECK (btrim(name) <> ''),
  CONSTRAINT projects_progress_range CHECK (progress BETWEEN 0 AND 100),
  CONSTRAINT projects_budget_nonnegative CHECK (budget >= 0),
  CONSTRAINT projects_spent_nonnegative CHECK (spent >= 0),
  CONSTRAINT projects_currency_iso_length CHECK (char_length(currency) = 3)
);
CREATE INDEX IF NOT EXISTS projects_by_account_status_due
  ON projects (account_id, status, due_date, id);
CREATE INDEX IF NOT EXISTS projects_by_account_client
  ON projects (account_id, client_id);
CREATE INDEX IF NOT EXISTS projects_by_account_owner_status
  ON projects (account_id, owner_user_id, status) WHERE owner_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS crm_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  due_at timestamptz,
  priority crm_priority NOT NULL DEFAULT 'MEDIUM',
  kind task_kind NOT NULL DEFAULT 'FOLLOW_UP',
  status task_status NOT NULL DEFAULT 'PENDING',
  owner_user_id text,
  completed_at timestamptz,
  client_id uuid,
  contact_id uuid,
  opportunity_id uuid,
  project_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_tasks_account_id_id_unique UNIQUE (account_id, id),
  CONSTRAINT crm_tasks_account_client_fk FOREIGN KEY (account_id, client_id)
    REFERENCES clients (account_id, id) ON DELETE RESTRICT,
  CONSTRAINT crm_tasks_account_contact_fk FOREIGN KEY (account_id, contact_id)
    REFERENCES contacts (account_id, id) ON DELETE RESTRICT,
  CONSTRAINT crm_tasks_account_opportunity_fk FOREIGN KEY (account_id, opportunity_id)
    REFERENCES opportunities (account_id, id) ON DELETE RESTRICT,
  CONSTRAINT crm_tasks_account_project_fk FOREIGN KEY (account_id, project_id)
    REFERENCES projects (account_id, id) ON DELETE RESTRICT,
  CONSTRAINT crm_tasks_title_not_blank CHECK (btrim(title) <> ''),
  CONSTRAINT crm_tasks_completed_at_status CHECK (
    (status = 'COMPLETED' AND completed_at IS NOT NULL)
    OR (status <> 'COMPLETED' AND completed_at IS NULL)
  )
);
CREATE INDEX IF NOT EXISTS crm_tasks_by_account_status_due
  ON crm_tasks (account_id, status, due_at, id);
CREATE INDEX IF NOT EXISTS crm_tasks_by_account_owner_due_pending
  ON crm_tasks (account_id, owner_user_id, due_at, id) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS crm_tasks_by_account_project
  ON crm_tasks (account_id, project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS crm_tasks_by_account_opportunity
  ON crm_tasks (account_id, opportunity_id) WHERE opportunity_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  timezone text NOT NULL DEFAULT 'UTC',
  all_day boolean NOT NULL DEFAULT false,
  event_type calendar_event_type NOT NULL DEFAULT 'MEETING',
  owner_user_id text,
  location text,
  client_id uuid,
  contact_id uuid,
  opportunity_id uuid,
  project_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT calendar_events_account_id_id_unique UNIQUE (account_id, id),
  CONSTRAINT calendar_events_account_client_fk FOREIGN KEY (account_id, client_id)
    REFERENCES clients (account_id, id) ON DELETE RESTRICT,
  CONSTRAINT calendar_events_account_contact_fk FOREIGN KEY (account_id, contact_id)
    REFERENCES contacts (account_id, id) ON DELETE RESTRICT,
  CONSTRAINT calendar_events_account_opportunity_fk FOREIGN KEY (account_id, opportunity_id)
    REFERENCES opportunities (account_id, id) ON DELETE RESTRICT,
  CONSTRAINT calendar_events_account_project_fk FOREIGN KEY (account_id, project_id)
    REFERENCES projects (account_id, id) ON DELETE RESTRICT,
  CONSTRAINT calendar_events_title_not_blank CHECK (btrim(title) <> ''),
  CONSTRAINT calendar_events_valid_range CHECK (ends_at > starts_at),
  CONSTRAINT calendar_events_timezone_not_blank CHECK (btrim(timezone) <> '')
);
CREATE INDEX IF NOT EXISTS calendar_events_by_account_range
  ON calendar_events (account_id, starts_at, ends_at, id);
CREATE INDEX IF NOT EXISTS calendar_events_by_account_owner_start
  ON calendar_events (account_id, owner_user_id, starts_at, id) WHERE owner_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL,
  bank_account_id uuid,
  amount numeric(14,2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  method payment_method NOT NULL,
  status payment_status NOT NULL DEFAULT 'UNRECONCILED',
  received_at timestamptz NOT NULL DEFAULT now(),
  reference text NOT NULL,
  notes text,
  voided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payments_account_id_id_unique UNIQUE (account_id, id),
  CONSTRAINT payments_account_invoice_fk FOREIGN KEY (account_id, invoice_id)
    REFERENCES invoices (account_id, id) ON DELETE RESTRICT,
  CONSTRAINT payments_account_bank_account_fk FOREIGN KEY (account_id, bank_account_id)
    REFERENCES bank_accounts (account_id, id) ON DELETE RESTRICT,
  CONSTRAINT payments_amount_positive CHECK (amount > 0),
  CONSTRAINT payments_currency_iso_length CHECK (char_length(currency) = 3),
  CONSTRAINT payments_reference_not_blank CHECK (btrim(reference) <> ''),
  CONSTRAINT payments_voided_at_status CHECK (
    (status = 'VOIDED' AND voided_at IS NOT NULL)
    OR (status <> 'VOIDED' AND voided_at IS NULL)
  )
);
CREATE INDEX IF NOT EXISTS payments_by_account_status_received
  ON payments (account_id, status, received_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS payments_by_account_invoice
  ON payments (account_id, invoice_id, received_at DESC);
CREATE INDEX IF NOT EXISTS payments_by_account_reference
  ON payments (account_id, reference);

CREATE TABLE IF NOT EXISTS bank_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  bank_account_id uuid,
  external_id text,
  description text NOT NULL,
  reference text,
  amount numeric(14,2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  booked_on date NOT NULL,
  value_on date,
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bank_movements_account_id_id_unique UNIQUE (account_id, id),
  CONSTRAINT bank_movements_account_external_id_unique UNIQUE (account_id, external_id),
  CONSTRAINT bank_movements_account_bank_account_fk FOREIGN KEY (account_id, bank_account_id)
    REFERENCES bank_accounts (account_id, id) ON DELETE RESTRICT,
  CONSTRAINT bank_movements_description_not_blank CHECK (btrim(description) <> ''),
  CONSTRAINT bank_movements_amount_nonzero CHECK (amount <> 0),
  CONSTRAINT bank_movements_currency_iso_length CHECK (char_length(currency) = 3)
);
CREATE INDEX IF NOT EXISTS bank_movements_by_account_booked
  ON bank_movements (account_id, booked_on DESC, id DESC);
CREATE INDEX IF NOT EXISTS bank_movements_by_account_bank_booked
  ON bank_movements (account_id, bank_account_id, booked_on DESC)
  WHERE bank_account_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS payment_reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  payment_id uuid NOT NULL,
  bank_movement_id uuid NOT NULL,
  allocated_amount numeric(14,2) NOT NULL,
  reconciled_by text NOT NULL,
  reconciled_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_reconciliations_account_id_id_unique UNIQUE (account_id, id),
  CONSTRAINT payment_reconciliations_account_payment_movement_unique
    UNIQUE (account_id, payment_id, bank_movement_id),
  CONSTRAINT payment_reconciliations_account_payment_fk FOREIGN KEY (account_id, payment_id)
    REFERENCES payments (account_id, id) ON DELETE CASCADE,
  CONSTRAINT payment_reconciliations_account_movement_fk FOREIGN KEY (account_id, bank_movement_id)
    REFERENCES bank_movements (account_id, id) ON DELETE CASCADE,
  CONSTRAINT payment_reconciliations_allocated_amount_positive CHECK (allocated_amount > 0),
  CONSTRAINT payment_reconciliations_actor_not_blank CHECK (btrim(reconciled_by) <> '')
);
CREATE INDEX IF NOT EXISTS payment_reconciliations_by_account_payment
  ON payment_reconciliations (account_id, payment_id);
CREATE INDEX IF NOT EXISTS payment_reconciliations_by_account_movement
  ON payment_reconciliations (account_id, bank_movement_id);

CREATE INDEX IF NOT EXISTS clients_by_account_status_name
  ON clients (account_id, status, lower(name));
CREATE INDEX IF NOT EXISTS clients_by_account_owner
  ON clients (account_id, owner_user_id) WHERE owner_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS invoices_by_account_due_unpaid
  ON invoices (account_id, due_date, id) WHERE status <> 'PAID';
