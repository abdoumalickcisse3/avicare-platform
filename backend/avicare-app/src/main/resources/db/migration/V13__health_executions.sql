-- =====================================================================
-- V13 — Health executions (Sprint B3-2)
-- First real tables of the health module: vaccinations administered on a
-- unit, the vaccination program assigned to a unit, and free-form health
-- observations. The vaccine/program keys reference the platform catalog
-- (categories vaccines / vaccination_programs, V12) by key — no SQL FK
-- across the catalog (Décision 15: catalog_items, not a typed table).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Vaccinations — one administration of a vaccine on a unit at a date.
-- UNIQUE(unit, vaccine_key, date): a given vaccine once per day, but two
-- different vaccines the same day are fine. dose is per subject.
-- ---------------------------------------------------------------------
CREATE TABLE vaccinations (
    id                    BIGSERIAL PRIMARY KEY,
    production_unit_id    BIGINT NOT NULL REFERENCES production_units(id) ON DELETE CASCADE,
    vaccine_key           VARCHAR(80) NOT NULL,
    administered_date     DATE NOT NULL,
    route                 VARCHAR(40),
    dose_per_subject      NUMERIC(10,4),
    dose_unit             VARCHAR(20),
    subjects_count        INTEGER NOT NULL CHECK (subjects_count >= 0),
    vaccine_batch_number  VARCHAR(80),
    vaccine_expiry_date   DATE,
    administered_by_user_id BIGINT REFERENCES users(id),
    notes                 TEXT,
    created_by            BIGINT REFERENCES users(id),
    created_at            TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (production_unit_id, vaccine_key, administered_date)
);

CREATE INDEX idx_vaccinations_unit_date
    ON vaccinations(production_unit_id, administered_date DESC);
CREATE INDEX idx_vaccinations_vaccine_key ON vaccinations(vaccine_key);

CREATE TRIGGER trg_vaccinations_updated_at
    BEFORE UPDATE ON vaccinations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------
-- Vaccination program assigned to a unit (1 active program per unit).
-- schedule_overrides (JSONB) carries per-lot customizations (skip, custom
-- dates) without touching the platform catalog — stored now, applied from
-- B3-3+ (computeScheduleStatus uses the catalog schedule in B3-2).
-- ---------------------------------------------------------------------
CREATE TABLE vaccination_programs_lot (
    id                  BIGSERIAL PRIMARY KEY,
    production_unit_id  BIGINT NOT NULL UNIQUE REFERENCES production_units(id) ON DELETE CASCADE,
    program_key         VARCHAR(80) NOT NULL,
    schedule_overrides  JSONB,
    assigned_by         BIGINT REFERENCES users(id),
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vaccination_programs_lot_program
    ON vaccination_programs_lot(program_key);

CREATE TRIGGER trg_vaccination_programs_lot_updated_at
    BEFORE UPDATE ON vaccination_programs_lot
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------
-- Health observations — free-form farmer notes with a severity level.
-- ---------------------------------------------------------------------
CREATE TABLE health_observations (
    id                   BIGSERIAL PRIMARY KEY,
    production_unit_id   BIGINT NOT NULL REFERENCES production_units(id) ON DELETE CASCADE,
    observation_date     DATE NOT NULL,
    severity             VARCHAR(20) NOT NULL DEFAULT 'NORMAL'
                           CHECK (severity IN ('NORMAL', 'WARNING', 'CRITICAL')),
    title                VARCHAR(200) NOT NULL,
    description          TEXT,
    suspected_disease    VARCHAR(100),
    observed_by_user_id  BIGINT REFERENCES users(id),
    created_by           BIGINT REFERENCES users(id),
    created_at           TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_health_observations_unit_date
    ON health_observations(production_unit_id, observation_date DESC);
CREATE INDEX idx_health_observations_severity
    ON health_observations(severity) WHERE severity IN ('WARNING', 'CRITICAL');

CREATE TRIGGER trg_health_observations_updated_at
    BEFORE UPDATE ON health_observations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
