-- V34 — Sprint C1 : notifications unifiées (in-app). WhatsApp outbox = V35.
-- Modèle "matérialiser sur transition" : une notif ACTIVE par condition (dedup_key),
-- résolue quand la condition disparaît (status=RESOLVED). Périmètre = ferme ;
-- l'état lu est par utilisateur (notification_reads). Cf. spec 2026-08-16.

CREATE TABLE notifications (
    id           BIGSERIAL PRIMARY KEY,
    farm_id      BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    category     VARCHAR(40) NOT NULL CHECK (category IN (
                   'MORTALITY_ANOMALY','VACCINATION_LATE','WITHDRAWAL_ENDING',
                   'CRITICAL_OBSERVATION','LOW_STOCK','NEGATIVE_STOCK',
                   'PO_OVERDUE','CREDIT_EXCEEDED','INVOICE_OVERDUE')),
    severity     VARCHAR(10) NOT NULL CHECK (severity IN ('INFO','WARNING','CRITICAL')),
    title        VARCHAR(200) NOT NULL,
    body         TEXT,
    source_ref   JSONB,
    dedup_key    VARCHAR(200) NOT NULL,
    status       VARCHAR(10) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','RESOLVED')),
    created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    resolved_at  TIMESTAMP
);
CREATE UNIQUE INDEX uq_notifications_active_key
    ON notifications(farm_id, dedup_key) WHERE status = 'ACTIVE';
CREATE INDEX idx_notifications_feed ON notifications(farm_id, status, created_at DESC);
CREATE TRIGGER trg_notifications_updated_at
    BEFORE UPDATE ON notifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE notification_reads (
    id               BIGSERIAL PRIMARY KEY,
    notification_id  BIGINT NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    user_id          BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    read_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (notification_id, user_id)
);
CREATE INDEX idx_notification_reads_user ON notification_reads(user_id);

CREATE TABLE notification_preferences (
    id           BIGSERIAL PRIMARY KEY,
    farm_id      BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category     VARCHAR(40) NOT NULL,
    channel      VARCHAR(10) NOT NULL CHECK (channel IN ('IN_APP','WHATSAPP')),
    enabled      BOOLEAN NOT NULL,
    min_severity VARCHAR(10) NOT NULL CHECK (min_severity IN ('INFO','WARNING','CRITICAL')),
    created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (farm_id, user_id, category, channel)
);
CREATE INDEX idx_notification_prefs_scope ON notification_preferences(farm_id, user_id);
CREATE TRIGGER trg_notification_preferences_updated_at
    BEFORE UPDATE ON notification_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
