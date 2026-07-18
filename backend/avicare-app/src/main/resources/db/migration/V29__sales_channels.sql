-- =====================================================================
-- V29 — Distribution channels (circuits de distribution).
-- Sales and orders can be tagged with a farm-customizable channel; the
-- channel list lives in the 'sales_channels' catalog category (Décision
-- 15 — no dedicated table, value in JSONB, farm-customizable via
-- Réglages › Ventes). Referenced by key, not FK — same pattern as other
-- catalog-backed columns (e.g. breeds.species, inventory article_key).
-- =====================================================================

ALTER TABLE sales  ADD COLUMN sales_channel_key VARCHAR(80) NULL;
ALTER TABLE orders ADD COLUMN sales_channel_key VARCHAR(80) NULL;

-- ---------------------------------------------------------------------
-- Platform catalog: sales channels (locale NULL = universal, V1).
-- value JSONB: {label, wave}
-- ---------------------------------------------------------------------
INSERT INTO catalog_items (category, key, value, locale) VALUES
  ('sales_channels', 'retail',      '{"label":"Détail","wave":"V1"}'::jsonb, NULL),
  ('sales_channels', 'wholesale',   '{"label":"Grossiste","wave":"V1"}'::jsonb, NULL),
  ('sales_channels', 'restaurant',  '{"label":"Restaurant","wave":"V1"}'::jsonb, NULL),
  ('sales_channels', 'market',      '{"label":"Marché","wave":"V1"}'::jsonb, NULL),
  ('sales_channels', 'cooperative', '{"label":"Coopérative","wave":"V1"}'::jsonb, NULL);
