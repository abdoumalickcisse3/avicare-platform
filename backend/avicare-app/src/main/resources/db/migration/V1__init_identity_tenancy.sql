-- =====================================================================
-- V1 — Identity + Tenancy (Sprint A3)
-- Tables: users, refresh_tokens, farms, user_farms
-- Conventions: doc 04 §1/§3 — BIGSERIAL ids, TIMESTAMP (UTC, no TZ),
--   VARCHAR + CHECK for enums, trigger-managed updated_at.
-- Role CHECK constraints mirror the locked common-security enums
--   (UserRole = ADMIN/USER, FarmRole = OWNER/MANAGER/FARMER/VETERINARIAN/BUYER).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Reusable trigger: bumps updated_at on every UPDATE. Created once in V1.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- Users — platform accounts (authentication, profile, platform role).
-- ---------------------------------------------------------------------
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(200) NOT NULL,
    phone VARCHAR(30),
    avatar_url VARCHAR(500),
    locale VARCHAR(10) NOT NULL DEFAULT 'fr',
    role VARCHAR(30) NOT NULL DEFAULT 'USER'
        CHECK (role IN ('ADMIN', 'USER')),
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

-- ---------------------------------------------------------------------
-- Refresh tokens — DB source of truth for JWT refresh / revocation.
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- Farms — tenants (ex-"sites"). Soft-deletable.
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- User-Farm memberships — effective tenant role + permission overrides.
-- ---------------------------------------------------------------------
CREATE TABLE user_farms (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    farm_id BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    role VARCHAR(30) NOT NULL
        CHECK (role IN ('OWNER', 'MANAGER', 'FARMER', 'VETERINARIAN', 'BUYER')),
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
