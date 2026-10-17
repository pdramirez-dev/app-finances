-- Optimistic concurrency for invoice edits. An edit must name the version it
-- was opened from, and every edit or registered payment bumps it, so an edit
-- based on stale data is rejected instead of mixing two edits' sections.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS version int NOT NULL DEFAULT 1;
