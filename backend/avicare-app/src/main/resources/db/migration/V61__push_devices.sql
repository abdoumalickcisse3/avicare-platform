-- V61 — Notifications push sur téléphone (Expo Push Service).
-- Un appareil = un jeton Expo, rattaché à un utilisateur (pas à une ferme : le téléphone suit la
-- personne). Le jeton est unique : un téléphone passé à un autre compte change de propriétaire.
-- revoked_at : jeton déclaré mort par Expo (DeviceNotRegistered) ou retiré à la déconnexion.

CREATE TABLE push_devices (
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token        VARCHAR(200) NOT NULL UNIQUE,
    platform     VARCHAR(10) NOT NULL CHECK (platform IN ('IOS','ANDROID')),
    last_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
    revoked_at   TIMESTAMP,
    created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_push_devices_user_active ON push_devices(user_id) WHERE revoked_at IS NULL;
CREATE TRIGGER trg_push_devices_updated_at
    BEFORE UPDATE ON push_devices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Le canal PUSH rejoint IN_APP et WHATSAPP dans les préférences (contrainte de V34 nommée par
-- Postgres : notification_preferences_channel_check).
ALTER TABLE notification_preferences DROP CONSTRAINT IF EXISTS notification_preferences_channel_check;
ALTER TABLE notification_preferences
    ADD CONSTRAINT notification_preferences_channel_check
    CHECK (channel IN ('IN_APP','WHATSAPP','PUSH'));
