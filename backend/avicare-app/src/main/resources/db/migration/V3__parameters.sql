-- =====================================================================
-- V3 — Parameters / 3-layer parametrization (Sprint A4)
-- Tables: catalog_items, farm_settings, user_settings, farm_catalog_items,
--   price_lists, price_list_items, alert_thresholds
-- Lookup priority (doc 06 §3): user_settings > farm_settings > catalog_items.
-- Conventions: TIMESTAMP (UTC), JSONB values, NUMERIC(12,2) money (doc 04/06),
--   updated_at via the V1 trigger. Soft delete only on price_lists.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Layer 1 — platform catalog. locale NULL = universal entry.
-- ---------------------------------------------------------------------
CREATE TABLE catalog_items (
    id         BIGSERIAL PRIMARY KEY,
    category   VARCHAR(50)  NOT NULL,
    key        VARCHAR(100) NOT NULL,
    value      JSONB        NOT NULL,
    locale     VARCHAR(10),
    is_active  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Uniqueness must hold even for the universal (locale IS NULL) row, which a
-- plain UNIQUE(category,key,locale) would not enforce (NULLs compare distinct).
CREATE UNIQUE INDEX ux_catalog_cat_key_locale ON catalog_items(category, key, locale)
    WHERE locale IS NOT NULL;
CREATE UNIQUE INDEX ux_catalog_cat_key_universal ON catalog_items(category, key)
    WHERE locale IS NULL;
CREATE INDEX idx_catalog_category ON catalog_items(category);

CREATE TRIGGER trg_catalog_items_updated_at
    BEFORE UPDATE ON catalog_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------
-- Layer 2 — farm settings.
-- ---------------------------------------------------------------------
CREATE TABLE farm_settings (
    id         BIGSERIAL PRIMARY KEY,
    farm_id    BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    key        VARCHAR(100) NOT NULL,
    value      JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (farm_id, key)
);

CREATE INDEX idx_farm_settings_farm ON farm_settings(farm_id);

CREATE TRIGGER trg_farm_settings_updated_at
    BEFORE UPDATE ON farm_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------
-- Layer 3 — user preferences.
-- ---------------------------------------------------------------------
CREATE TABLE user_settings (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key        VARCHAR(100) NOT NULL,
    value      JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, key)
);

CREATE INDEX idx_user_settings_user ON user_settings(user_id);

CREATE TRIGGER trg_user_settings_updated_at
    BEFORE UPDATE ON user_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------
-- Farm-level catalog overrides / additions / disables.
-- catalog_item_id NULL = a pure farm-custom item (no platform parent).
-- ---------------------------------------------------------------------
CREATE TABLE farm_catalog_items (
    id              BIGSERIAL PRIMARY KEY,
    farm_id         BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    catalog_item_id BIGINT REFERENCES catalog_items(id) ON DELETE SET NULL,
    category        VARCHAR(50)  NOT NULL,
    key             VARCHAR(100) NOT NULL,
    value           JSONB        NOT NULL,
    is_disabled     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (farm_id, category, key)
);

CREATE INDEX idx_farm_catalog_farm ON farm_catalog_items(farm_id);

CREATE TRIGGER trg_farm_catalog_items_updated_at
    BEFORE UPDATE ON farm_catalog_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------
-- Price lists (soft-deletable) and their items.
-- ---------------------------------------------------------------------
CREATE TABLE price_lists (
    id         BIGSERIAL PRIMARY KEY,
    farm_id    BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    name       VARCHAR(200) NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    valid_from DATE NOT NULL,
    valid_to   DATE,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_price_lists_farm ON price_lists(farm_id) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_price_lists_updated_at
    BEFORE UPDATE ON price_lists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE price_list_items (
    id            BIGSERIAL PRIMARY KEY,
    price_list_id BIGINT NOT NULL REFERENCES price_lists(id) ON DELETE CASCADE,
    product_key   VARCHAR(100) NOT NULL,
    unit_price    NUMERIC(12, 2) NOT NULL,
    currency      VARCHAR(3) NOT NULL DEFAULT 'XOF',
    created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (price_list_id, product_key)
);

CREATE INDEX idx_price_list_items_list ON price_list_items(price_list_id);

CREATE TRIGGER trg_price_list_items_updated_at
    BEFORE UPDATE ON price_list_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------
-- Alert thresholds (per farm).
-- ---------------------------------------------------------------------
CREATE TABLE alert_thresholds (
    id              BIGSERIAL PRIMARY KEY,
    farm_id         BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    threshold_type  VARCHAR(50) NOT NULL,
    threshold_value NUMERIC(12, 3) NOT NULL,
    severity        VARCHAR(20) NOT NULL
                      CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (farm_id, threshold_type)
);

CREATE INDEX idx_alert_thresholds_farm ON alert_thresholds(farm_id);

CREATE TRIGGER trg_alert_thresholds_updated_at
    BEFORE UPDATE ON alert_thresholds
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
