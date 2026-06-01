-- =====================================================================
-- V4 — Reference / seed data (Sprint A4, Session A4-4)
-- Platform-level catalog only (catalog_items, locale = NULL = universal).
-- No demo data (D17: no demo farm/user).
-- Modeling (D15 — no dedicated bundles table): commercial modules and bundles
-- are seeded as catalog_items under the 'modules' and 'bundles' categories, with
-- the entitlement details carried in the JSONB value.
-- All V1+V2+ modules are declared (D13 — future-proof); a `wave` field marks the
-- vague (V1/V2/V3) so later code can filter.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Commercial modules (doc 00 §7). scope: production | transverse.
-- ---------------------------------------------------------------------
INSERT INTO catalog_items (category, key, value, locale) VALUES
  ('modules', 'module.poultry.broiler',          '{"label":"Volaille chair","scope":"production","wave":"V1"}'::jsonb, NULL),
  ('modules', 'module.poultry.layer',            '{"label":"Volaille ponte","scope":"production","wave":"V1"}'::jsonb, NULL),
  ('modules', 'module.smallruminants.fattening', '{"label":"Embouche ovine/caprine","scope":"production","wave":"V2"}'::jsonb, NULL),
  ('modules', 'module.smallruminants.tabaski',   '{"label":"Calendrier Tabaski","scope":"production","wave":"V2"}'::jsonb, NULL),
  ('modules', 'module.cattle.milking',           '{"label":"Bovins laitiers","scope":"production","wave":"V3"}'::jsonb, NULL),
  ('modules', 'module.cattle.beef',              '{"label":"Bovins viande","scope":"production","wave":"V3"}'::jsonb, NULL),
  ('modules', 'module.health.basic',             '{"label":"Sante basique","scope":"transverse","wave":"V1"}'::jsonb, NULL),
  ('modules', 'module.health.advanced',          '{"label":"Sante avancee","scope":"transverse","wave":"V1"}'::jsonb, NULL),
  ('modules', 'module.commercial.basic',         '{"label":"Commercial basique","scope":"transverse","wave":"V1"}'::jsonb, NULL),
  ('modules', 'module.commercial.advanced',      '{"label":"Commercial avance","scope":"transverse","wave":"V1"}'::jsonb, NULL),
  ('modules', 'module.inventory',                '{"label":"Stocks","scope":"transverse","wave":"V1"}'::jsonb, NULL),
  ('modules', 'module.finance',                  '{"label":"Finance","scope":"transverse","wave":"V1"}'::jsonb, NULL),
  ('modules', 'module.kpi.advanced',             '{"label":"KPI avances","scope":"transverse","wave":"V1"}'::jsonb, NULL),
  ('modules', 'module.buyer_portal',             '{"label":"Portail acheteur","scope":"transverse","wave":"V1"}'::jsonb, NULL),
  ('modules', 'module.qr_codes',                 '{"label":"QR codes","scope":"transverse","wave":"V1"}'::jsonb, NULL),
  ('modules', 'module.api_access',               '{"label":"Acces API","scope":"transverse","wave":"V1"}'::jsonb, NULL);

-- ---------------------------------------------------------------------
-- Bundles = collections of entitlements (D15). value carries the module
-- set, indicative monthly price (XOF) and quota limits.
-- ---------------------------------------------------------------------
INSERT INTO catalog_items (category, key, value, locale) VALUES
  ('bundles', 'starter_volaille',
    '{"label":"Starter Volaille","price_xof":15000,"wave":"V1","modules":["module.poultry.broiler","module.poultry.layer","module.health.basic"],"quotas":{"farms_max":1,"animals_max":100}}'::jsonb, NULL),
  ('bundles', 'pro_volaille',
    '{"label":"Pro Volaille","price_xof":25000,"wave":"V1","modules":["module.poultry.broiler","module.poultry.layer","module.health.advanced","module.commercial.basic","module.inventory"],"quotas":{"farms_max":3,"animals_max":3000}}'::jsonb, NULL),
  ('bundles', 'ferme_complete',
    '{"label":"Ferme Complete","price_xof":45000,"wave":"V1","modules":["module.poultry.broiler","module.poultry.layer","module.health.advanced","module.commercial.advanced","module.inventory","module.finance","module.kpi.advanced","module.buyer_portal","module.qr_codes","module.api_access"],"quotas":{"farms_max":10,"animals_max":10000}}'::jsonb, NULL),
  ('bundles', 'tabaski_edition',
    '{"label":"Tabaski Edition","price_xof":20000,"wave":"V2","modules":["module.smallruminants.fattening","module.smallruminants.tabaski","module.health.basic","module.commercial.basic"],"quotas":{"farms_max":1}}'::jsonb, NULL);

-- ---------------------------------------------------------------------
-- Poultry breeds (doc 06 §3). type: broiler | layer.
-- ---------------------------------------------------------------------
INSERT INTO catalog_items (category, key, value, locale) VALUES
  ('breeds', 'cobb_500',       '{"label":"Cobb 500","type":"broiler","species":"poultry"}'::jsonb, NULL),
  ('breeds', 'ross_308',       '{"label":"Ross 308","type":"broiler","species":"poultry"}'::jsonb, NULL),
  ('breeds', 'isa_brown',      '{"label":"ISA Brown","type":"layer","species":"poultry"}'::jsonb, NULL),
  ('breeds', 'lohmann_brown',  '{"label":"Lohmann Brown","type":"layer","species":"poultry"}'::jsonb, NULL),
  ('breeds', 'hyline_w36',     '{"label":"Hy-Line W-36","type":"layer","species":"poultry"}'::jsonb, NULL);

-- ---------------------------------------------------------------------
-- Vaccines (doc 06 §3). schedule_days: indicative administration days.
-- ---------------------------------------------------------------------
INSERT INTO catalog_items (category, key, value, locale) VALUES
  ('vaccines', 'newcastle',             '{"label":"Newcastle","schedule_days":[7,21],"booster":true}'::jsonb, NULL),
  ('vaccines', 'gumboro',               '{"label":"Gumboro","schedule_days":[14,28]}'::jsonb, NULL),
  ('vaccines', 'infectious_bronchitis', '{"label":"Bronchite infectieuse","schedule_days":[1,28]}'::jsonb, NULL),
  ('vaccines', 'fowl_pox',              '{"label":"Variole aviaire","schedule_days":[21]}'::jsonb, NULL);

-- ---------------------------------------------------------------------
-- Expense categories (doc 06 §3).
-- ---------------------------------------------------------------------
INSERT INTO catalog_items (category, key, value, locale) VALUES
  ('expense_categories', 'feed',      '{"label":"Aliment"}'::jsonb, NULL),
  ('expense_categories', 'veterinary','{"label":"Veterinaire / medicaments"}'::jsonb, NULL),
  ('expense_categories', 'staff',     '{"label":"Personnel"}'::jsonb, NULL),
  ('expense_categories', 'energy',    '{"label":"Energie"}'::jsonb, NULL),
  ('expense_categories', 'equipment', '{"label":"Materiel"}'::jsonb, NULL),
  ('expense_categories', 'transport', '{"label":"Transport"}'::jsonb, NULL),
  ('expense_categories', 'other',     '{"label":"Autres"}'::jsonb, NULL);
