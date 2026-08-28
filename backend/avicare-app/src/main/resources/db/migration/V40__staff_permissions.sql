-- V40 — Console super-admin, Phase 0 : permissions du personnel plateforme.
--
-- Patron : les permissions membres côté ferme (user_farms.permissions), mais dans une table
-- dédiée et une taxonomie DISJOINTE — un droit staff ne se confond jamais avec un droit de ferme.
-- `UserRole.ADMIN` reste le marqueur « personnel plateforme » ; cette table dit ce que chaque
-- membre du personnel a le droit de faire.
--
-- Pas de deleted_at : une permission se retire, elle ne s'archive pas.
-- La permission '*' vaut SUPER_ADMIN (tout, implicitement) — même convention que les permissions
-- de ferme, où '*' est déjà le joker.
-- Cf. spec 2026-08-20 §5.1 et §6bis.4.

CREATE TABLE staff_permissions (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission VARCHAR(50) NOT NULL,
    granted_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, permission)
);

CREATE INDEX idx_staff_permissions_user ON staff_permissions(user_id);

CREATE TRIGGER trg_staff_permissions_updated_at
    BEFORE UPDATE ON staff_permissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
