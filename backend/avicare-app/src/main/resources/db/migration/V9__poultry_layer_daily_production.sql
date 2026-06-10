-- =====================================================================
-- V9 — Poultry layer daily production (Sprint B2-2)
-- Per-unit, per-date aggregate of the day's egg_collections (all
-- time-slots), with computed laying/break rates and a grade merge.
-- Recomputable snapshot, UNIQUE(unit, date) for idempotent re-close.
-- =====================================================================

CREATE TABLE daily_egg_productions (
    id                   BIGSERIAL PRIMARY KEY,
    production_unit_id   BIGINT NOT NULL REFERENCES production_units(id) ON DELETE CASCADE,
    production_date      DATE NOT NULL,
    total_eggs_collected INTEGER NOT NULL DEFAULT 0 CHECK (total_eggs_collected >= 0),
    total_broken_eggs    INTEGER NOT NULL DEFAULT 0 CHECK (total_broken_eggs  >= 0),
    grades_aggregate     JSONB   NOT NULL DEFAULT '{}'::jsonb,
    laying_rate_pct      NUMERIC(5,2),          -- (total / active_layers) * 100; null if no layers
    break_rate_pct       NUMERIC(5,2),          -- broken / (total + broken) * 100; 0 if none
    active_layers_count  INTEGER,               -- current_count snapshot at close time
    closed_at            TIMESTAMP NOT NULL,
    closed_by            BIGINT REFERENCES users(id),
    created_at           TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (production_unit_id, production_date)
);

CREATE INDEX idx_daily_egg_prod_unit_date
    ON daily_egg_productions(production_unit_id, production_date DESC);

-- For cross-unit reports by day.
CREATE INDEX idx_daily_egg_prod_date
    ON daily_egg_productions(production_date DESC);

CREATE TRIGGER trg_daily_egg_productions_updated_at
    BEFORE UPDATE ON daily_egg_productions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
