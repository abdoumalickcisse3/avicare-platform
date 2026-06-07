-- =====================================================================
-- V6 — Poultry chair (Sprint B1-1)
-- First concrete species extension of production_units (JPA JOINED):
--   poultry_batches (broiler lots) + daily_records (daily entries).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Poultry batches — JOINED child of production_units (joins on id).
-- breed_id is NOT NULL here (a poultry batch must have a breed); the
-- parent production_units.breed_id is also set by the service so the
-- species-agnostic ProductionUnitResponse stays consistent.
-- ---------------------------------------------------------------------
CREATE TABLE poultry_batches (
    id              BIGINT PRIMARY KEY
                      REFERENCES production_units(id) ON DELETE CASCADE,
    breed_id        BIGINT NOT NULL REFERENCES breeds(id),
    target_weight_g INTEGER,
    target_age_days INTEGER,
    initial_count   INTEGER NOT NULL CHECK (initial_count >= 0),
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_poultry_batches_breed_id ON poultry_batches(breed_id);

CREATE TRIGGER trg_poultry_batches_updated_at
    BEFORE UPDATE ON poultry_batches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------
-- Daily records — one entry per unit per day (upsert on the unique key).
-- mortality_count is the RAW input and may exceed current_count in a
-- catastrophe; the service clamps the actual head-count change to >= 0.
-- ---------------------------------------------------------------------
CREATE TABLE daily_records (
    id                 BIGSERIAL PRIMARY KEY,
    production_unit_id BIGINT NOT NULL REFERENCES production_units(id) ON DELETE CASCADE,
    record_date        DATE NOT NULL,
    mortality_count    INTEGER NOT NULL DEFAULT 0 CHECK (mortality_count >= 0),
    feed_kg            NUMERIC(10,3) NOT NULL DEFAULT 0 CHECK (feed_kg >= 0),
    water_l            NUMERIC(10,3) NOT NULL DEFAULT 0 CHECK (water_l >= 0),
    observations       TEXT,
    created_by         BIGINT REFERENCES users(id),
    created_at         TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (production_unit_id, record_date)
);

CREATE INDEX idx_daily_records_unit_date
    ON daily_records(production_unit_id, record_date DESC);

CREATE TRIGGER trg_daily_records_updated_at
    BEFORE UPDATE ON daily_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
