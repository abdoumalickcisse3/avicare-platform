-- Console Phase 4 — platform announcements.
--
-- Staff-authored messages shown as a banner inside the farmer app. Deliberately not rows in
-- `notifications`: those are per-farm, materialised on a transition, and each carries a read
-- state. An announcement is authored once for everyone, has a lifetime, and is edited after
-- publication — three things the notification table is not shaped for.

CREATE TABLE announcements (
    id         BIGSERIAL PRIMARY KEY,
    title      VARCHAR(200) NOT NULL,
    body       TEXT         NOT NULL,
    severity   VARCHAR(20)  NOT NULL DEFAULT 'INFO'
        CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),
    -- A window rather than a single date: an announcement that cannot expire is one somebody has
    -- to remember to take down.
    starts_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    ends_at    TIMESTAMP,
    published  BOOLEAN      NOT NULL DEFAULT FALSE,
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_announcements_window ON announcements(starts_at, ends_at) WHERE published;

CREATE TRIGGER trg_announcements_updated_at
    BEFORE UPDATE ON announcements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
