-- Demo seed for the farmer-facing partner surface (Mon réseau).
-- NOT a Flyway migration (lives outside db/migration) — safe to re-run.
-- Run:  docker exec -i avicare-postgres psql -U avicare -d avicare < infra/seed/partner-demo-seed.sql
--
-- Seeds, for OWNER user 8 (complete@test.avicare) on farm 8 ("Ferme Complète"):
--   * 2 ACTIVE partners (a feed supplier + a vet) → appear in the directory
--   * 1 SUSPENDED partner → must NOT appear (listActive filters ACTIVE)
--   * 1 invite code "SAHEL2026" on the feed supplier → test "Rejoindre par code"
--   * 1 CONFIRMED membership farm8 ↔ vet → a card with sliders + "Quitter"
-- Sentinel: seeded partners use the @demo.seed contact-email domain, so a re-run
-- cleans its own rows first (cascade drops their codes + memberships).

BEGIN;

DELETE FROM partners WHERE contact_email LIKE '%@demo.seed';

WITH feed AS (
  INSERT INTO partners (name, type, contact_name, contact_phone, contact_email, status, created_by)
  VALUES ('Provende du Sahel', 'FEED_SUPPLIER', 'Awa Ndiaye', '+221770000001', 'sahel@demo.seed', 'ACTIVE', 8)
  RETURNING id
),
vet AS (
  INSERT INTO partners (name, type, contact_name, contact_phone, contact_email, status, created_by)
  VALUES ('Cabinet Véto Baobab', 'VET', 'Dr. Sow', '+221770000002', 'baobab@demo.seed', 'ACTIVE', 8)
  RETURNING id
),
suspended AS (
  INSERT INTO partners (name, type, contact_name, contact_phone, contact_email, status, created_by)
  VALUES ('Sénégal Aliments (suspendu)', 'FEED_SUPPLIER', 'M. Fall', '+221770000003', 'suspendu@demo.seed', 'SUSPENDED', 8)
  RETURNING id
),
invite AS (
  INSERT INTO partner_invite_codes (partner_id, code, active, max_uses, uses_count, created_by)
  SELECT id, 'SAHEL2026', TRUE, NULL, 0, 8 FROM feed
  RETURNING id
)
INSERT INTO partner_farm_memberships
  (partner_id, farm_id, status, origin,
   share_activity, share_flock_health, share_feed_consumption, share_sales_volume, share_finances,
   created_by, confirmed_at)
SELECT vet.id, 8, 'CONFIRMED', 'MANUAL_ADMIN',
       TRUE, TRUE, TRUE, FALSE, FALSE,
       8, NOW()
FROM vet;

COMMIT;
