-- V36 — Produit partenaire/coopérative (B2B2C, item J) : socle du lien ferme↔partenaire.
-- Contexte racine cross-tenant. Curseurs de partage = colonnes booléennes (défaut : opérationnel
-- ON, argent OFF). Cf. spec 2026-08-20-produit-partenaire-cooperative-design.

CREATE TABLE partners (
    id            BIGSERIAL PRIMARY KEY,
    name          VARCHAR(200) NOT NULL,
    type          VARCHAR(20) NOT NULL CHECK (type IN ('FEED_SUPPLIER','VET')),
    contact_name  VARCHAR(200),
    contact_phone VARCHAR(40),
    contact_email VARCHAR(200),
    logo_url      TEXT,
    status        VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','SUSPENDED')),
    created_by    BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at    TIMESTAMP
);
CREATE INDEX idx_partners_type ON partners(type) WHERE deleted_at IS NULL;
CREATE TRIGGER trg_partners_updated_at
    BEFORE UPDATE ON partners
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE partner_invite_codes (
    id          BIGSERIAL PRIMARY KEY,
    partner_id  BIGINT NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    code        VARCHAR(40) NOT NULL UNIQUE,
    active      BOOLEAN NOT NULL DEFAULT TRUE,
    max_uses    INTEGER,
    uses_count  INTEGER NOT NULL DEFAULT 0,
    expires_at  TIMESTAMP,
    created_by  BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_partner_invite_codes_partner ON partner_invite_codes(partner_id);
CREATE TRIGGER trg_partner_invite_codes_updated_at
    BEFORE UPDATE ON partner_invite_codes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE partner_farm_memberships (
    id                     BIGSERIAL PRIMARY KEY,
    partner_id             BIGINT NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    farm_id                BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    status                 VARCHAR(20) NOT NULL DEFAULT 'DECLARED'
                             CHECK (status IN ('DECLARED','CONFIRMED','LEFT')),
    origin                 VARCHAR(20) NOT NULL
                             CHECK (origin IN ('MANUAL_ADMIN','INVITE_CODE','FARMER_DECLARED')),
    invite_code_id         BIGINT REFERENCES partner_invite_codes(id) ON DELETE SET NULL,
    share_activity         BOOLEAN NOT NULL DEFAULT TRUE,
    share_flock_health     BOOLEAN NOT NULL DEFAULT TRUE,
    share_feed_consumption BOOLEAN NOT NULL DEFAULT TRUE,
    share_sales_volume     BOOLEAN NOT NULL DEFAULT FALSE,
    share_finances         BOOLEAN NOT NULL DEFAULT FALSE,
    created_by             BIGINT REFERENCES users(id) ON DELETE SET NULL,
    confirmed_at           TIMESTAMP,
    left_at                TIMESTAMP,
    created_at             TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX uq_partner_farm_active
    ON partner_farm_memberships(partner_id, farm_id) WHERE status <> 'LEFT';
CREATE INDEX idx_partner_farm_by_partner ON partner_farm_memberships(partner_id, status);
CREATE INDEX idx_partner_farm_by_farm ON partner_farm_memberships(farm_id, status);
CREATE TRIGGER trg_partner_farm_memberships_updated_at
    BEFORE UPDATE ON partner_farm_memberships
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
