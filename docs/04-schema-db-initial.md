# 04 — Schéma DB initial (Flyway)

> Document de référence pour toutes les migrations DB de la V1.
> À donner en contexte à Claude Code à chaque sprint où on ajoute des tables.

---

## 1. Principes fondamentaux

### Règles d'or

1. **Flyway est la SEULE source de vérité du schéma**. JAMAIS d'auto-DDL Hibernate en prod (`ddl-auto: validate`).
2. **Une migration mergée est IMMUTABLE**. Si erreur → nouvelle migration corrective.
3. **Une migration = un sujet logique**. Pas de "V5 qui fait tout".
4. **Naming strict** : `V<num>__<description>.sql` (deux underscores).
5. **Toujours réversible mentalement** : si tu casses, tu sais comment réparer.

### Conventions techniques

| Élément | Convention |
|---|---|
| IDs | `BIGSERIAL PRIMARY KEY` |
| Timestamps | `created_at` + `updated_at` (trigger auto) |
| Soft delete | `deleted_at TIMESTAMP NULL` (sur entités métier) |
| Strings courts | `VARCHAR(N)` avec N réfléchi |
| Énumérations | `VARCHAR` + `CHECK constraint` (plus flexible que ENUM SQL) |
| Décimaux financiers | `NUMERIC(12, 2)` (12 chiffres dont 2 décimales) |
| Décimaux ratios | `NUMERIC(5, 4)` |
| Quantités | `INTEGER` ou `NUMERIC(10, 3)` selon contexte |
| JSON | `JSONB` (pas `JSON`) |
| Dates seules | `DATE` |
| Horodatages | `TIMESTAMP` (sans timezone, on stocke UTC) |
| Foreign keys | `BIGINT REFERENCES <table>(id)` avec `ON DELETE` explicite |
| Index FK | TOUJOURS sur les colonnes `xxx_id` filtrées |
| Index composites | `(farm_id, status)` pour requêtes fréquentes |
| Index partiels | `WHERE deleted_at IS NULL` pour soft delete |

### Trigger réutilisable `updated_at`

À créer une seule fois en V1 :

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

Puis sur chaque table :

```sql
CREATE TRIGGER trg_<table>_updated_at
    BEFORE UPDATE ON <table>
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

---

## 2. Vue d'ensemble du séquençage Flyway

| Version | Fichier | Sprint | Tables principales |
|---|---|---|---|
| V1 | `V1__init_identity_tenancy.sql` | A3 | users, refresh_tokens, farms, user_farms |
| V2 | `V2__init_subscription_entitlements.sql` | A4 | subscriptions, entitlements, subscription_change_requests, bundles |
| V3 | `V3__init_parameters.sql` | A4 | catalog_items, farm_settings, user_settings, farm_catalog_items, price_lists, price_list_items, client_price_lists, alert_thresholds |
| V4 | `V4__init_livestock_socle.sql` | A5 | breeds, production_units, lifecycle_events |
| V5 | `V5__init_poultry_batches.sql` | B1 | poultry_batches, daily_records |
| V6 | `V6__init_poultry_broiler.sql` | B1 | weighing_samples, growth_performance |
| V7 | `V7__init_poultry_layer.sql` | B2 | egg_collection_configs, egg_collections, egg_tray_stocks, daily_egg_productions |
| V8 | `V8__init_poultry_slaughter.sql` | B1-B2 | slaughter_records |
| V9 | `V9__init_health.sql` | B3 | vaccination_programs, vaccination_schedules, treatments, vet_visits, mortality_records, health_events |
| V10 | `V10__init_inventory.sql` | B4 | stock_categories, stocks, stock_movements, suppliers, purchase_orders, purchase_order_items, feed_formulas |
| V11 | `V11__init_commercial.sql` | B5 | clients, orders, order_items, sales, sale_items, deliveries, delivery_items, invoices, invoice_items, payments |
| V12 | `V12__init_finance.sql` | B6 | expense_categories, expenses, employees, salaries, salary_advances, batch_cost_allocations |
| V13 | `V13__init_notifications.sql` | C1 | notifications, notification_preferences, alerts |

---

## 3. Migrations détaillées

### V1 — `V1__init_identity_tenancy.sql`

```sql
-- =====================================================
-- V1 — Identity & Tenancy
-- =====================================================

-- Trigger réutilisable pour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------
-- Users
-- -----------------------------------------------------
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(200) NOT NULL,
    phone VARCHAR(30),
    avatar_url VARCHAR(500),
    locale VARCHAR(10) NOT NULL DEFAULT 'fr',
    role VARCHAR(30) NOT NULL DEFAULT 'USER'
        CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'USER')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    email_verified_at TIMESTAMP,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(LOWER(email));
