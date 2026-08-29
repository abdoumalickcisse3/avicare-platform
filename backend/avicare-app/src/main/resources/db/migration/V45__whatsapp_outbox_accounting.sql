-- Console Phase 3 — WhatsApp accounting.
--
-- Two gaps this closes.
--
-- The interactive path (WhatsAppMessenger.sendNow, used by the password reset) sends straight to
-- Konekt and records nothing: those messages consume credits and leave no trace. Recording them
-- here as already-terminal rows puts every send in one ledger.
--
-- And nothing tied a message to a farm, so "cost per farm" could not be answered at all.

ALTER TABLE whatsapp_outbox
    ADD COLUMN source VARCHAR(20) NOT NULL DEFAULT 'ALERT'
        CHECK (source IN ('ALERT', 'INTERACTIVE', 'BROADCAST'));

-- ON DELETE SET NULL, not CASCADE: purging a farm must not erase the record that credits were
-- spent on its behalf. The accounting outlives the tenant.
ALTER TABLE whatsapp_outbox
    ADD COLUMN farm_id BIGINT REFERENCES farms(id) ON DELETE SET NULL;

CREATE INDEX idx_whatsapp_outbox_created_at ON whatsapp_outbox(created_at);
CREATE INDEX idx_whatsapp_outbox_farm ON whatsapp_outbox(farm_id) WHERE farm_id IS NOT NULL;
