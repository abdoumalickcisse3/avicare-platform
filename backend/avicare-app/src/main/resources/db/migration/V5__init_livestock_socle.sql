-- =====================================================================
-- V5 — Livestock socle (Sprint A5)
-- Tables: breeds, production_units (parent — JPA JOINED inheritance),
--   lifecycle_events.
-- No species extension table here (poultry_batches arrives in Sprint B1).
-- Numbering: V5 because V4 is already taken by the A4 seed migration (doc 04
-- planned V4 for livestock — doc is desynced, code wins).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Breeds — species reference, optionally linked to a platform catalog item.
-- farm_id NULL = platform-level breed; non-null = farm-custom.
-- ---------------------------------------------------------------------
CREATE TABLE breeds (
    id              BIGSERIAL PRIMARY KEY,
    species         VARCHAR(20) NOT NULL
                      CHECK (species IN ('POULTRY', 'OVINE', 'BOVINE', 'CAPRINE', 'PORCINE', 'OTHER')),
    code            VARCHAR(100) NOT NULL,
    name            VARCHAR(200) NOT NULL,
    catalog_item_id BIGINT REFERENCES catalog_items(id),
    farm_id         BIGINT REFERENCES farms(id) ON DELETE CASCADE,
    growth_curve    JSONB,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (species, code, farm_id)
);

CREATE INDEX idx_breeds_species ON breeds(species) WHERE is_active = TRUE;
CREATE INDEX idx_breeds_farm_id ON breeds(farm_id) WHERE farm_id IS NOT NULL;

CREATE TRIGGER trg_breeds_updated_at
    BEFORE UPDATE ON breeds
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed platform breeds from the A4 catalog (category 'breeds', value JSONB:
-- {"label": "...", "type": "...", "species": "poultry"}). species is upper-cased.
INSERT INTO breeds (species, code, name, catalog_item_id, farm_id)
SELECT UPPER(value ->> 'species'), key, value ->> 'label', id, NULL
FROM catalog_items
WHERE category = 'breeds' AND value ? 'species';

-- ---------------------------------------------------------------------
-- Production units — PARENT table (JPA JOINED inheritance). Species
-- extension tables (poultry_batches, ...) join on id in later sprints.
-- ---------------------------------------------------------------------
CREATE TABLE production_units (
    id            BIGSERIAL PRIMARY KEY,
    farm_id       BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    species       VARCHAR(20) NOT NULL
                    CHECK (species IN ('POULTRY', 'OVINE', 'BOVINE', 'CAPRINE', 'PORCINE', 'OTHER')),
    unit_kind     VARCHAR(20) NOT NULL
                    CHECK (unit_kind IN ('BATCH', 'INDIVIDUAL')),
    breed_id      BIGINT REFERENCES breeds(id),
    name          VARCHAR(200),
    start_date    DATE NOT NULL,
    end_date      DATE,
    current_count INTEGER NOT NULL DEFAULT 1 CHECK (current_count >= 0),
    status        VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
                    CHECK (status IN ('PLANNED', 'ACTIVE', 'CLOSED', 'CANCELLED')),
    created_by    BIGINT REFERENCES users(id),
    deleted_at    TIMESTAMP,
    created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_production_units_farm_id ON production_units(farm_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_production_units_species_kind ON production_units(species, unit_kind);
CREATE INDEX idx_production_units_status ON production_units(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_production_units_active ON production_units(farm_id, status)
    WHERE status = 'ACTIVE' AND deleted_at IS NULL;

CREATE TRIGGER trg_production_units_updated_at
    BEFORE UPDATE ON production_units
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------
-- Lifecycle events — generic events on a ProductionUnit (creation,
-- transfer, mortality, count adjustment...). quantity_delta adjusts the
-- unit's count (negative on mortality).
-- ---------------------------------------------------------------------
CREATE TABLE lifecycle_events (
    id                 BIGSERIAL PRIMARY KEY,
    production_unit_id BIGINT NOT NULL REFERENCES production_units(id) ON DELETE CASCADE,
    event_type         VARCHAR(50) NOT NULL,
    occurred_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    quantity_delta     INTEGER NOT NULL DEFAULT 0,
    reason             VARCHAR(100),
    details            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by         BIGINT REFERENCES users(id),
    created_at         TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lifecycle_events_production_unit ON lifecycle_events(production_unit_id);
CREATE INDEX idx_lifecycle_events_type_occurred ON lifecycle_events(event_type, occurred_at);