CREATE INDEX idx_users_active ON users(is_active) WHERE is_active = TRUE;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------
-- Refresh tokens (pour JWT refresh)
-- -----------------------------------------------------
CREATE TABLE refresh_tokens (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(500) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

-- -----------------------------------------------------
-- Farms (ex-sites)
-- -----------------------------------------------------
CREATE TABLE farms (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    location VARCHAR(500),
    gps_latitude NUMERIC(10, 7),
    gps_longitude NUMERIC(10, 7),
    capacity INTEGER,
    timezone VARCHAR(50) NOT NULL DEFAULT 'Africa/Dakar',
    currency VARCHAR(3) NOT NULL DEFAULT 'XOF',
    ninea VARCHAR(50),
    rccm VARCHAR(50),
    logo_url VARCHAR(500),
    created_by BIGINT NOT NULL REFERENCES users(id),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_farms_created_by ON farms(created_by);
CREATE INDEX idx_farms_active ON farms(is_active) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_farms_updated_at
    BEFORE UPDATE ON farms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------
-- User-Farm memberships (rôle effectif par ferme)
-- -----------------------------------------------------
CREATE TABLE user_farms (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    farm_id BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    role VARCHAR(30) NOT NULL
        CHECK (role IN ('OWNER', 'MANAGER', 'FARMER', 'ACCOUNTANT', 'BUYER')),
    permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
    invited_by BIGINT REFERENCES users(id),
    joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, farm_id)
);

CREATE INDEX idx_user_farms_user_id ON user_farms(user_id) WHERE is_active = TRUE;
CREATE INDEX idx_user_farms_farm_id ON user_farms(farm_id) WHERE is_active = TRUE;

CREATE TRIGGER trg_user_farms_updated_at
    BEFORE UPDATE ON user_farms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

### V2 — `V2__init_subscription_entitlements.sql`

```sql
-- =====================================================
-- V2 — Subscriptions & Entitlements
-- =====================================================

-- -----------------------------------------------------
-- Bundles (référentiel des packs commerciaux prédéfinis)
-- -----------------------------------------------------
CREATE TABLE bundles (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    monthly_price NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'XOF',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_bundles_updated_at
    BEFORE UPDATE ON bundles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed des bundles V1
INSERT INTO bundles (code, name, description, monthly_price, sort_order) VALUES
    ('starter_volaille',  'Starter Volaille',  'Pour familles débutant en volaille',    15000.00, 1),
    ('pro_volaille',      'Pro Volaille',      'Pour pros volaille en croissance',      25000.00, 2),
    ('ferme_complete',    'Ferme Complète',    'Multi-sites, tous modules',             45000.00, 3),
    ('custom',            'Sur mesure',        'Devis personnalisé',                        0.00, 99);

-- -----------------------------------------------------
-- Subscriptions
-- -----------------------------------------------------
CREATE TABLE subscriptions (
    id BIGSERIAL PRIMARY KEY,
    farm_id BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    bundle_code VARCHAR(50) REFERENCES bundles(code),
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('TRIAL', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'CANCELLED')),
    trial_ends_at TIMESTAMP,
    start_date DATE NOT NULL,
    end_date DATE,
    auto_renew BOOLEAN NOT NULL DEFAULT TRUE,
    custom_pricing NUMERIC(12, 2),
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (farm_id)
);

CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_end_date ON subscriptions(end_date) WHERE status = 'ACTIVE';

CREATE TRIGGER trg_subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------
-- Entitlements (features + quotas activés par souscription)
-- -----------------------------------------------------
CREATE TABLE entitlements (
    id BIGSERIAL PRIMARY KEY,
    subscription_id BIGINT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    feature_key VARCHAR(100) NOT NULL,
    feature_kind VARCHAR(20) NOT NULL DEFAULT 'BOOLEAN'
        CHECK (feature_kind IN ('BOOLEAN', 'QUOTA')),
    enforcement_mode VARCHAR(20) NOT NULL DEFAULT 'HARD'
        CHECK (enforcement_mode IN ('OFF', 'SHADOW', 'SOFT', 'HARD')),
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    quota_value BIGINT,
    expires_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (subscription_id, feature_key)
);

CREATE INDEX idx_entitlements_subscription_id ON entitlements(subscription_id);
CREATE INDEX idx_entitlements_feature_key ON entitlements(feature_key);

CREATE TRIGGER trg_entitlements_updated_at
    BEFORE UPDATE ON entitlements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------
-- Bundle templates (quels entitlements par bundle, pour clone à la création)
-- -----------------------------------------------------
CREATE TABLE bundle_entitlement_templates (
    id BIGSERIAL PRIMARY KEY,
    bundle_code VARCHAR(50) NOT NULL REFERENCES bundles(code) ON DELETE CASCADE,
    feature_key VARCHAR(100) NOT NULL,
    feature_kind VARCHAR(20) NOT NULL DEFAULT 'BOOLEAN',
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    quota_value BIGINT,
    UNIQUE (bundle_code, feature_key)
);

-- Seed des templates pour les 3 bundles principaux
INSERT INTO bundle_entitlement_templates (bundle_code, feature_key, feature_kind, enabled, quota_value) VALUES
    -- Starter Volaille
    ('starter_volaille', 'module.poultry.broiler',    'BOOLEAN', TRUE, NULL),
    ('starter_volaille', 'module.poultry.layer',      'BOOLEAN', TRUE, NULL),
    ('starter_volaille', 'module.health.basic',       'BOOLEAN', TRUE, NULL),
    ('starter_volaille', 'quota.farms_max',           'QUOTA',   TRUE, 1),
    ('starter_volaille', 'quota.users_max',           'QUOTA',   TRUE, 2),
    ('starter_volaille', 'quota.animals_max',         'QUOTA',   TRUE, 1000),
    -- Pro Volaille
    ('pro_volaille', 'module.poultry.broiler',        'BOOLEAN', TRUE, NULL),
    ('pro_volaille', 'module.poultry.layer',          'BOOLEAN', TRUE, NULL),
    ('pro_volaille', 'module.health.basic',           'BOOLEAN', TRUE, NULL),
    ('pro_volaille', 'module.health.advanced',        'BOOLEAN', TRUE, NULL),
    ('pro_volaille', 'module.commercial.basic',       'BOOLEAN', TRUE, NULL),
    ('pro_volaille', 'module.inventory',              'BOOLEAN', TRUE, NULL),
    ('pro_volaille', 'quota.farms_max',               'QUOTA',   TRUE, 3),
    ('pro_volaille', 'quota.users_max',               'QUOTA',   TRUE, 4),
    ('pro_volaille', 'quota.animals_max',             'QUOTA',   TRUE, 3000),
    -- Ferme Complète
    ('ferme_complete', 'module.poultry.broiler',      'BOOLEAN', TRUE, NULL),
    ('ferme_complete', 'module.poultry.layer',        'BOOLEAN', TRUE, NULL),
    ('ferme_complete', 'module.health.basic',         'BOOLEAN', TRUE, NULL),
    ('ferme_complete', 'module.health.advanced',      'BOOLEAN', TRUE, NULL),
    ('ferme_complete', 'module.commercial.basic',     'BOOLEAN', TRUE, NULL),
    ('ferme_complete', 'module.commercial.advanced',  'BOOLEAN', TRUE, NULL),
    ('ferme_complete', 'module.inventory',            'BOOLEAN', TRUE, NULL),
    ('ferme_complete', 'module.finance',              'BOOLEAN', TRUE, NULL),
    ('ferme_complete', 'module.kpi.advanced',         'BOOLEAN', TRUE, NULL),
    ('ferme_complete', 'module.buyer_portal',         'BOOLEAN', TRUE, NULL),
    ('ferme_complete', 'module.qr_codes',             'BOOLEAN', TRUE, NULL),
    ('ferme_complete', 'quota.farms_max',             'QUOTA',   TRUE, 10),
    ('ferme_complete', 'quota.users_max',             'QUOTA',   TRUE, 14),
    ('ferme_complete', 'quota.animals_max',           'QUOTA',   TRUE, 10000);

-- -----------------------------------------------------
-- Subscription change requests
-- -----------------------------------------------------
CREATE TABLE subscription_change_requests (
    id BIGSERIAL PRIMARY KEY,
    subscription_id BIGINT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    requested_bundle_code VARCHAR(50) NOT NULL REFERENCES bundles(code),
    custom_entitlements JSONB,
    reason TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
    requested_by BIGINT NOT NULL REFERENCES users(id),
    reviewed_by BIGINT REFERENCES users(id),
    reviewed_at TIMESTAMP,
    review_notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscription_change_requests_status ON subscription_change_requests(status);
CREATE INDEX idx_subscription_change_requests_subscription_id ON subscription_change_requests(subscription_id);

CREATE TRIGGER trg_subscription_change_requests_updated_at
    BEFORE UPDATE ON subscription_change_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

### V3 — `V3__init_parameters.sql`

```sql
-- =====================================================
-- V3 — Parameters (3 couches : catalog plateforme / settings ferme / settings user)
-- =====================================================

-- -----------------------------------------------------
-- Catalog items (référentiels plateforme)
-- -----------------------------------------------------
CREATE TABLE catalog_items (
    id BIGSERIAL PRIMARY KEY,
    category VARCHAR(50) NOT NULL,
    species VARCHAR(20),
    code VARCHAR(100) NOT NULL,
    name_fr VARCHAR(200) NOT NULL,
    name_wo VARCHAR(200),
    name_en VARCHAR(200),
    description_fr TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (category, code)
);

CREATE INDEX idx_catalog_items_category_species ON catalog_items(category, species);
CREATE INDEX idx_catalog_items_active ON catalog_items(is_active);

CREATE TRIGGER trg_catalog_items_updated_at
    BEFORE UPDATE ON catalog_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed des races/souches V1 (volaille)
INSERT INTO catalog_items (category, species, code, name_fr, sort_order) VALUES
    ('breed', 'POULTRY', 'cobb_500',      'Cobb 500',      1),
    ('breed', 'POULTRY', 'ross_308',      'Ross 308',      2),
    ('breed', 'POULTRY', 'isa_brown',     'ISA Brown',     3),
    ('breed', 'POULTRY', 'lohmann_brown', 'Lohmann Brown', 4),
    ('breed', 'POULTRY', 'arbor_acres',   'Arbor Acres',   5),
    ('breed', 'POULTRY', 'local',         'Race locale',   99);

-- Seed des catégories de dépenses
INSERT INTO catalog_items (category, code, name_fr, sort_order) VALUES
    ('expense_category', 'feed',         'Aliment',         1),
    ('expense_category', 'vaccines',     'Vaccins',         2),
    ('expense_category', 'treatments',   'Traitements',     3),
    ('expense_category', 'salaries',     'Salaires',        4),
    ('expense_category', 'water',        'Eau',             5),
    ('expense_category', 'electricity',  'Électricité',     6),
    ('expense_category', 'equipment',    'Équipement',      7),
    ('expense_category', 'transport',    'Transport',       8),
    ('expense_category', 'maintenance',  'Maintenance',     9),
    ('expense_category', 'other',        'Autre',          99);

-- Seed des méthodes de paiement
INSERT INTO catalog_items (category, code, name_fr, sort_order, metadata) VALUES
    ('payment_method', 'cash',          'Espèces',         1, '{"icon":"cash"}'),
    ('payment_method', 'wave',          'Wave',            2, '{"icon":"wave","color":"#1DCDFE"}'),
    ('payment_method', 'orange_money',  'Orange Money',    3, '{"icon":"om","color":"#FF6600"}'),
    ('payment_method', 'free_money',    'Free Money',      4, '{"icon":"free","color":"#CD1041"}'),
    ('payment_method', 'bank_transfer', 'Virement',        5, '{"icon":"bank"}'),
    ('payment_method', 'check',         'Chèque',          6, '{"icon":"check"}');

-- -----------------------------------------------------
-- Farm catalog items (extensions custom par ferme)
-- -----------------------------------------------------
CREATE TABLE farm_catalog_items (
    id BIGSERIAL PRIMARY KEY,
    farm_id BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL,
    parent_catalog_id BIGINT REFERENCES catalog_items(id),
    code VARCHAR(100) NOT NULL,
    name VARCHAR(200) NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (farm_id, category, code)
);

CREATE INDEX idx_farm_catalog_items_farm_category ON farm_catalog_items(farm_id, category);

CREATE TRIGGER trg_farm_catalog_items_updated_at
    BEFORE UPDATE ON farm_catalog_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------
-- Farm settings (paramètres par ferme)
-- -----------------------------------------------------
CREATE TABLE farm_settings (
    id BIGSERIAL PRIMARY KEY,
    farm_id BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL,
    setting_key VARCHAR(100) NOT NULL,
    setting_value JSONB NOT NULL,
    updated_by BIGINT REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (farm_id, category, setting_key)
);

CREATE INDEX idx_farm_settings_farm_category ON farm_settings(farm_id, category);

CREATE TRIGGER trg_farm_settings_updated_at
    BEFORE UPDATE ON farm_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------
-- User settings (préférences par utilisateur)
-- -----------------------------------------------------
CREATE TABLE user_settings (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL,
    setting_key VARCHAR(100) NOT NULL,
    setting_value JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, category, setting_key)
);

