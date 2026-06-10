-- =====================================================================
-- V8 — Poultry layer (Sprint B2-1)
-- Egg production for layers: egg_collections (time-slot collections per
-- production unit) + egg_tray_stocks (farm-scoped tray inventory).
-- No egg_collection_configs table: collection time-slots and egg grades
-- are parametrized through the 3-layer mechanism (catalog_items defaults
-- below, overridable per farm via farm_settings) — see docs/06 §3.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Egg collections — one row per (unit, date, timeslot), upserted by the
-- service. total_eggs counts the GOOD (gradable) eggs; broken_eggs is a
-- SEPARATE count (not included in total, not graded) — no ordering
-- constraint between them. grades_count is a JSONB breakdown of the good
-- eggs by grade key, validated against the configured grades in service.
-- Egg production never changes the unit's head count (broken egg != hen
-- mortality); layer mortality stays on daily_records.
-- ---------------------------------------------------------------------
CREATE TABLE egg_collections (
    id                 BIGSERIAL PRIMARY KEY,
    production_unit_id BIGINT NOT NULL REFERENCES production_units(id) ON DELETE CASCADE,
    collection_date    DATE NOT NULL,
    timeslot_key       VARCHAR(40) NOT NULL,
    total_eggs         INTEGER NOT NULL DEFAULT 0 CHECK (total_eggs  >= 0),
    broken_eggs        INTEGER NOT NULL DEFAULT 0 CHECK (broken_eggs >= 0),
    grades_count       JSONB   NOT NULL DEFAULT '{}'::jsonb,
    collector_user_id  BIGINT REFERENCES users(id),
    notes              TEXT,
    created_by         BIGINT REFERENCES users(id),
    created_at         TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (production_unit_id, collection_date, timeslot_key)
);

CREATE INDEX idx_egg_collections_unit_date
    ON egg_collections(production_unit_id, collection_date DESC);

-- Partial index: the collector FK is nullable (used for per-collector reports).
CREATE INDEX idx_egg_collections_collector
    ON egg_collections(collector_user_id) WHERE collector_user_id IS NOT NULL;

CREATE TRIGGER trg_egg_collections_updated_at
    BEFORE UPDATE ON egg_collections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------
-- Egg tray stocks — farm-scoped (mutualised across the farm's lots, not
-- per unit). One row per farm (UNIQUE), auto-created by the service.
-- ---------------------------------------------------------------------
CREATE TABLE egg_tray_stocks (
    id                BIGSERIAL PRIMARY KEY,
    farm_id           BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    full_trays_count  INTEGER NOT NULL DEFAULT 0 CHECK (full_trays_count  >= 0),
    empty_trays_count INTEGER NOT NULL DEFAULT 0 CHECK (empty_trays_count >= 0),
    created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (farm_id)
);

CREATE TRIGGER trg_egg_tray_stocks_updated_at
    BEFORE UPDATE ON egg_tray_stocks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------
-- Platform defaults (layer 1, locale = null = universal). Farms override
-- by adding/hiding entries via farm_settings / farm_catalog_items. The
-- service also carries hard fallbacks so validation never breaks if these
-- rows are absent.
-- ---------------------------------------------------------------------

-- Collection time-slots.
INSERT INTO catalog_items (category, key, value, locale) VALUES
  ('egg_timeslots', 'morning', '{"label":"Matin","default_time":"06:00","order":1}'::jsonb, NULL),
  ('egg_timeslots', 'noon',    '{"label":"Midi","default_time":"12:00","order":2}'::jsonb, NULL),
  ('egg_timeslots', 'evening', '{"label":"Soir","default_time":"18:00","order":3}'::jsonb, NULL);

-- Egg grades.
INSERT INTO catalog_items (category, key, value, locale) VALUES
  ('egg_grades', 'S',  '{"label":"S","order":1}'::jsonb,  NULL),
  ('egg_grades', 'M',  '{"label":"M","order":2}'::jsonb,  NULL),
  ('egg_grades', 'L',  '{"label":"L","order":3}'::jsonb,  NULL),
  ('egg_grades', 'XL', '{"label":"XL","order":4}'::jsonb, NULL);

-- Tray size + price (scalars wrapped as {"value": ...} since values are objects).
INSERT INTO catalog_items (category, key, value, locale) VALUES
  ('egg_collection', 'tray_size',      '{"value":30}'::jsonb,   NULL),
  ('egg_collection', 'tray_price_xof', '{"value":2500}'::jsonb, NULL);
