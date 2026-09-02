-- V52 — Bilan de fin de cycle figé (une ligne par unité clôturée).
-- Figé et non recalculé : une dépense saisie après coup ne doit pas réécrire un
-- résultat passé. Pas de deleted_at — rouvrir une unité supprime la ligne.
-- Montants en BIGINT XOF entiers, comme expenses.amount_xof et sale_items.

CREATE TABLE unit_closures (
    id                    BIGSERIAL PRIMARY KEY,
    production_unit_id    BIGINT NOT NULL UNIQUE REFERENCES production_units(id) ON DELETE CASCADE,
    farm_id               BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    closed_at             TIMESTAMP NOT NULL,
    closed_by             BIGINT REFERENCES users(id),

    start_date            DATE NOT NULL,
    end_date              DATE NOT NULL,
    duration_days         INTEGER NOT NULL CHECK (duration_days >= 0),

    initial_count         INTEGER NOT NULL,
    remaining_count       INTEGER NOT NULL,
    deaths                INTEGER NOT NULL CHECK (deaths >= 0),
    mortality_percent     NUMERIC(5,2),

    -- Technique : nullable, renseigné pour la volaille de chair.
    exit_weight_g         NUMERIC(10,2),
    avg_daily_gain_g      NUMERIC(10,2),
    total_feed_kg         NUMERIC(14,3),
    feed_conversion_ratio NUMERIC(6,3),

    -- Argent (XOF entiers).
    revenue_xof           BIGINT NOT NULL DEFAULT 0,
    feed_cost_xof         BIGINT NOT NULL DEFAULT 0,
    chick_cost_xof        BIGINT NOT NULL DEFAULT 0,
    other_expense_xof     BIGINT NOT NULL DEFAULT 0,
    total_cost_xof        BIGINT NOT NULL DEFAULT 0,
    margin_xof            BIGINT NOT NULL DEFAULT 0,
    cost_per_kg_xof       INTEGER,

    -- Couverture de valorisation : un article consommé sans prix pèse zéro dans le
    -- total. Sans ces deux compteurs, le bilan mentirait par omission — et toujours
    -- dans le même sens, en flattant.
    consumed_articles     INTEGER NOT NULL DEFAULT 0,
    valued_articles       INTEGER NOT NULL DEFAULT 0,

    notes                 TEXT,
    created_at            TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_unit_closures_farm ON unit_closures(farm_id);

CREATE TRIGGER trg_unit_closures_updated_at
    BEFORE UPDATE ON unit_closures
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
