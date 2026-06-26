CREATE TABLE IF NOT EXISTS schema_migrations (
  version    text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  CREATE TYPE account_type AS ENUM ('SELF_EMPLOYED', 'COMPANY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE invoice_status AS ENUM ('DRAFT', 'SENT', 'PAID');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS accounts (
  id uuid PRIMARY KEY,
  type account_type NOT NULL,
  display_name text NOT NULL,
  legal_name text, tax_id text, email text, phone text, address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id),
  name text NOT NULL,
  email text, phone text, address text, tax_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS clients_by_account_name ON clients (account_id, lower(name));

CREATE TABLE IF NOT EXISTS bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id),
  beneficiary_name text NOT NULL,
  bank_name text NOT NULL,
  account_number_masked text, routing_number_masked text,
  iban_masked text, swift_code text,
  currency text NOT NULL, country text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bank_accounts_by_account ON bank_accounts (account_id);

CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id),
  client_id uuid REFERENCES clients(id),
  invoice_number int NOT NULL,
  date date NOT NULL,
  week_number int NOT NULL,
  bill_to_name text NOT NULL,
  bill_to_address text NOT NULL,
  project text NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  notes text,
  grand_total numeric(14,2) NOT NULL,
  status invoice_status NOT NULL DEFAULT 'DRAFT',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, invoice_number)
);
CREATE INDEX IF NOT EXISTS invoices_by_account_created ON invoices (account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS invoices_by_account_status ON invoices (account_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS invoice_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  title text NOT NULL,
  position int NOT NULL,
  total numeric(14,2) NOT NULL
);
CREATE INDEX IF NOT EXISTS sections_by_invoice ON invoice_sections (invoice_id, position);

CREATE TABLE IF NOT EXISTS invoice_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES invoice_sections(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric(14,2) NOT NULL,
  amount numeric(14,2) NOT NULL,
  position int NOT NULL
);
CREATE INDEX IF NOT EXISTS line_items_by_section ON invoice_line_items (section_id, position);

CREATE TABLE IF NOT EXISTS invoice_counters (
  account_id uuid PRIMARY KEY REFERENCES accounts(id),
  last_invoice_number int NOT NULL DEFAULT 0
);
