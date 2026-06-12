-- =====================================================================
-- V14 — Treatments, veterinarian directory and vet visits (Sprint B3-3,
-- module health.advanced). Treatment keys reference the platform catalog
-- (category treatments, V12) by key. Withdrawal periods are SNAPSHOT at
-- record time and the withdrawal end dates are CALCULATED and EXPOSED, but
-- NEVER enforced (V1 = farmer-responsible, warning-only — décision chat).
-- veterinarians is created first (FK target of the other two tables).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Veterinarian directory — per farm (farm referenced by id, no cross-
-- context FK to tenancy). Soft-deleted via active=false.
-- ---------------------------------------------------------------------
CREATE TABLE veterinarians (
    id              BIGSERIAL PRIMARY KEY,
    farm_id         BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    full_name       VARCHAR(150) NOT NULL,
    phone           VARCHAR(40),
    email           VARCHAR(120),
    speciality      VARCHAR(100),
    license_number  VARCHAR(80),
    location        VARCHAR(150),
    notes           TEXT,
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_by      BIGINT REFERENCES users(id),
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_veterinarians_farm ON veterinarians(farm_id) WHERE active = TRUE;

CREATE TRIGGER trg_veterinarians_updated_at
    BEFORE UPDATE ON veterinarians
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------
-- Treatments executed on a unit. withdrawal_days_* are a SNAPSHOT from the
-- catalog at record time (frozen even if the catalog later changes);
-- end_date and withdrawal_end_date_* are computed in the service.
-- ---------------------------------------------------------------------
CREATE TABLE treatments_executed (
    id                       BIGSERIAL PRIMARY KEY,
    production_unit_id       BIGINT NOT NULL REFERENCES production_units(id) ON DELETE CASCADE,
    treatment_key            VARCHAR(80) NOT NULL,
    start_date               DATE NOT NULL,
    duration_days            INTEGER NOT NULL CHECK (duration_days >= 1 AND duration_days <= 365),
    end_date                 DATE NOT NULL,
    dose_amount              NUMERIC(10,4) NOT NULL,
    dose_unit                VARCHAR(20) NOT NULL,
    route                    VARCHAR(40) NOT NULL,
    subjects_count           INTEGER NOT NULL CHECK (subjects_count >= 0),
    reason                   TEXT,
    prescribed_by            VARCHAR(40),
    veterinarian_id          BIGINT REFERENCES veterinarians(id),
    withdrawal_days_meat     INTEGER,
    withdrawal_days_eggs     INTEGER,
    withdrawal_end_date_meat DATE,
    withdrawal_end_date_eggs DATE,
    notes                    TEXT,
    administered_by_user_id  BIGINT REFERENCES users(id),
    created_by               BIGINT REFERENCES users(id),
    created_at               TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_treatments_unit_date
    ON treatments_executed(production_unit_id, start_date DESC);
-- Plain index (no CURRENT_DATE predicate — not immutable): the "active
-- withdrawal" filter is applied at query time.
CREATE INDEX idx_treatments_unit_withdrawal
    ON treatments_executed(
        production_unit_id, withdrawal_end_date_meat, withdrawal_end_date_eggs);

CREATE TRIGGER trg_treatments_executed_updated_at
    BEFORE UPDATE ON treatments_executed
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------
-- Vet visits on a unit (veterinarian optional — anonymous visit allowed).
-- ---------------------------------------------------------------------
CREATE TABLE vet_visits (
    id                  BIGSERIAL PRIMARY KEY,
    production_unit_id  BIGINT NOT NULL REFERENCES production_units(id) ON DELETE CASCADE,
    veterinarian_id     BIGINT REFERENCES veterinarians(id),
    visit_date          DATE NOT NULL,
    reason              TEXT NOT NULL,
    diagnosis           TEXT,
    recommendations     TEXT,
    cost_xof            INTEGER,
    follow_up_needed    BOOLEAN NOT NULL DEFAULT FALSE,
    follow_up_date      DATE,
    notes               TEXT,
    created_by          BIGINT REFERENCES users(id),
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vet_visits_unit_date ON vet_visits(production_unit_id, visit_date DESC);
CREATE INDEX idx_vet_visits_veterinarian ON vet_visits(veterinarian_id);
CREATE INDEX idx_vet_visits_follow_up
    ON vet_visits(follow_up_date) WHERE follow_up_needed = TRUE;

CREATE TRIGGER trg_vet_visits_updated_at
    BEFORE UPDATE ON vet_visits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
