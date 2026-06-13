-- =====================================================================
-- V15 — Inventory bounded context, first slice (Sprint B4-1).
-- Three concerns: (1) platform catalog of inventory articles (feeds,
-- consumables, equipment, products) seeded as catalog_items under the
-- 'inventory_items' category (Décision 15 — no dedicated table, value in
-- JSONB, read through ParametersFacade.listPlatform); (2) per-farm stock
-- (stock_items); (3) per-farm supplier directory (suppliers).
--
-- Medications are NOT duplicated here: they are referenced from the health
-- catalog (category 'treatments', V12) via stock_items.article_source =
-- 'TREATMENT'. The 'inventory_items' catalog only holds non-medication
-- articles (article_source = 'INVENTORY').
--
-- Single-line jsonb literals (V11/V12 lesson: :: binds tighter than ||).
-- module.inventory and its bundle mappings (pro_volaille, ferme_complete)
-- already exist from V4 — no UPDATE needed.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Platform catalog: inventory articles (locale NULL = universal, V1).
--    value JSONB: {label, subcategory, unit, typical_unit_price_xof, wave}
--    subcategory in (FEED | CONSUMABLE | EQUIPMENT | PRODUCT).
-- ---------------------------------------------------------------------
INSERT INTO catalog_items (category, key, value, locale) VALUES
  ('inventory_items', 'feed_starter_broiler',  '{"label":"Démarrage poulet chair","subcategory":"FEED","unit":"kg","typical_unit_price_xof":500,"wave":"V1"}'::jsonb, NULL),
  ('inventory_items', 'feed_grower_broiler',   '{"label":"Croissance poulet chair","subcategory":"FEED","unit":"kg","typical_unit_price_xof":480,"wave":"V1"}'::jsonb, NULL),
  ('inventory_items', 'feed_finisher_broiler', '{"label":"Finition poulet chair","subcategory":"FEED","unit":"kg","typical_unit_price_xof":460,"wave":"V1"}'::jsonb, NULL),
  ('inventory_items', 'feed_pre_layer',        '{"label":"Pré-ponte","subcategory":"FEED","unit":"kg","typical_unit_price_xof":450,"wave":"V1"}'::jsonb, NULL),
  ('inventory_items', 'feed_layer',            '{"label":"Ponte","subcategory":"FEED","unit":"kg","typical_unit_price_xof":440,"wave":"V1"}'::jsonb, NULL),
  ('inventory_items', 'protein_concentrate',   '{"label":"Concentré protéique","subcategory":"FEED","unit":"kg","typical_unit_price_xof":700,"wave":"V1"}'::jsonb, NULL),
  ('inventory_items', 'corn_crushed',          '{"label":"Maïs concassé","subcategory":"FEED","unit":"kg","typical_unit_price_xof":300,"wave":"V1"}'::jsonb, NULL),
  ('inventory_items', 'litter_wood_chips',     '{"label":"Litière copeaux bois","subcategory":"CONSUMABLE","unit":"sac (25kg)","typical_unit_price_xof":3500,"wave":"V1"}'::jsonb, NULL),
  ('inventory_items', 'disinfectant_chlorine', '{"label":"Désinfectant chlore","subcategory":"CONSUMABLE","unit":"L","typical_unit_price_xof":2500,"wave":"V1"}'::jsonb, NULL),
  ('inventory_items', 'footbath',              '{"label":"Pédiluve granulé","subcategory":"CONSUMABLE","unit":"kg","typical_unit_price_xof":4000,"wave":"V1"}'::jsonb, NULL),
  ('inventory_items', 'vitamins_water',        '{"label":"Vitamines eau","subcategory":"CONSUMABLE","unit":"sachet","typical_unit_price_xof":1500,"wave":"V1"}'::jsonb, NULL),
  ('inventory_items', 'grit_calcium',          '{"label":"Calcium grit","subcategory":"CONSUMABLE","unit":"kg","typical_unit_price_xof":350,"wave":"V1"}'::jsonb, NULL),
  ('inventory_items', 'feeder',                '{"label":"Mangeoire","subcategory":"EQUIPMENT","unit":"unité","typical_unit_price_xof":2500,"wave":"V1"}'::jsonb, NULL),
  ('inventory_items', 'drinker',               '{"label":"Abreuvoir","subcategory":"EQUIPMENT","unit":"unité","typical_unit_price_xof":3000,"wave":"V1"}'::jsonb, NULL),
  ('inventory_items', 'heat_lamp',             '{"label":"Lampe chauffante","subcategory":"EQUIPMENT","unit":"unité","typical_unit_price_xof":5000,"wave":"V1"}'::jsonb, NULL),
  ('inventory_items', 'eggs_consumption',      '{"label":"Œufs de consommation","subcategory":"PRODUCT","unit":"plateau (30)","typical_unit_price_xof":2000,"wave":"V1"}'::jsonb, NULL),
  ('inventory_items', 'chicken_meat',          '{"label":"Viande de poulet","subcategory":"PRODUCT","unit":"kg","typical_unit_price_xof":2500,"wave":"V1"}'::jsonb, NULL);

