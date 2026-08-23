-- V37 — Portail partenaire B1 : comptes de connexion partenaires (cloisonnés) + refresh tokens.
CREATE TABLE partner_users (
    id            BIGSERIAL PRIMARY KEY,
    partner_id    BIGINT NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    email         VARCHAR(200) NOT NULL UNIQUE,
    password_hash VARCHAR(100) NOT NULL,
    full_name     VARCHAR(200),
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_partner_users_partner ON partner_users(partner_id);
CREATE TRIGGER trg_partner_users_updated_at
    BEFORE UPDATE ON partner_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE partner_refresh_tokens (
    id              BIGSERIAL PRIMARY KEY,
    partner_user_id BIGINT NOT NULL REFERENCES partner_users(id) ON DELETE CASCADE,
    token           VARCHAR(500) NOT NULL UNIQUE,
    expires_at      TIMESTAMP NOT NULL,
    revoked_at      TIMESTAMP,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_partner_refresh_tokens_user ON partner_refresh_tokens(partner_user_id);