CREATE INDEX idx_user_settings_user_category ON user_settings(user_id, category);

CREATE TRIGGER trg_user_settings_updated_at
    BEFORE UPDATE ON user_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------
-- Price lists
-- -----------------------------------------------------
CREATE TABLE price_lists (
    id BIGSERIAL PRIMARY KEY,
    farm_id BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    valid_from DATE,
    valid_to DATE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_price_lists_farm_id ON price_lists(farm_id);

CREATE TRIGGER trg_price_lists_updated_at
    BEFORE UPDATE ON price_lists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------
-- Price list items
-- -----------------------------------------------------
CREATE TABLE price_list_items (
    id BIGSERIAL PRIMARY KEY,
    price_list_id BIGINT NOT NULL REFERENCES price_lists(id) ON DELETE CASCADE,
    product_type VARCHAR(50) NOT NULL,
    product_variant JSONB NOT NULL DEFAULT '{}'::jsonb,
    unit VARCHAR(20) NOT NULL,
    unit_price NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'XOF',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_price_list_items_price_list_id ON price_list_items(price_list_id);
CREATE INDEX idx_price_list_items_product_type ON price_list_items(product_type);

CREATE TRIGGER trg_price_list_items_updated_at
    BEFORE UPDATE ON price_list_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------
-- Client price lists (tarifs négociés)
-- -----------------------------------------------------
CREATE TABLE client_price_lists (
    client_id BIGINT NOT NULL,
    price_list_id BIGINT NOT NULL REFERENCES price_lists(id) ON DELETE CASCADE,
    PRIMARY KEY (client_id, price_list_id)
);
-- Note : la FK vers clients sera ajoutée en V11 via ALTER TABLE

-- -----------------------------------------------------
-- Alert thresholds (seuils paramétrables)
-- -----------------------------------------------------
CREATE TABLE alert_thresholds (
    id BIGSERIAL PRIMARY KEY,
    farm_id BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    scope VARCHAR(50) NOT NULL CHECK (scope IN ('GLOBAL', 'BATCH', 'STOCK')),
    scope_id BIGINT,
    metric VARCHAR(100) NOT NULL,
    operator VARCHAR(10) NOT NULL CHECK (operator IN ('>', '<', '>=', '<=', '=')),
    threshold_value NUMERIC(15, 4) NOT NULL,
    unit VARCHAR(20),
    severity VARCHAR(20) NOT NULL DEFAULT 'WARNING'
        CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),
    notify_channels JSONB NOT NULL DEFAULT '["IN_APP"]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alert_thresholds_farm_scope ON alert_thresholds(farm_id, scope);
CREATE INDEX idx_alert_thresholds_metric ON alert_thresholds(metric);

CREATE TRIGGER trg_alert_thresholds_updated_at
    BEFORE UPDATE ON alert_thresholds
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

### V4 — `V4__init_livestock_socle.sql`

```sql
-- =====================================================
-- V4 — Livestock (socle universel pour toutes espèces)
-- =====================================================

-- -----------------------------------------------------
-- Breeds (races/souches) — référentiel propre + lien optionnel au catalog
-- -----------------------------------------------------
CREATE TABLE breeds (
    id BIGSERIAL PRIMARY KEY,
    species VARCHAR(20) NOT NULL
        CHECK (species IN ('POULTRY', 'OVINE', 'BOVINE', 'CAPRINE', 'PORCINE', 'OTHER')),
    code VARCHAR(100) NOT NULL,
    name VARCHAR(200) NOT NULL,
    catalog_item_id BIGINT REFERENCES catalog_items(id),
    farm_id BIGINT REFERENCES farms(id) ON DELETE CASCADE,
    growth_curve JSONB,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (species, code, farm_id)
);

CREATE INDEX idx_breeds_species ON breeds(species) WHERE is_active = TRUE;
CREATE INDEX idx_breeds_farm_id ON breeds(farm_id) WHERE farm_id IS NOT NULL;

CREATE TRIGGER trg_breeds_updated_at
    BEFORE UPDATE ON breeds
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed des breeds plateforme depuis catalog_items
INSERT INTO breeds (species, code, name, catalog_item_id, farm_id)
SELECT species, code, name_fr, id, NULL
FROM catalog_items
WHERE category = 'breed' AND species IS NOT NULL;

-- -----------------------------------------------------
-- Production units (TABLE PARENTE — héritage JPA JOINED)
-- -----------------------------------------------------
CREATE TABLE production_units (
    id BIGSERIAL PRIMARY KEY,
    farm_id BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    species VARCHAR(20) NOT NULL
        CHECK (species IN ('POULTRY', 'OVINE', 'BOVINE', 'CAPRINE', 'PORCINE', 'OTHER')),
    unit_kind VARCHAR(20) NOT NULL
        CHECK (unit_kind IN ('BATCH', 'INDIVIDUAL')),
    breed_id BIGINT REFERENCES breeds(id),
    name VARCHAR(200),
    start_date DATE NOT NULL,
    end_date DATE,
    current_count INTEGER NOT NULL DEFAULT 1 CHECK (current_count >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('PLANNED', 'ACTIVE', 'CLOSED', 'CANCELLED')),
    created_by BIGINT REFERENCES users(id),
    deleted_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_production_units_farm_id ON production_units(farm_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_production_units_species_kind ON production_units(species, unit_kind);
CREATE INDEX idx_production_units_status ON production_units(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_production_units_active ON production_units(farm_id, status) WHERE status = 'ACTIVE' AND deleted_at IS NULL;

CREATE TRIGGER trg_production_units_updated_at
    BEFORE UPDATE ON production_units
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------
-- Lifecycle events (événements génériques sur ProductionUnit)
-- -----------------------------------------------------
CREATE TABLE lifecycle_events (
    id BIGSERIAL PRIMARY KEY,
    production_unit_id BIGINT NOT NULL REFERENCES production_units(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    occurred_at TIMESTAMP NOT NULL DEFAULT NOW(),
    quantity_delta INTEGER NOT NULL DEFAULT 0,
    reason VARCHAR(100),
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by BIGINT REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lifecycle_events_production_unit ON lifecycle_events(production_unit_id);
CREATE INDEX idx_lifecycle_events_type_occurred ON lifecycle_events(event_type, occurred_at);
```

---

### V5 — `V5__init_poultry_batches.sql`

```sql
-- =====================================================
-- V5 — Poultry batches (héritage de production_units)
-- =====================================================

-- -----------------------------------------------------
-- Poultry batches (extension volaille)
-- -----------------------------------------------------
CREATE TABLE poultry_batches (
    production_unit_id BIGINT PRIMARY KEY REFERENCES production_units(id) ON DELETE CASCADE,
    poultry_type VARCHAR(20) NOT NULL
        CHECK (poultry_type IN ('BROILER', 'LAYER', 'MIXED')),
    initial_count INTEGER NOT NULL CHECK (initial_count > 0),
    building_label VARCHAR(100),
    target_weight_kg NUMERIC(8, 3),
    target_age_days INTEGER,
    target_production_rate NUMERIC(5, 2),
    expected_end_date DATE
);

CREATE INDEX idx_poultry_batches_type ON poultry_batches(poultry_type);

-- -----------------------------------------------------
-- Daily records (saisies quotidiennes sur un lot volaille)
-- -----------------------------------------------------
CREATE TABLE daily_records (
    id BIGSERIAL PRIMARY KEY,
    poultry_batch_id BIGINT NOT NULL REFERENCES poultry_batches(production_unit_id) ON DELETE CASCADE,
    record_date DATE NOT NULL,
    mortality_count INTEGER NOT NULL DEFAULT 0 CHECK (mortality_count >= 0),
    culling_count INTEGER NOT NULL DEFAULT 0 CHECK (culling_count >= 0),
    feed_consumed_kg NUMERIC(10, 3),
    water_consumed_l NUMERIC(10, 3),
    avg_weight_g NUMERIC(8, 2),
    eggs_collected INTEGER,
    eggs_broken INTEGER DEFAULT 0,
    temperature_c NUMERIC(4, 1),
    humidity_percent NUMERIC(5, 2),
    notes TEXT,
    recorded_by BIGINT REFERENCES users(id),
    deleted_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (poultry_batch_id, record_date)
);

CREATE INDEX idx_daily_records_batch_date ON daily_records(poultry_batch_id, record_date DESC) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_daily_records_updated_at
    BEFORE UPDATE ON daily_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

### V6 — `V6__init_poultry_broiler.sql`

```sql
-- =====================================================
-- V6 — Broiler (pesées + performance)
-- =====================================================

-- -----------------------------------------------------
-- Weighing samples (pesées échantillon)
-- -----------------------------------------------------
CREATE TABLE weighing_samples (
    id BIGSERIAL PRIMARY KEY,
    poultry_batch_id BIGINT NOT NULL REFERENCES poultry_batches(production_unit_id) ON DELETE CASCADE,
    sample_date DATE NOT NULL,
    age_days INTEGER NOT NULL,
    sample_size INTEGER NOT NULL CHECK (sample_size > 0),
    individual_weights JSONB NOT NULL,
    avg_weight_g NUMERIC(10, 3) NOT NULL,
    min_weight_g NUMERIC(10, 3),
    max_weight_g NUMERIC(10, 3),
    std_deviation NUMERIC(10, 3),
    uniformity_percent NUMERIC(5, 2),
    recorded_by BIGINT REFERENCES users(id),
    notes TEXT,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_weighing_samples_batch_date ON weighing_samples(poultry_batch_id, sample_date DESC) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_weighing_samples_updated_at
    BEFORE UPDATE ON weighing_samples
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------
-- Growth performance (snapshot calculé)
-- -----------------------------------------------------
CREATE TABLE growth_performance (
    id BIGSERIAL PRIMARY KEY,
    poultry_batch_id BIGINT NOT NULL REFERENCES poultry_batches(production_unit_id) ON DELETE CASCADE,
    snapshot_date DATE NOT NULL,
    age_days INTEGER NOT NULL,
    current_weight_g NUMERIC(10, 3),
    gmq_g_per_day NUMERIC(8, 3),
    feed_conversion_ratio NUMERIC(5, 3),
    cumulative_mortality_percent NUMERIC(5, 2),
    cumulative_feed_kg NUMERIC(12, 3),
    cumulative_water_l NUMERIC(12, 3),
    forecasted_target_date DATE,
    performance_score VARCHAR(20),
    computed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (poultry_batch_id, snapshot_date)
);

CREATE INDEX idx_growth_performance_batch ON growth_performance(poultry_batch_id, snapshot_date DESC);
```

---

### V7 — `V7__init_poultry_layer.sql`

```sql
-- =====================================================
-- V7 — Egg production (pour les pondeuses)
-- =====================================================

-- -----------------------------------------------------
-- Egg collection configs (par ferme)
-- -----------------------------------------------------
CREATE TABLE egg_collection_configs (
    id BIGSERIAL PRIMARY KEY,
    farm_id BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    collection_slots JSONB NOT NULL DEFAULT '[]'::jsonb,
    tray_size INTEGER NOT NULL DEFAULT 30 CHECK (tray_size > 0),
    grades_enabled JSONB NOT NULL DEFAULT '["S","M","L","XL"]'::jsonb,
    default_tray_price NUMERIC(10, 2),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (farm_id)
);

CREATE TRIGGER trg_egg_collection_configs_updated_at
    BEFORE UPDATE ON egg_collection_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------
-- Egg collections (collectes par créneau)
-- -----------------------------------------------------
CREATE TABLE egg_collections (
    id BIGSERIAL PRIMARY KEY,
    poultry_batch_id BIGINT NOT NULL REFERENCES poultry_batches(production_unit_id) ON DELETE CASCADE,
    collection_date DATE NOT NULL,
    slot_label VARCHAR(50),
    collected_at TIMESTAMP NOT NULL,
    total_eggs INTEGER NOT NULL CHECK (total_eggs >= 0),
    broken_eggs INTEGER NOT NULL DEFAULT 0 CHECK (broken_eggs >= 0),
    grades_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
    collected_by BIGINT REFERENCES users(id),
    notes TEXT,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_egg_collections_batch_date ON egg_collections(poultry_batch_id, collection_date DESC) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_egg_collections_updated_at
    BEFORE UPDATE ON egg_collections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------
-- Egg tray stocks (stock plaquettes en temps réel par ferme)
-- -----------------------------------------------------
CREATE TABLE egg_tray_stocks (
    farm_id BIGINT PRIMARY KEY REFERENCES farms(id) ON DELETE CASCADE,
    full_trays INTEGER NOT NULL DEFAULT 0 CHECK (full_trays >= 0),
    empty_trays INTEGER NOT NULL DEFAULT 0 CHECK (empty_trays >= 0),
    loose_eggs INTEGER NOT NULL DEFAULT 0 CHECK (loose_eggs >= 0),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_egg_tray_stocks_updated_at
    BEFORE UPDATE ON egg_tray_stocks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------
-- Daily egg productions (clôture jour agrégée)
-- -----------------------------------------------------
CREATE TABLE daily_egg_productions (
    id BIGSERIAL PRIMARY KEY,
    poultry_batch_id BIGINT NOT NULL REFERENCES poultry_batches(production_unit_id) ON DELETE CASCADE,
    production_date DATE NOT NULL,
    total_eggs INTEGER NOT NULL,
    total_broken INTEGER NOT NULL DEFAULT 0,
    laying_rate_percent NUMERIC(5, 2),
    breakage_rate_percent NUMERIC(5, 2),
    closed_by BIGINT REFERENCES users(id),
    closed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (poultry_batch_id, production_date)
);

CREATE INDEX idx_daily_egg_productions_batch_date ON daily_egg_productions(poultry_batch_id, production_date DESC);
```

---

### V8 — `V8__init_poultry_slaughter.sql`

```sql
-- =====================================================
-- V8 — Slaughter records (abattages)
-- =====================================================

CREATE TABLE slaughter_records (
    id BIGSERIAL PRIMARY KEY,
    poultry_batch_id BIGINT NOT NULL REFERENCES poultry_batches(production_unit_id) ON DELETE CASCADE,
    slaughter_date DATE NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    live_weight_total_kg NUMERIC(12, 3),
    carcass_weight_total_kg NUMERIC(12, 3),
    yield_percent NUMERIC(5, 2),
    destination VARCHAR(200),
    notes TEXT,
    recorded_by BIGINT REFERENCES users(id),
    deleted_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_slaughter_records_batch_date ON slaughter_records(poultry_batch_id, slaughter_date DESC) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_slaughter_records_updated_at
    BEFORE UPDATE ON slaughter_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

### V9 — `V9__init_health.sql`

```sql
-- =====================================================
-- V9 — Health (universel, toutes espèces)
-- =====================================================

-- -----------------------------------------------------
-- Vaccination programs (programmes de vaccination)
-- -----------------------------------------------------
CREATE TABLE vaccination_programs (
    id BIGSERIAL PRIMARY KEY,
    farm_id BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    species VARCHAR(20),
    program_items JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_template BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by BIGINT REFERENCES users(id),
    deleted_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vaccination_programs_farm ON vaccination_programs(farm_id) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_vaccination_programs_updated_at
    BEFORE UPDATE ON vaccination_programs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------
-- Vaccination schedules (planning par production unit)
-- -----------------------------------------------------
CREATE TABLE vaccination_schedules (
    id BIGSERIAL PRIMARY KEY,
    program_id BIGINT NOT NULL REFERENCES vaccination_programs(id) ON DELETE CASCADE,
    production_unit_id BIGINT NOT NULL REFERENCES production_units(id) ON DELETE CASCADE,
    vaccine_code VARCHAR(100) NOT NULL,
    vaccine_name VARCHAR(200) NOT NULL,
    scheduled_date DATE NOT NULL,
    executed_at TIMESTAMP,
    executed_by BIGINT REFERENCES users(id),
    quantity_doses INTEGER,
    notes TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'PLANNED'
        CHECK (status IN ('PLANNED', 'EXECUTED', 'SKIPPED', 'OVERDUE')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vaccination_schedules_unit_date ON vaccination_schedules(production_unit_id, scheduled_date);
CREATE INDEX idx_vaccination_schedules_status ON vaccination_schedules(status);

CREATE TRIGGER trg_vaccination_schedules_updated_at
    BEFORE UPDATE ON vaccination_schedules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------
-- Treatments (traitements vétérinaires + délais d'attente)
-- -----------------------------------------------------
CREATE TABLE treatments (
    id BIGSERIAL PRIMARY KEY,
    production_unit_id BIGINT NOT NULL REFERENCES production_units(id) ON DELETE CASCADE,
    medication_name VARCHAR(200) NOT NULL,
    medication_code VARCHAR(100),
    dose_per_animal VARCHAR(100),
    administration_route VARCHAR(50),
    treatment_reason VARCHAR(500),
    start_date DATE NOT NULL,
    end_date DATE,
    withdrawal_days_meat INTEGER DEFAULT 0,
    withdrawal_days_eggs INTEGER DEFAULT 0,
    withdrawal_end_meat DATE,
    withdrawal_end_eggs DATE,
    prescribed_by VARCHAR(200),
    administered_by BIGINT REFERENCES users(id),
    cost NUMERIC(12, 2),
    deleted_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_treatments_unit ON treatments(production_unit_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_treatments_withdrawal_meat ON treatments(withdrawal_end_meat) WHERE withdrawal_end_meat IS NOT NULL;
CREATE INDEX idx_treatments_withdrawal_eggs ON treatments(withdrawal_end_eggs) WHERE withdrawal_end_eggs IS NOT NULL;

CREATE TRIGGER trg_treatments_updated_at
    BEFORE UPDATE ON treatments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------
-- Vet visits
-- -----------------------------------------------------
CREATE TABLE vet_visits (
    id BIGSERIAL PRIMARY KEY,
    farm_id BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    production_unit_id BIGINT REFERENCES production_units(id),
    vet_name VARCHAR(200) NOT NULL,
    vet_contact VARCHAR(100),
    visit_date TIMESTAMP NOT NULL,
    purpose VARCHAR(500),
    findings TEXT,
    recommendations TEXT,
    cost NUMERIC(12, 2),
    attachments JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vet_visits_farm_date ON vet_visits(farm_id, visit_date DESC);

CREATE TRIGGER trg_vet_visits_updated_at
    BEFORE UPDATE ON vet_visits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------
-- Mortality records (mortalité détaillée, liée à production_unit_id)
-- -----------------------------------------------------
CREATE TABLE mortality_records (
    id BIGSERIAL PRIMARY KEY,
    production_unit_id BIGINT NOT NULL REFERENCES production_units(id) ON DELETE CASCADE,
    occurred_date DATE NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    cause VARCHAR(100),
    notes TEXT,
    recorded_by BIGINT REFERENCES users(id),
    deleted_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mortality_records_unit_date ON mortality_records(production_unit_id, occurred_date DESC) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_mortality_records_updated_at
    BEFORE UPDATE ON mortality_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------
-- Health events (événements sanitaires génériques)
-- -----------------------------------------------------
CREATE TABLE health_events (
    id BIGSERIAL PRIMARY KEY,
    production_unit_id BIGINT NOT NULL REFERENCES production_units(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) DEFAULT 'INFO'
        CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),
    occurred_at TIMESTAMP NOT NULL DEFAULT NOW(),
    description TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    recorded_by BIGINT REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_health_events_unit_date ON health_events(production_unit_id, occurred_at DESC);
```

---

### V10 — `V10__init_inventory.sql`

```sql
-- =====================================================
-- V10 — Inventory (stocks + achats)
-- =====================================================

-- -----------------------------------------------------
-- Stock categories
-- -----------------------------------------------------
CREATE TABLE stock_categories (
    id BIGSERIAL PRIMARY KEY,
    farm_id BIGINT REFERENCES farms(id) ON DELETE CASCADE,
    code VARCHAR(100) NOT NULL,
    name VARCHAR(200) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (farm_id, code)
);

CREATE TRIGGER trg_stock_categories_updated_at
    BEFORE UPDATE ON stock_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------
-- Stocks
-- -----------------------------------------------------
CREATE TABLE stocks (
    id BIGSERIAL PRIMARY KEY,
    farm_id BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    category_id BIGINT REFERENCES stock_categories(id),
    name VARCHAR(200) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    current_quantity NUMERIC(15, 3) NOT NULL DEFAULT 0,
    min_threshold NUMERIC(15, 3),
    avg_unit_cost NUMERIC(12, 2),
    last_movement_at TIMESTAMP,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stocks_farm ON stocks(farm_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_stocks_low ON stocks(farm_id, current_quantity)
    WHERE deleted_at IS NULL AND min_threshold IS NOT NULL;

CREATE TRIGGER trg_stocks_updated_at
    BEFORE UPDATE ON stocks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------
-- Stock movements
-- -----------------------------------------------------
CREATE TABLE stock_movements (
    id BIGSERIAL PRIMARY KEY,
    stock_id BIGINT NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
    movement_type VARCHAR(20) NOT NULL CHECK (movement_type IN ('IN', 'OUT', 'ADJUST')),
    quantity NUMERIC(15, 3) NOT NULL,
    unit_price NUMERIC(12, 2),
    total_cost NUMERIC(15, 2),
    reason VARCHAR(100),
    reference_type VARCHAR(50),
    reference_id BIGINT,
    occurred_at TIMESTAMP NOT NULL DEFAULT NOW(),
    notes TEXT,
    recorded_by BIGINT REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stock_movements_stock_date ON stock_movements(stock_id, occurred_at DESC);

-- -----------------------------------------------------
-- Suppliers
-- -----------------------------------------------------
CREATE TABLE suppliers (
    id BIGSERIAL PRIMARY KEY,
    farm_id BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    contact_name VARCHAR(200),
    phone VARCHAR(30),
    email VARCHAR(255),
    address TEXT,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_suppliers_farm ON suppliers(farm_id) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_suppliers_updated_at
    BEFORE UPDATE ON suppliers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------
-- Purchase orders
-- -----------------------------------------------------
CREATE TABLE purchase_orders (
    id BIGSERIAL PRIMARY KEY,
    farm_id BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    supplier_id BIGINT REFERENCES suppliers(id),
    reference VARCHAR(100),
    order_date DATE NOT NULL,
    expected_delivery_date DATE,
    received_at TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT', 'SENT', 'RECEIVED', 'PARTIAL', 'CANCELLED')),
    total_amount NUMERIC(15, 2),
    currency VARCHAR(3) NOT NULL DEFAULT 'XOF',
    notes TEXT,
    created_by BIGINT REFERENCES users(id),
    deleted_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_purchase_orders_farm_status ON purchase_orders(farm_id, status) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_purchase_orders_updated_at
    BEFORE UPDATE ON purchase_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------
-- Purchase order items
-- -----------------------------------------------------
CREATE TABLE purchase_order_items (
    id BIGSERIAL PRIMARY KEY,
    purchase_order_id BIGINT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    stock_id BIGINT REFERENCES stocks(id),
    product_name VARCHAR(200) NOT NULL,
    quantity NUMERIC(15, 3) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    unit_price NUMERIC(12, 2),
    total_amount NUMERIC(15, 2),
    received_quantity NUMERIC(15, 3) DEFAULT 0
);

CREATE INDEX idx_purchase_order_items_po ON purchase_order_items(purchase_order_id);

-- -----------------------------------------------------
-- Feed formulas
-- -----------------------------------------------------
CREATE TABLE feed_formulas (
    id BIGSERIAL PRIMARY KEY,
    farm_id BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    species VARCHAR(20),
    stage VARCHAR(50),
    ingredients JSONB NOT NULL DEFAULT '[]'::jsonb,
    estimated_cost_per_kg NUMERIC(10, 2),
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_feed_formulas_updated_at
    BEFORE UPDATE ON feed_formulas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

### V11 — `V11__init_commercial.sql`

```sql
-- =====================================================
-- V11 — Commercial (pipeline complet)
-- =====================================================

-- -----------------------------------------------------
-- Clients
-- -----------------------------------------------------
CREATE TABLE clients (
    id BIGSERIAL PRIMARY KEY,
    farm_id BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    user_id BIGINT REFERENCES users(id),
    name VARCHAR(200) NOT NULL,
    client_type VARCHAR(50),
    contact_name VARCHAR(200),
    phone VARCHAR(30),
    email VARCHAR(255),
    address TEXT,
    ninea VARCHAR(50),
    credit_limit NUMERIC(15, 2) DEFAULT 0,
    current_balance NUMERIC(15, 2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'XOF',
    payment_terms_days INTEGER DEFAULT 0,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clients_farm ON clients(farm_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_clients_user ON clients(user_id) WHERE user_id IS NOT NULL;

CREATE TRIGGER trg_clients_updated_at
    BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Ajout de la FK différée depuis V3
ALTER TABLE client_price_lists
    ADD CONSTRAINT fk_client_price_lists_client
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

-- -----------------------------------------------------
-- Orders
-- -----------------------------------------------------
CREATE TABLE orders (
    id BIGSERIAL PRIMARY KEY,
    farm_id BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    client_id BIGINT NOT NULL REFERENCES clients(id),
    reference VARCHAR(100),
    order_date DATE NOT NULL,
    expected_delivery_date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'CONFIRMED', 'IN_PROGRESS', 'DELIVERED', 'CANCELLED')),
    total_amount NUMERIC(15, 2),
    currency VARCHAR(3) NOT NULL DEFAULT 'XOF',
    notes TEXT,
    created_by BIGINT REFERENCES users(id),
    deleted_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_farm_status ON orders(farm_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_orders_client ON orders(client_id) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------
-- Order items
-- -----------------------------------------------------
CREATE TABLE order_items (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    production_unit_id BIGINT REFERENCES production_units(id),
    product_type VARCHAR(50) NOT NULL,
    product_description VARCHAR(500),
    quantity NUMERIC(15, 3) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    unit_price NUMERIC(12, 2) NOT NULL,
    total_amount NUMERIC(15, 2) NOT NULL
);

CREATE INDEX idx_order_items_order ON order_items(order_id);

-- -----------------------------------------------------
-- Sales
-- -----------------------------------------------------
CREATE TABLE sales (
    id BIGSERIAL PRIMARY KEY,
    farm_id BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    client_id BIGINT REFERENCES clients(id),
    order_id BIGINT REFERENCES orders(id),
    reference VARCHAR(100),
    sale_date DATE NOT NULL,
    total_amount NUMERIC(15, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'XOF',
    notes TEXT,
    recorded_by BIGINT REFERENCES users(id),
    deleted_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sales_farm_date ON sales(farm_id, sale_date DESC) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_sales_updated_at
    BEFORE UPDATE ON sales
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------
-- Sale items
-- -----------------------------------------------------
CREATE TABLE sale_items (
    id BIGSERIAL PRIMARY KEY,
    sale_id BIGINT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    production_unit_id BIGINT REFERENCES production_units(id),
    product_type VARCHAR(50) NOT NULL,
    product_description VARCHAR(500),
    quantity NUMERIC(15, 3) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    unit_price NUMERIC(12, 2) NOT NULL,
    total_amount NUMERIC(15, 2) NOT NULL
);

CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);

-- -----------------------------------------------------
-- Deliveries
-- -----------------------------------------------------
CREATE TABLE deliveries (
    id BIGSERIAL PRIMARY KEY,
    farm_id BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    client_id BIGINT REFERENCES clients(id),
    order_id BIGINT REFERENCES orders(id),
    sale_id BIGINT REFERENCES sales(id),
    reference VARCHAR(100),
    delivery_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PLANNED'
        CHECK (status IN ('PLANNED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED')),
    transporter VARCHAR(200),
    delivery_address TEXT,
    notes TEXT,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_deliveries_farm_status ON deliveries(farm_id, status) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_deliveries_updated_at
    BEFORE UPDATE ON deliveries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------
-- Delivery items
-- -----------------------------------------------------
CREATE TABLE delivery_items (
    id BIGSERIAL PRIMARY KEY,
    delivery_id BIGINT NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    production_unit_id BIGINT REFERENCES production_units(id),
    product_type VARCHAR(50) NOT NULL,
    product_description VARCHAR(500),
    quantity NUMERIC(15, 3) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    unit_price NUMERIC(12, 2),
    total_amount NUMERIC(15, 2)
);

CREATE INDEX idx_delivery_items_delivery ON delivery_items(delivery_id);

-- -----------------------------------------------------
-- Invoices
-- -----------------------------------------------------
CREATE TABLE invoices (
    id BIGSERIAL PRIMARY KEY,
    farm_id BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    client_id BIGINT NOT NULL REFERENCES clients(id),
    sale_id BIGINT REFERENCES sales(id),
    delivery_id BIGINT REFERENCES deliveries(id),
    invoice_number VARCHAR(100) NOT NULL,
    invoice_date DATE NOT NULL,
    due_date DATE,
    subtotal NUMERIC(15, 2) NOT NULL,
    tax_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(15, 2) NOT NULL,
    paid_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'XOF',
    status VARCHAR(20) NOT NULL DEFAULT 'UNPAID'
        CHECK (status IN ('DRAFT', 'UNPAID', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED')),
    notes TEXT,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (farm_id, invoice_number)
);

CREATE INDEX idx_invoices_farm_status ON invoices(farm_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoices_client ON invoices(client_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoices_due_date ON invoices(due_date) WHERE status IN ('UNPAID','PARTIAL') AND deleted_at IS NULL;

CREATE TRIGGER trg_invoices_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------
-- Invoice items
-- -----------------------------------------------------
CREATE TABLE invoice_items (
    id BIGSERIAL PRIMARY KEY,
    invoice_id BIGINT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    description VARCHAR(500) NOT NULL,
    quantity NUMERIC(15, 3) NOT NULL,
    unit VARCHAR(20),
    unit_price NUMERIC(12, 2) NOT NULL,
    total_amount NUMERIC(15, 2) NOT NULL
);

CREATE INDEX idx_invoice_items_invoice ON invoice_items(invoice_id);

-- -----------------------------------------------------
-- Payments
-- -----------------------------------------------------
CREATE TABLE payments (
    id BIGSERIAL PRIMARY KEY,
    farm_id BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    client_id BIGINT REFERENCES clients(id),
    invoice_id BIGINT REFERENCES invoices(id),
    sale_id BIGINT REFERENCES sales(id),
    delivery_id BIGINT REFERENCES deliveries(id),
    reference VARCHAR(100),
    payment_date DATE NOT NULL,
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'XOF',
    payment_method VARCHAR(50) NOT NULL,
    transaction_reference VARCHAR(200),
    notes TEXT,
    recorded_by BIGINT REFERENCES users(id),
    deleted_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_farm_date ON payments(farm_id, payment_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_payments_invoice ON payments(invoice_id) WHERE invoice_id IS NOT NULL;

CREATE TRIGGER trg_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

### V12 — `V12__init_finance.sql`

```sql
-- =====================================================
-- V12 — Finance (dépenses + RH + analytique)
-- =====================================================

-- -----------------------------------------------------
-- Expenses
-- -----------------------------------------------------
CREATE TABLE expenses (
    id BIGSERIAL PRIMARY KEY,
    farm_id BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    production_unit_id BIGINT REFERENCES production_units(id),
    category VARCHAR(50) NOT NULL,
    description VARCHAR(500),
    amount NUMERIC(15, 2) NOT NULL CHECK (amount >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'XOF',
    expense_date DATE NOT NULL,
    payment_method VARCHAR(50),
    receipt_url VARCHAR(500),
    recorded_by BIGINT REFERENCES users(id),
    deleted_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_expenses_farm_date ON expenses(farm_id, expense_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_expenses_unit ON expenses(production_unit_id) WHERE production_unit_id IS NOT NULL;
CREATE INDEX idx_expenses_category ON expenses(farm_id, category) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_expenses_updated_at
    BEFORE UPDATE ON expenses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------
-- Employees (employés de la ferme — différent de users)
-- -----------------------------------------------------
CREATE TABLE employees (
    id BIGSERIAL PRIMARY KEY,
    farm_id BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    user_id BIGINT REFERENCES users(id),
    full_name VARCHAR(200) NOT NULL,
    role VARCHAR(100),
    phone VARCHAR(30),
    monthly_base_salary NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'XOF',
    hired_at DATE NOT NULL,
    terminated_at DATE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_employees_farm_active ON employees(farm_id, is_active) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_employees_updated_at
    BEFORE UPDATE ON employees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------
-- Salaries
-- -----------------------------------------------------
CREATE TABLE salaries (
    id BIGSERIAL PRIMARY KEY,
    farm_id BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    employee_id BIGINT NOT NULL REFERENCES employees(id),
    pay_period_month INTEGER NOT NULL CHECK (pay_period_month BETWEEN 1 AND 12),
    pay_period_year INTEGER NOT NULL,
    base_salary NUMERIC(12, 2) NOT NULL,
    bonus NUMERIC(12, 2) NOT NULL DEFAULT 0,
    advance_deduction NUMERIC(12, 2) NOT NULL DEFAULT 0,
    other_deductions NUMERIC(12, 2) NOT NULL DEFAULT 0,
    net_amount NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'XOF',
    status VARCHAR(20) NOT NULL DEFAULT 'UNPAID'
        CHECK (status IN ('UNPAID', 'PAID', 'CANCELLED')),
    paid_at TIMESTAMP,
    payment_method VARCHAR(50),
    notes TEXT,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (employee_id, pay_period_year, pay_period_month)
);

CREATE INDEX idx_salaries_farm_period ON salaries(farm_id, pay_period_year, pay_period_month) WHERE deleted_at IS NULL;
CREATE INDEX idx_salaries_status ON salaries(status) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_salaries_updated_at
    BEFORE UPDATE ON salaries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------
-- Salary advances
-- -----------------------------------------------------
CREATE TABLE salary_advances (
    id BIGSERIAL PRIMARY KEY,
    farm_id BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    employee_id BIGINT NOT NULL REFERENCES employees(id),
    request_date DATE NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'XOF',
    reason TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'DEDUCTED', 'CANCELLED')),
    approved_by BIGINT REFERENCES users(id),
    approved_at TIMESTAMP,
    deducted_in_salary_id BIGINT REFERENCES salaries(id),
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_salary_advances_employee_status ON salary_advances(employee_id, status);

CREATE TRIGGER trg_salary_advances_updated_at
    BEFORE UPDATE ON salary_advances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------
-- Batch cost allocations (allocation manuelle de coûts à un lot)
-- Utile pour les coûts partagés (ex: salaire d'un fermier réparti sur plusieurs lots)
-- -----------------------------------------------------
CREATE TABLE batch_cost_allocations (
    id BIGSERIAL PRIMARY KEY,
    production_unit_id BIGINT NOT NULL REFERENCES production_units(id) ON DELETE CASCADE,
    source_type VARCHAR(50) NOT NULL,
    source_id BIGINT NOT NULL,
    allocated_amount NUMERIC(15, 2) NOT NULL,
    allocation_percent NUMERIC(5, 2),
    allocation_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_batch_cost_allocations_unit ON batch_cost_allocations(production_unit_id);
CREATE INDEX idx_batch_cost_allocations_source ON batch_cost_allocations(source_type, source_id);
```

---

### V13 — `V13__init_notifications.sql`

```sql
-- =====================================================
-- V13 — Notifications & alerts
-- =====================================================

-- -----------------------------------------------------
-- Alerts
-- -----------------------------------------------------
CREATE TABLE alerts (
    id BIGSERIAL PRIMARY KEY,
    farm_id BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    production_unit_id BIGINT REFERENCES production_units(id),
    alert_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'WARNING'
        CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    is_acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
    acknowledged_by BIGINT REFERENCES users(id),
    acknowledged_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alerts_farm_ack ON alerts(farm_id, is_acknowledged);
CREATE INDEX idx_alerts_severity_date ON alerts(severity, created_at DESC);

CREATE TRIGGER trg_alerts_updated_at
    BEFORE UPDATE ON alerts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------
-- Notifications (in-app)
-- -----------------------------------------------------
CREATE TABLE notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    farm_id BIGINT REFERENCES farms(id) ON DELETE CASCADE,
    notification_type VARCHAR(100) NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    link_to VARCHAR(500),
    metadata JSONB DEFAULT '{}'::jsonb,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC);

-- -----------------------------------------------------
-- Notification preferences
-- -----------------------------------------------------
CREATE TABLE notification_preferences (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_type VARCHAR(100) NOT NULL,
    channels JSONB NOT NULL DEFAULT '["IN_APP"]'::jsonb,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, notification_type)
);

CREATE INDEX idx_notification_preferences_user ON notification_preferences(user_id);

CREATE TRIGGER trg_notification_preferences_updated_at
    BEFORE UPDATE ON notification_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## 4. Mapping JPA — exemples critiques

### 4.1 — Héritage `JOINED` côté JPA

```java
// Dans livestock/domain/ProductionUnit.java
@Entity
@Table(name = "production_units")
@Inheritance(strategy = InheritanceType.JOINED)
@DiscriminatorColumn(name = "species", discriminatorType = DiscriminatorType.STRING)
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public abstract class ProductionUnit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "farm_id", nullable = false)
    private Long farmId;

    @Enumerated(EnumType.STRING)
    @Column(insertable = false, updatable = false)
    private Species species;

    @Enumerated(EnumType.STRING)
    @Column(name = "unit_kind", nullable = false)
    private UnitKind unitKind;

    @Column(name = "breed_id")
    private Long breedId;

    private String name;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date")
    private LocalDate endDate;

    @Column(name = "current_count", nullable = false)
    private Integer currentCount;

    @Enumerated(EnumType.STRING)
    private ProductionUnitStatus status;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;
}
```

```java
// Dans poultry/domain/PoultryBatch.java
@Entity
@Table(name = "poultry_batches")
@DiscriminatorValue("POULTRY")
@PrimaryKeyJoinColumn(name = "production_unit_id")
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
public class PoultryBatch extends ProductionUnit {

    @Enumerated(EnumType.STRING)
    @Column(name = "poultry_type", nullable = false)
    private PoultryType poultryType;

    @Column(name = "initial_count", nullable = false)
    private Integer initialCount;

    @Column(name = "building_label")
    private String buildingLabel;

    @Column(name = "target_weight_kg")
    private BigDecimal targetWeightKg;

    @Column(name = "target_age_days")
    private Integer targetAgeDays;

    @Column(name = "target_production_rate")
    private BigDecimal targetProductionRate;
}
```

### 4.2 — Référencement par ID, pas par @ManyToOne

```java
// ✅ BON
@Entity
@Table(name = "sales")
public class Sale {
    @Id @GeneratedValue private Long id;

    @Column(name = "farm_id", nullable = false)
    private Long farmId;          // ID seul

    @Column(name = "client_id")
    private Long clientId;        // ID seul

    @Column(name = "order_id")
    private Long orderId;         // ID seul

    // ...
}

// Quand on veut l'info client, on passe par la facade :
ClientCreditInfo credit = commercialFacade.getClientCredit(sale.getClientId());
```

### 4.3 — JSONB côté JPA (avec Hibernate 6.4)

Hibernate 6.4 supporte natively le JSON :

```java
@Column(columnDefinition = "jsonb")
@JdbcTypeCode(SqlTypes.JSON)
private Map<String, Object> metadata;

// Ou avec un POJO typé
@Column(columnDefinition = "jsonb")
@JdbcTypeCode(SqlTypes.JSON)
private List<ProgramItem> programItems;
```

---

## 5. Données de seed initiales

À créer après les migrations, dans une migration séparée `V100__seed_dev_data.sql` (uniquement en profil `dev`) :

```sql
-- Profil dev uniquement
-- Utilisateur super_admin de test
INSERT INTO users (email, password_hash, full_name, role, locale, is_active)
VALUES ('admin@avicare.local', '$2a$10$...', 'Super Admin', 'SUPER_ADMIN', 'fr', TRUE);

-- Utilisateur éleveur de test
INSERT INTO users (email, password_hash, full_name, role, locale, is_active)
VALUES ('test@avicare.local', '$2a$10$...', 'Éleveur Test', 'ADMIN', 'fr', TRUE);

-- Ferme de test
INSERT INTO farms (name, location, gps_latitude, gps_longitude, capacity, created_by)
VALUES ('Ferme Bambilor', 'Bambilor, Rufisque, Sénégal', 14.7333, -17.2167, 5000, 2);

-- Membership owner
INSERT INTO user_farms (user_id, farm_id, role, joined_at, is_active)
VALUES (2, 1, 'OWNER', NOW(), TRUE);

-- Souscription Pro
INSERT INTO subscriptions (farm_id, bundle_code, status, start_date)
VALUES (1, 'pro_volaille', 'ACTIVE', CURRENT_DATE);

-- Clone des entitlements du bundle vers la souscription
INSERT INTO entitlements (subscription_id, feature_key, feature_kind, enabled, quota_value)
SELECT 1, feature_key, feature_kind, enabled, quota_value
FROM bundle_entitlement_templates
WHERE bundle_code = 'pro_volaille';
```

---

## 6. Règles d'évolution du schéma

| Cas | Que faire |
|---|---|
| Ajouter une colonne | Nouvelle migration `V<n>__add_<col>_to_<table>.sql` avec `ALTER TABLE ... ADD COLUMN ...` |
| Supprimer une colonne | Idem mais `DROP COLUMN` — réfléchir 2× avant en prod (data perdue) |
| Renommer une colonne | `ALTER TABLE ... RENAME COLUMN old TO new` — attention aux dépendances code |
| Modifier un type | Souvent impossible directement, faire : ajouter nouvelle col → copier data → drop ancienne → renommer |
| Ajouter un index | `CREATE INDEX CONCURRENTLY` en prod (pour ne pas bloquer) — mais Flyway ne supporte pas, à faire manuellement |
| Migration de data | Migration séparée Flyway avec `INSERT/UPDATE/SELECT` |
| Rollback | Pas de rollback automatique avec Flyway gratuit — préparer un script manuel si besoin |

---

## 7. Checklist d'une migration "bien faite"

- [ ] Nom du fichier conforme : `V<n>__<description>.sql`
- [ ] Pas de modification d'une migration déjà mergée sur `main`
- [ ] Tous les `CHECK` et contraintes documentés explicitement
- [ ] Index sur toutes les FK filtrables
- [ ] Index partiels pour les soft deletes (`WHERE deleted_at IS NULL`)
- [ ] Triggers `updated_at` créés
- [ ] Pas de `SELECT *` dans la migration
- [ ] Données de seed séparées (profil dev only)
- [ ] Testée localement avec `make reset-db && make backend-run` (Flyway log doit montrer "Migrating to version X")
- [ ] Reviewée (par toi-même via Claude Code) avant merge

---

## 8. Pour Claude Code — prompt type

```
Lis :
- docs/00-vision-strategique.md
- docs/03-architecture-spring-boot.md (section du contexte concerné)
- docs/04-schema-db-initial.md (section de la migration à ajouter)

Aujourd'hui je dois créer la migration Flyway V<X> pour le bounded context <Y>.

Génère :
1. Le fichier SQL conforme aux conventions du §1 du doc DB
2. Les entités JPA correspondantes (héritage ProductionUnit si applicable)
3. Le repository Spring Data
4. Vérifie que toutes les FK ont leurs index
5. Vérifie que les triggers updated_at sont en place

Respecte STRICTEMENT les conventions de naming et les règles d'évolution.
```

---

_Document créé en démarrage du projet. À mettre à jour à chaque nouvelle migration majeure._