-- ---------------------------------------------------------------------
-- 2. stock_items — one stock row per (farm, article_source, article_key).
--    article_key resolves against catalog_items 'inventory_items' (when
--    article_source = 'INVENTORY') or 'treatments' (when 'TREATMENT').
--    unit + typical_unit_price_xof are a SNAPSHOT from the catalog at
--    create time. current_quantity MAY go negative (Décision 19 —
--    insufficient stock is a non-blocking warning, never a hard stop);
--    so NO CHECK (current_quantity >= 0).
-- ---------------------------------------------------------------------
CREATE TABLE stock_items (
    id                     BIGSERIAL PRIMARY KEY,
    farm_id                BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    article_key            VARCHAR(80) NOT NULL,
    article_source         VARCHAR(20) NOT NULL DEFAULT 'INVENTORY'
                             CHECK (article_source IN ('INVENTORY', 'TREATMENT')),
    current_quantity       NUMERIC(14,3) NOT NULL DEFAULT 0,
    unit                   VARCHAR(20),
    alert_threshold        NUMERIC(14,3),
    typical_unit_price_xof INTEGER,
    last_movement_at       TIMESTAMP,
    active                 BOOLEAN NOT NULL DEFAULT TRUE,
    notes                  TEXT,
    created_by             BIGINT REFERENCES users(id),
    created_at             TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (farm_id, article_source, article_key)
);

CREATE INDEX idx_stock_items_farm ON stock_items(farm_id) WHERE active = TRUE;
-- Low-stock support: column-to-column predicate (immutable, no volatile
-- function). The active filter is applied at query time.
CREATE INDEX idx_stock_items_low ON stock_items(farm_id, current_quantity)
    WHERE alert_threshold IS NOT NULL AND current_quantity <= alert_threshold;

CREATE TRIGGER trg_stock_items_updated_at
    BEFORE UPDATE ON stock_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------
-- 3. suppliers — per-farm directory (farm referenced by id, no cross-
--    context FK to tenancy). Soft-deleted via active=false. types is a
--    JSONB array of tags (FEED/MEDICATION/EQUIPMENT/MIXED...) — JSONB to
--    match the house mapping pattern (@JdbcTypeCode(SqlTypes.JSON)).
-- ---------------------------------------------------------------------
CREATE TABLE suppliers (
    id              BIGSERIAL PRIMARY KEY,
    farm_id         BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    commercial_name VARCHAR(150) NOT NULL,
    contact_person  VARCHAR(150),
    phone           VARCHAR(40),
    email           VARCHAR(120),
    address         TEXT,
    city            VARCHAR(100),
    types           JSONB NOT NULL DEFAULT '[]'::jsonb,
    payment_terms   VARCHAR(80),
    notes           TEXT,
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_by      BIGINT REFERENCES users(id),
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_suppliers_farm ON suppliers(farm_id) WHERE active = TRUE;

CREATE TRIGGER trg_suppliers_updated_at
    BEFORE UPDATE ON suppliers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
