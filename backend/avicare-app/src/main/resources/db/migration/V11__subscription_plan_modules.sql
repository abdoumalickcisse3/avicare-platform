-- Plan → Modules mapping reconciliation (Décision 16). The mapping is the
-- backend source of truth and lives in catalog_items category 'bundles'
-- (Décision 15 — no dedicated bundles table). This seed-only migration aligns
-- the V1 plans with the (previously hardcoded) frontend bundles and adds the
-- "sur mesure" (custom quote) plan. No schema change.

-- ferme_complete: align to the full 12 V1 modules (the V4 seed was missing
-- module.health.basic and module.commercial.basic — superior bundles must
-- include everything the lower ones have).
UPDATE catalog_items
SET value = '{"label":"Ferme Complete","price_xof":45000,"wave":"V1","recommended":false,"modules":["module.poultry.broiler","module.poultry.layer","module.health.basic","module.health.advanced","module.commercial.basic","module.commercial.advanced","module.inventory","module.finance","module.kpi.advanced","module.buyer_portal","module.qr_codes","module.api_access"],"quotas":{"farms_max":10,"animals_max":10000}}'::jsonb
WHERE category = 'bundles' AND key = 'ferme_complete';

-- Display flags (single source of truth for the picker): pro is highlighted.
UPDATE catalog_items
SET value = value || '{"recommended":true}'::jsonb
WHERE category = 'bundles' AND key = 'pro_volaille';

UPDATE catalog_items
SET value = value || '{"recommended":false}'::jsonb
WHERE category = 'bundles' AND key = 'starter_volaille';

-- sur_mesure: custom quote plan — no instant activation, no price, no modules.
INSERT INTO catalog_items (category, key, value, locale)
SELECT 'bundles', 'sur_mesure',
       '{"label":"Sur mesure","price_xof":null,"wave":"V1","custom":true,"recommended":false,"modules":[]}'::jsonb,
       NULL
WHERE NOT EXISTS (
  SELECT 1 FROM catalog_items
  WHERE category = 'bundles' AND key = 'sur_mesure' AND locale IS NULL);
