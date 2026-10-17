-- Invoice numbering series. Each series has its own counter, while invoices
-- created without a series keep the general numbering in invoice_counters
-- with an empty series code.

CREATE TABLE IF NOT EXISTS invoice_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  last_number int NOT NULL DEFAULT 0,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoice_series_account_id_id_unique UNIQUE (account_id, id),
  CONSTRAINT invoice_series_account_code_unique UNIQUE (account_id, code),
  CONSTRAINT invoice_series_code_format CHECK (code ~ '^[A-Z0-9][A-Z0-9-]{0,11}$'),
  CONSTRAINT invoice_series_name_not_blank CHECK (btrim(name) <> ''),
  CONSTRAINT invoice_series_last_number_non_negative CHECK (last_number >= 0)
);
CREATE INDEX IF NOT EXISTS invoice_series_by_account ON invoice_series (account_id, code);

-- The default series lives on the account so switching it is a single-row update.
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS default_invoice_series_id uuid;
DO $$ BEGIN
  ALTER TABLE accounts
    ADD CONSTRAINT accounts_default_invoice_series_fk
    FOREIGN KEY (id, default_invoice_series_id)
    REFERENCES invoice_series (account_id, id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS series_id uuid,
  ADD COLUMN IF NOT EXISTS series_code text NOT NULL DEFAULT '';
DO $$ BEGIN
  ALTER TABLE invoices
    ADD CONSTRAINT invoices_account_series_fk
    FOREIGN KEY (account_id, series_id)
    REFERENCES invoice_series (account_id, id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE invoices
    ADD CONSTRAINT invoices_series_code_matches_series
    CHECK ((series_id IS NULL) = (series_code = ''));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Numbers are unique per series instead of per account. The original inline
-- UNIQUE (account_id, invoice_number) has a generated name, so look it up by its
-- columns and fail loudly if it cannot be found on a database that still needs it.
DO $$
DECLARE
  legacy_constraint text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'invoices'::regclass AND conname = 'invoices_account_series_number_unique'
  ) THEN
    RETURN;
  END IF;

  SELECT c.conname INTO legacy_constraint
  FROM pg_constraint c
  WHERE c.conrelid = 'invoices'::regclass
    AND c.contype = 'u'
    AND (
      SELECT array_agg(a.attname::text ORDER BY a.attname)
      FROM unnest(c.conkey) AS k(attnum)
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
    ) = ARRAY['account_id', 'invoice_number'];

  IF legacy_constraint IS NULL THEN
    RAISE EXCEPTION 'Expected UNIQUE (account_id, invoice_number) on invoices was not found';
  END IF;

  EXECUTE format('ALTER TABLE invoices DROP CONSTRAINT %I', legacy_constraint);
  ALTER TABLE invoices
    ADD CONSTRAINT invoices_account_series_number_unique UNIQUE (account_id, series_code, invoice_number);
END $$;
