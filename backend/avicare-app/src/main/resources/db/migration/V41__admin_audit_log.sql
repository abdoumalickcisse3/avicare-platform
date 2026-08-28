-- V41 — Console super-admin, Phase 0 : journal d'audit inviolable.
--
-- APPEND-ONLY, et pas seulement par convention applicative : le trigger ci-dessous refuse toute
-- UPDATE ou DELETE au niveau du moteur. Un journal d'audit qu'un accès à la base peut réécrire
-- n'est pas un journal d'audit.
--
-- Pas de colonne updated_at ni de trigger updated_at : une ligne ne change jamais.
-- Cf. spec 2026-08-20 §5.2 et §3bis.

CREATE TABLE admin_audit_log (
    id            BIGSERIAL PRIMARY KEY,
    actor_user_id BIGINT NOT NULL,
    action        VARCHAR(80) NOT NULL,
    target_type   VARCHAR(50),
    target_id     BIGINT,
    tenant_id     BIGINT,
    metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip            VARCHAR(45),
    created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Lectures attendues : le flux chronologique, l'activité d'un membre du personnel,
-- et tout ce qui a touché une ferme donnée (le cas le plus sensible).
CREATE INDEX idx_admin_audit_feed ON admin_audit_log(created_at DESC);
CREATE INDEX idx_admin_audit_actor ON admin_audit_log(actor_user_id, created_at DESC);
CREATE INDEX idx_admin_audit_tenant ON admin_audit_log(tenant_id, created_at DESC)
    WHERE tenant_id IS NOT NULL;

CREATE OR REPLACE FUNCTION admin_audit_log_is_append_only()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'admin_audit_log is append-only: % is not permitted', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_admin_audit_log_append_only
    BEFORE UPDATE OR DELETE ON admin_audit_log
    FOR EACH ROW EXECUTE FUNCTION admin_audit_log_is_append_only();
