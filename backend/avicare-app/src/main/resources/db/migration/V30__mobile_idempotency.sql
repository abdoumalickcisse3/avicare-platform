-- Idempotency keys for mobile replay (doc 08 §9).
-- Only the two non-idempotent field endpoints need this: daily records and
-- egg collections are upserts and replay safely without a key.
ALTER TABLE lifecycle_events ADD COLUMN client_ref UUID NULL;
ALTER TABLE weighing_samples ADD COLUMN client_ref UUID NULL;

-- Partial: every web-originated row leaves client_ref NULL and must not collide.
CREATE UNIQUE INDEX uq_lifecycle_events_client_ref
  ON lifecycle_events (client_ref) WHERE client_ref IS NOT NULL;
CREATE UNIQUE INDEX uq_weighing_samples_client_ref
  ON weighing_samples (client_ref) WHERE client_ref IS NOT NULL;
