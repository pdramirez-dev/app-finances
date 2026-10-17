-- Database-level guarantees for idempotent payment registration and safe,
-- serialized reconciliation. Resolver guards remain the first authorization layer.

DO $$ BEGIN
  ALTER TABLE payments
    ADD CONSTRAINT payments_account_reference_unique UNIQUE (account_id, reference);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE bank_movements
  DROP CONSTRAINT IF EXISTS bank_movements_account_external_id_unique;
CREATE UNIQUE INDEX IF NOT EXISTS bank_movements_external_source_unique
  ON bank_movements (
    account_id,
    COALESCE(bank_account_id, '00000000-0000-0000-0000-000000000000'::uuid),
    external_id
  )
  WHERE external_id IS NOT NULL;

ALTER TABLE payment_reconciliations
  ADD COLUMN IF NOT EXISTS reversed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reversed_by text,
  ADD COLUMN IF NOT EXISTS reversal_reason text;

ALTER TABLE payment_reconciliations
  DROP CONSTRAINT IF EXISTS payment_reconciliations_account_payment_movement_unique;
CREATE UNIQUE INDEX IF NOT EXISTS payment_reconciliations_active_pair_unique
  ON payment_reconciliations (account_id, payment_id, bank_movement_id)
  WHERE reversed_at IS NULL;

DO $$ BEGIN
  ALTER TABLE payment_reconciliations
    ADD CONSTRAINT payment_reconciliations_reversal_complete CHECK (
      (reversed_at IS NULL AND reversed_by IS NULL AND reversal_reason IS NULL)
      OR (
        reversed_at IS NOT NULL
        AND reversed_by IS NOT NULL
        AND reversal_reason IS NOT NULL
        AND btrim(reversed_by) <> ''
        AND btrim(reversal_reason) <> ''
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS voided_by text,
  ADD COLUMN IF NOT EXISTS void_reason text;

DO $$ BEGIN
  ALTER TABLE payments
    ADD CONSTRAINT payments_void_metadata_complete CHECK (
      (status <> 'VOIDED' AND voided_at IS NULL AND voided_by IS NULL AND void_reason IS NULL)
      OR (
        status = 'VOIDED'
        AND voided_at IS NOT NULL
        AND voided_by IS NOT NULL
        AND void_reason IS NOT NULL
        AND btrim(voided_by) <> ''
        AND btrim(void_reason) <> ''
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE invoices
    ADD CONSTRAINT invoices_due_date_not_before_issue
    CHECK (due_date IS NULL OR due_date >= date);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION validate_payment_reconciliation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  payment_amount numeric(14,2);
  payment_currency text;
  current_payment_status payment_status;
  movement_amount numeric(14,2);
  movement_currency text;
  already_on_payment numeric(14,2);
  already_on_movement numeric(14,2);
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Reconciliations are append-only and cannot be deleted';
  END IF;

  IF TG_OP = 'UPDATE' AND NOT (
    NEW.id = OLD.id
    AND NEW.account_id = OLD.account_id
    AND NEW.payment_id = OLD.payment_id
    AND NEW.bank_movement_id = OLD.bank_movement_id
    AND NEW.allocated_amount = OLD.allocated_amount
    AND NEW.reconciled_by = OLD.reconciled_by
    AND NEW.reconciled_at = OLD.reconciled_at
    AND NEW.created_at = OLD.created_at
    AND OLD.reversed_at IS NULL
    AND NEW.reversed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Reconciliations are immutable and may only be reversed';
  END IF;

  IF NEW.reversed_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT amount, upper(currency), status
    INTO payment_amount, payment_currency, current_payment_status
    FROM payments
    WHERE account_id = NEW.account_id AND id = NEW.payment_id
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment does not belong to the active account';
  END IF;

  SELECT amount, upper(currency)
    INTO movement_amount, movement_currency
    FROM bank_movements
    WHERE account_id = NEW.account_id AND id = NEW.bank_movement_id
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bank movement does not belong to the active account';
  END IF;

  IF current_payment_status = 'VOIDED' THEN
    RAISE EXCEPTION 'Voided payments cannot be reconciled';
  END IF;
  IF movement_amount <= 0 THEN
    RAISE EXCEPTION 'Only credit bank movements can be reconciled to payments';
  END IF;
  IF payment_currency <> movement_currency THEN
    RAISE EXCEPTION 'Payment and bank movement currencies must match';
  END IF;

  SELECT COALESCE(sum(allocated_amount), 0)
    INTO already_on_payment
    FROM payment_reconciliations
    WHERE account_id = NEW.account_id
      AND payment_id = NEW.payment_id
      AND reversed_at IS NULL
      AND id <> NEW.id;

  SELECT COALESCE(sum(allocated_amount), 0)
    INTO already_on_movement
    FROM payment_reconciliations
    WHERE account_id = NEW.account_id
      AND bank_movement_id = NEW.bank_movement_id
      AND reversed_at IS NULL
      AND id <> NEW.id;

  IF already_on_payment + NEW.allocated_amount > payment_amount THEN
    RAISE EXCEPTION 'Reconciliation exceeds the payment amount';
  END IF;
  IF already_on_movement + NEW.allocated_amount > movement_amount THEN
    RAISE EXCEPTION 'Reconciliation exceeds the bank movement amount';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payment_reconciliation_validate ON payment_reconciliations;
CREATE TRIGGER payment_reconciliation_validate
BEFORE INSERT OR UPDATE OR DELETE ON payment_reconciliations
FOR EACH ROW EXECUTE FUNCTION validate_payment_reconciliation();

CREATE OR REPLACE FUNCTION refresh_payment_and_invoice_status(
  target_account_id uuid,
  target_payment_id uuid
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  target_invoice_id uuid;
BEGIN
  UPDATE payments p
    SET status = CASE
      WHEN p.status = 'VOIDED' THEN 'VOIDED'::payment_status
      WHEN COALESCE((
        SELECT sum(r.allocated_amount)
        FROM payment_reconciliations r
        WHERE r.account_id = target_account_id
          AND r.payment_id = target_payment_id
          AND r.reversed_at IS NULL
      ), 0) >= p.amount THEN 'RECONCILED'::payment_status
      ELSE 'UNRECONCILED'::payment_status
    END,
    updated_at = now()
    WHERE p.account_id = target_account_id AND p.id = target_payment_id
    RETURNING p.invoice_id INTO target_invoice_id;

  IF target_invoice_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE invoices i
    SET status = CASE
      WHEN COALESCE((
        SELECT sum(p.amount)
        FROM payments p
        WHERE p.account_id = target_account_id
          AND p.invoice_id = target_invoice_id
          AND p.status = 'RECONCILED'
      ), 0) >= i.grand_total THEN 'PAID'::invoice_status
      WHEN i.status = 'PAID' THEN 'SENT'::invoice_status
      ELSE i.status
    END,
    updated_at = now()
    WHERE i.account_id = target_account_id AND i.id = target_invoice_id;
END;
$$;

CREATE OR REPLACE FUNCTION sync_reconciliation_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM refresh_payment_and_invoice_status(OLD.account_id, OLD.payment_id);
    RETURN OLD;
  END IF;

  PERFORM refresh_payment_and_invoice_status(NEW.account_id, NEW.payment_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payment_reconciliation_sync ON payment_reconciliations;
CREATE TRIGGER payment_reconciliation_sync
AFTER INSERT OR UPDATE OR DELETE ON payment_reconciliations
FOR EACH ROW EXECUTE FUNCTION sync_reconciliation_status();
