-- =====================================================================
-- V32 — Assistant pending actions (server-side confirm claims).
-- An ADDITIONAL confirm path alongside the mobile client-held draft: when
-- the assistant produces a write DRAFT, a short-lived claim is stored here
-- and its id returned; a later POST /assistant/confirm {claimId} executes
-- the action server-side (via a DraftExecutor) before the claim expires.
--
-- Claims are ephemeral: deleted on confirm, and swept when past expires_at
-- (a scheduled job traces them EXPIRED in assistant_audit). Referenced by
-- id (no cross-context FK, ADR-008).
-- =====================================================================

CREATE TABLE assistant_pending_actions (
    id          BIGSERIAL   PRIMARY KEY,
    claim_id    VARCHAR(40) NOT NULL UNIQUE,
    farm_id     BIGINT      NOT NULL,
    user_id     BIGINT      NOT NULL,
    action      VARCHAR(60) NOT NULL,
    fields      JSONB       NOT NULL DEFAULT '{}'::jsonb,
    summary     TEXT        NULL,
    risk        VARCHAR(10) NULL,
    created_at  TIMESTAMP   NOT NULL DEFAULT NOW(),
    expires_at  TIMESTAMP   NOT NULL
);

CREATE INDEX idx_assistant_pending_expires ON assistant_pending_actions (expires_at);
