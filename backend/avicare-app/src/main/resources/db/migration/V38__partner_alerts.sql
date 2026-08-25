-- V38 — Couche « Garder » : alertes réseau destinées aux partenaires.
-- Même sémantique que `notifications` (une ligne ACTIVE par dedup_key, RESOLVED quand la
-- condition disparaît) mais table séparée : l'audience est `partner_users`, pas `users`,
-- et le périmètre est le partenaire, pas la ferme. Cf. spec 2026-08-24 couche « Garder ».

CREATE TABLE partner_alerts (
    id           BIGSERIAL PRIMARY KEY,
    partner_id   BIGINT NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    farm_id      BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    category     VARCHAR(30) NOT NULL CHECK (category IN ('FARM_SILENT','FARM_LEFT')),
    severity     VARCHAR(10) NOT NULL CHECK (severity IN ('INFO','WARNING','CRITICAL')),
    title        VARCHAR(200) NOT NULL,
    body         TEXT,
    dedup_key    VARCHAR(200) NOT NULL,
    status       VARCHAR(10) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','RESOLVED')),
    created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    resolved_at  TIMESTAMP
);

-- Idempotence du scan quotidien : une seule alerte ACTIVE par condition et par partenaire.
CREATE UNIQUE INDEX uq_partner_alerts_active_key
    ON partner_alerts(partner_id, dedup_key) WHERE status = 'ACTIVE';
CREATE INDEX idx_partner_alerts_feed ON partner_alerts(partner_id, status, created_at DESC);
CREATE INDEX idx_partner_alerts_farm ON partner_alerts(farm_id);

CREATE TRIGGER trg_partner_alerts_updated_at
    BEFORE UPDATE ON partner_alerts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Corrective de V35 : l'outbox WhatsApp sert désormais aussi des expéditeurs hors notification
-- éleveur (alertes partenaire). V35 reste immuable — on relâche la contrainte ici.
ALTER TABLE whatsapp_outbox ALTER COLUMN notification_id DROP NOT NULL;
