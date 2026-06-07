-- =====================================================================
-- V7 — Poultry performance (Sprint B1-2)
-- weighing_samples (sample weighings) + growth_performance (computed
-- snapshots: GMQ/ADG, FCR/IC, uniformity, maturity forecast).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Weighing samples — periodic (weekly by default) sample weighings of a
-- broiler batch. individual_weights is a JSONB array of gram weights;
-- avg/min/max/std/uniformity are derived by the service. Soft-deletable
-- (a mis-entered sample is corrected by re-entry).
-- ---------------------------------------------------------------------
CREATE TABLE weighing_samples (
    id                 BIGSERIAL PRIMARY KEY,
    poultry_batch_id   BIGINT NOT NULL REFERENCES poultry_batches(id) ON DELETE CASCADE,
    sample_date        DATE NOT NULL,
    age_days           INTEGER NOT NULL CHECK (age_days >= 0),
    sample_size        INTEGER NOT NULL CHECK (sample_size > 0),
    individual_weights JSONB NOT NULL,
    avg_weight_g       NUMERIC(10,3) NOT NULL,
    min_weight_g       NUMERIC(10,3),
    max_weight_g       NUMERIC(10,3),
    std_deviation      NUMERIC(10,3),
    uniformity_percent NUMERIC(5,2),
    notes              TEXT,
    recorded_by        BIGINT REFERENCES users(id),
    deleted_at         TIMESTAMP,
    created_at         TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_weighing_samples_batch_date
    ON weighing_samples(poultry_batch_id, sample_date DESC)
    WHERE deleted_at IS NULL;

CREATE TRIGGER trg_weighing_samples_updated_at
    BEFORE UPDATE ON weighing_samples
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------
-- Growth performance — a computed snapshot per (batch, date), upserted
-- by GrowthAnalysisService. Derived from the latest weighing + the daily
-- records (cumulative feed/water/mortality) + the batch slaughter targets.
-- ---------------------------------------------------------------------
CREATE TABLE growth_performance (
    id                           BIGSERIAL PRIMARY KEY,
    poultry_batch_id             BIGINT NOT NULL REFERENCES poultry_batches(id) ON DELETE CASCADE,
    snapshot_date                DATE NOT NULL,
    age_days                     INTEGER NOT NULL,
    current_weight_g             NUMERIC(10,3),
    gmq_g_per_day                NUMERIC(8,3),
    feed_conversion_ratio        NUMERIC(5,3),
    cumulative_mortality_percent NUMERIC(5,2),
    cumulative_feed_kg           NUMERIC(12,3),
    cumulative_water_l           NUMERIC(12,3),
    forecasted_target_date       DATE,
    performance_score            VARCHAR(20),
    computed_at                  TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (poultry_batch_id, snapshot_date)
);

CREATE INDEX idx_growth_performance_batch
    ON growth_performance(poultry_batch_id, snapshot_date DESC);
