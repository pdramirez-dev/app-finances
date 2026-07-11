DO $$ BEGIN
  ALTER TABLE clients
    ADD CONSTRAINT clients_account_id_id_unique UNIQUE (account_id, id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE invoices
    ADD CONSTRAINT invoices_account_client_fk
    FOREIGN KEY (account_id, client_id)
    REFERENCES clients (account_id, id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
