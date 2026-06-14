-- =====================================================================
-- V18 — Feed formulas (Sprint B4-4). Two parts: (1) platform formula
-- templates seeded as catalog_items under 'feed_formulas' (Décision 15 —
-- value in JSONB, read via ParametersFacade.listPlatform); (2) feed_formulas,
-- per-farm custom formulas a farmer creates from scratch or by cloning a
-- platform template.
--
-- D20 (V1): a formula is a reference/costing aid only — feed consumption is
-- still a single article on DailyRecord. No formula→ingredient stock
-- decomposition in V1.
--
-- Ingredient article_keys reference the inventory_items catalog (V15).
-- target_breed_keys is JSONB (house mapping pattern, no native PG array).
-- Single-line jsonb literals (V11+ lesson: :: binds tighter than ||).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Platform feed formula templates (locale NULL, V1). value JSONB:
--    {label, target_breed_keys[], target_phase, target_age_days_min/max,
--     species, ingredients[{article_key, percentage}], nutritional_targets, wave}
-- ---------------------------------------------------------------------
INSERT INTO catalog_items (category, key, value, locale) VALUES
  ('feed_formulas', 'formula_broiler_starter_cobb500',  '{"label":"Démarrage poulet chair - Cobb 500","target_breed_keys":["cobb_500"],"target_phase":"STARTER","target_age_days_min":1,"target_age_days_max":14,"species":"POULTRY","ingredients":[{"article_key":"corn_crushed","percentage":55.0},{"article_key":"protein_concentrate","percentage":30.0},{"article_key":"feed_starter_broiler","percentage":15.0}],"nutritional_targets":{"protein_pct":22.0,"energy_kcal_kg":3000,"calcium_pct":1.0},"wave":"V1"}'::jsonb, NULL),
  ('feed_formulas', 'formula_broiler_grower_cobb500',    '{"label":"Croissance poulet chair - Cobb 500","target_breed_keys":["cobb_500"],"target_phase":"GROWER","target_age_days_min":15,"target_age_days_max":28,"species":"POULTRY","ingredients":[{"article_key":"corn_crushed","percentage":60.0},{"article_key":"protein_concentrate","percentage":25.0},{"article_key":"feed_grower_broiler","percentage":15.0}],"nutritional_targets":{"protein_pct":20.0,"energy_kcal_kg":3100,"calcium_pct":0.9},"wave":"V1"}'::jsonb, NULL),
  ('feed_formulas', 'formula_broiler_finisher_cobb500',  '{"label":"Finition poulet chair - Cobb 500","target_breed_keys":["cobb_500"],"target_phase":"FINISHER","target_age_days_min":29,"target_age_days_max":42,"species":"POULTRY","ingredients":[{"article_key":"corn_crushed","percentage":65.0},{"article_key":"protein_concentrate","percentage":20.0},{"article_key":"feed_finisher_broiler","percentage":15.0}],"nutritional_targets":{"protein_pct":18.0,"energy_kcal_kg":3200,"calcium_pct":0.85},"wave":"V1"}'::jsonb, NULL),
  ('feed_formulas', 'formula_layer_pre_isabrown',        '{"label":"Pré-ponte pondeuse - ISA Brown","target_breed_keys":["isa_brown"],"target_phase":"PRE_LAYER","target_age_days_min":112,"target_age_days_max":126,"species":"POULTRY","ingredients":[{"article_key":"corn_crushed","percentage":60.0},{"article_key":"protein_concentrate","percentage":25.0},{"article_key":"feed_pre_layer","percentage":12.0},{"article_key":"grit_calcium","percentage":3.0}],"nutritional_targets":{"protein_pct":17.5,"energy_kcal_kg":2800,"calcium_pct":2.0},"wave":"V1"}'::jsonb, NULL),
  ('feed_formulas', 'formula_layer_isabrown',            '{"label":"Ponte pondeuse - ISA Brown","target_breed_keys":["isa_brown"],"target_phase":"LAYER","target_age_days_min":127,"target_age_days_max":null,"species":"POULTRY","ingredients":[{"article_key":"corn_crushed","percentage":58.0},{"article_key":"protein_concentrate","percentage":25.0},{"article_key":"feed_layer","percentage":10.0},{"article_key":"grit_calcium","percentage":7.0}],"nutritional_targets":{"protein_pct":17.0,"energy_kcal_kg":2750,"calcium_pct":3.8},"wave":"V1"}'::jsonb, NULL),
  ('feed_formulas', 'formula_layer_lohmann',             '{"label":"Ponte pondeuse - Lohmann Brown","target_breed_keys":["lohmann_brown"],"target_phase":"LAYER","target_age_days_min":127,"target_age_days_max":null,"species":"POULTRY","ingredients":[{"article_key":"corn_crushed","percentage":57.0},{"article_key":"protein_concentrate","percentage":26.0},{"article_key":"feed_layer","percentage":10.0},{"article_key":"grit_calcium","percentage":7.0}],"nutritional_targets":{"protein_pct":17.0,"energy_kcal_kg":2750,"calcium_pct":3.8},"wave":"V1"}'::jsonb, NULL);

-- ---------------------------------------------------------------------
-- 2. feed_formulas — per-farm custom formulas. ingredients JSONB array of
--    {article_key, article_source, percentage}. total_percentage / cost are
--    computed snapshots (cost from catalog typical prices, refreshable).
-- ---------------------------------------------------------------------
CREATE TABLE feed_formulas (
    id                            BIGSERIAL PRIMARY KEY,
    farm_id                       BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    name                          VARCHAR(150) NOT NULL,
    description                   TEXT,
    source_formula_key            VARCHAR(80),
    target_breed_keys             JSONB NOT NULL DEFAULT '[]'::jsonb,
    target_phase                  VARCHAR(20) NOT NULL,
    target_age_days_min           INTEGER,
    target_age_days_max           INTEGER,
    ingredients                   JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_percentage              NUMERIC(5,2),
    estimated_cost_per_100kg_xof  INTEGER,
    estimated_cost_calculated_at  TIMESTAMP,
    active                        BOOLEAN NOT NULL DEFAULT TRUE,
    notes                         TEXT,
    created_by                    BIGINT REFERENCES users(id),
    created_at                    TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at                    TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_ff_phase CHECK (target_phase IN
      ('STARTER', 'GROWER', 'FINISHER', 'PRE_LAYER', 'LAYER', 'BREEDER', 'OTHER')),
    CONSTRAINT chk_ff_age_range CHECK
      (target_age_days_min IS NULL OR target_age_days_max IS NULL
       OR target_age_days_min <= target_age_days_max)
);

CREATE INDEX idx_ff_farm ON feed_formulas(farm_id) WHERE active = TRUE;
CREATE INDEX idx_ff_phase ON feed_formulas(farm_id, target_phase);

CREATE TRIGGER trg_feed_formulas_updated_at
    BEFORE UPDATE ON feed_formulas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
