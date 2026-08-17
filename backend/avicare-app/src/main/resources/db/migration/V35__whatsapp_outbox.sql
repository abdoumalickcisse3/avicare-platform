-- V35 — Sprint C1 Phase 2 : outbox d'envoi WhatsApp (Konekt), best-effort asynchrone.
-- Une ligne par (notification, destinataire). Le dispatcher vide les PENDING avec retry.

CREATE TABLE whatsapp_outbox (
    id                BIGSERIAL PRIMARY KEY,
    notification_id   BIGINT NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    phone             VARCHAR(20) NOT NULL,
    message           TEXT NOT NULL,
    status            VARCHAR(10) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','SENT','FAILED')),
    attempts          INT NOT NULL DEFAULT 0,
    last_error        TEXT,
    provider_response JSONB,
    created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    sent_at           TIMESTAMP
);
CREATE INDEX idx_whatsapp_outbox_pending ON whatsapp_outbox(status, created_at);
