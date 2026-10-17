-- Automatic payment reminders. Off for every account until it opts in, and
-- reminders_enabled_at keeps the scheduler from mailing invoices that were
-- already overdue before the account turned them on.

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS reminders_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminders_enabled_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_offsets int[] NOT NULL DEFAULT '{-3,0,7,14}';

DO $$ BEGIN
  ALTER TABLE accounts
    ADD CONSTRAINT accounts_reminder_offsets_valid CHECK (
      cardinality(reminder_offsets) BETWEEN 1 AND 6
      AND -30 <= ALL (reminder_offsets)
      AND 90 >= ALL (reminder_offsets)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE accounts
    ADD CONSTRAINT accounts_reminders_enabled_at_set CHECK (NOT reminders_enabled OR reminders_enabled_at IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- One row per reminder attempt. Scheduled reminders are claimed here before
-- the email goes out (unique per invoice and offset), so retries never send twice.
CREATE TABLE IF NOT EXISTS invoice_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  invoice_id uuid NOT NULL,
  kind text NOT NULL,
  offset_days int,
  scheduled_for date,
  recipient text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  CONSTRAINT invoice_reminders_account_id_id_unique UNIQUE (account_id, id),
  CONSTRAINT invoice_reminders_account_invoice_fk FOREIGN KEY (account_id, invoice_id)
    REFERENCES invoices (account_id, id) ON DELETE CASCADE,
  CONSTRAINT invoice_reminders_kind_valid CHECK (kind IN ('SCHEDULED', 'MANUAL')),
  CONSTRAINT invoice_reminders_status_valid CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
  CONSTRAINT invoice_reminders_scheduled_shape CHECK (
    (kind = 'SCHEDULED' AND offset_days IS NOT NULL AND scheduled_for IS NOT NULL)
    OR (kind = 'MANUAL' AND offset_days IS NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS invoice_reminders_scheduled_once
  ON invoice_reminders (invoice_id, offset_days) WHERE kind = 'SCHEDULED';
CREATE INDEX IF NOT EXISTS invoice_reminders_by_invoice
  ON invoice_reminders (account_id, invoice_id, created_at DESC);
