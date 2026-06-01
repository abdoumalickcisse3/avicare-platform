-- =====================================================================
-- V2 — Subscription (Sprint A4)
-- Tables: subscriptions, subscription_modules, subscription_change_requests
-- Conventions (doc 06 §5): BIGSERIAL ids, TIMESTAMP (UTC, no TZ),
--   VARCHAR + CHECK for enums, updated_at via the V1 trigger function.
-- Decisions A4: no bundles table (D15 — entitlements only), feature modes
--   limited to OFF/HARD (D14), change-request workflow DRAFT→SUBMITTED→
--   APPROVED/REJECTED (D16).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Subscriptions — one per farm.
-- ---------------------------------------------------------------------
CREATE TABLE subscriptions (
    id            BIGSERIAL PRIMARY KEY,
    farm_id       BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    plan_key      VARCHAR(50),
    status        VARCHAR(30) NOT NULL DEFAULT 'TRIAL'
                    CHECK (status IN ('TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED', 'EXPIRED')),
    started_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at    TIMESTAMP,
    trial_ends_at TIMESTAMP,
    created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (farm_id)
);

CREATE INDEX idx_subscriptions_status ON subscriptions(status);

CREATE TRIGGER trg_subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------
-- Subscription modules — per-feature entitlements (no bundles table, D15).
-- ---------------------------------------------------------------------
CREATE TABLE subscription_modules (
    id              BIGSERIAL PRIMARY KEY,
    subscription_id BIGINT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    module_key      VARCHAR(100) NOT NULL,
    mode            VARCHAR(10) NOT NULL DEFAULT 'OFF'
                      CHECK (mode IN ('OFF', 'HARD')),
    expires_at      TIMESTAMP,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (subscription_id, module_key)
);

CREATE INDEX idx_subscription_modules_sub ON subscription_modules(subscription_id);

CREATE TRIGGER trg_subscription_modules_updated_at
    BEFORE UPDATE ON subscription_modules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------
-- Subscription change requests — review workflow (D16).
-- ---------------------------------------------------------------------
CREATE TABLE subscription_change_requests (
    id                BIGSERIAL PRIMARY KEY,
    subscription_id   BIGINT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    requested_plan    VARCHAR(50),
    requested_modules JSONB,
    status            VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
                        CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED')),
    requested_by      BIGINT NOT NULL REFERENCES users(id),
    reviewer_id       BIGINT REFERENCES users(id),
    reviewed_at       TIMESTAMP,
    reason            TEXT,
    created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_change_requests_sub ON subscription_change_requests(subscription_id);
CREATE INDEX idx_change_requests_status ON subscription_change_requests(status);

CREATE TRIGGER trg_change_requests_updated_at
    BEFORE UPDATE ON subscription_change_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
