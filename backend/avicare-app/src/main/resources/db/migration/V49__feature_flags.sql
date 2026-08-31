-- V49 — Kill switch plateforme (chantier P3).
--
-- Le gating existant répond « cette ferme a-t-elle payé ce module ? ». Cette table répond à une
-- question différente et plus urgente : « ce module est-il en train de corrompre des données ? ».
-- Un bug détecté à 22h doit pouvoir être coupé en un clic depuis la console, pour toutes les fermes
-- à la fois, sans SSH ni redéploiement.
--
-- Numérotation : la roadmap prévoyait V50 pour P3, mais l'ordre de merge est P1 → P3 → P2 et Flyway
-- tourne sans out-of-order. P3 prend donc V49, et P2 prendra V50, sinon la migration de P2 serait
-- refusée au démarrage sur une base déjà migrée.
--
-- Pas d'historique dédié : chaque bascule est déjà tracée dans admin_audit_log (actions « flag.* »),
-- table append-only. Un second journal à garder synchrone du premier serait un journal de moins.

CREATE TABLE feature_flags (
    id                    BIGSERIAL PRIMARY KEY,
    flag_key              VARCHAR(80) NOT NULL UNIQUE,
    -- Interrupteur permanent : un module qu'on ne veut pas servir pour l'instant.
    enabled_globally      BOOLEAN NOT NULL DEFAULT TRUE,
    -- Coupure d'urgence : temporaire par construction, elle expire toute seule.
    killswitch_active     BOOLEAN NOT NULL DEFAULT FALSE,
    killswitch_reason     TEXT,
    killswitch_by         BIGINT REFERENCES users(id) ON DELETE SET NULL,
    killswitch_at         TIMESTAMP,
    killswitch_expires_at TIMESTAMP,
    created_at            TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMP NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN feature_flags.killswitch_expires_at IS
    'Expiration automatique (30 min par défaut) : une coupure oubliée est une panne qu''on s''inflige.';

CREATE TRIGGER trg_feature_flags_updated_at
    BEFORE UPDATE ON feature_flags
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Lecture attendue : le balayage des coupures encore actives, par le job d'expiration.
CREATE INDEX idx_feature_flags_killswitch ON feature_flags(killswitch_expires_at)
    WHERE killswitch_active = TRUE;

-- Un flag par module réellement gaté dans le code (clés du catalogue V4), plus les mécanismes
-- transverses qu'on voudrait pouvoir couper séparément d'un module.
INSERT INTO feature_flags(flag_key) VALUES
  ('module.poultry.broiler'),
  ('module.poultry.layer'),
  ('module.health.basic'),
  ('module.health.advanced'),
  ('module.commercial.basic'),
  ('module.commercial.advanced'),
  ('module.inventory'),
  ('module.finance'),
  ('module.kpi.advanced'),
  ('module.buyer_portal'),
  ('module.qr_codes'),
  ('module.api_access'),
  ('cascade.d18.stock_consumption'),
  ('assistant.enabled'),
  ('whatsapp.outbound');

-- Le balayage d'expiration agit sans utilisateur derrière lui. Avec actor_user_id NOT NULL, son
-- entrée d'audit échouerait et serait silencieusement perdue (AdminAuditService avale l'erreur pour
-- ne jamais casser l'action qu'il trace) : une coupure qui se lève toute seule ne laisserait aucune
-- trace. Acteur nul = la plateforme elle-même ; le trigger append-only reste inchangé.
ALTER TABLE admin_audit_log ALTER COLUMN actor_user_id DROP NOT NULL;
