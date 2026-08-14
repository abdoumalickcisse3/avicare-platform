-- =====================================================================
-- V31 — Assistant audit trail.
-- Append-only trace of every AI assistant interaction: what the field
-- worker asked and what the assistant produced (a DRAFT to confirm, an
-- ANSWER, or a CLARIFICATION). The actual write still happens on the
-- confirmed field endpoints (audited there via created_by); this records
-- the AI-side proposal/answer for traceability, debugging and analytics.
--
-- Immutable rows (only created_at, no updated_at, no soft delete).
-- farm_id / user_id are referenced by id (no cross-context FK, ADR-008).
-- =====================================================================

CREATE TABLE assistant_audit (
    id          BIGSERIAL PRIMARY KEY,
    farm_id     BIGINT      NOT NULL,
    user_id     BIGINT      NOT NULL,
    text        TEXT        NOT NULL,
    kind        VARCHAR(20) NOT NULL CHECK (kind IN ('DRAFT', 'ANSWER', 'CLARIFICATION')),
    action      VARCHAR(60) NULL,
    summary     TEXT        NULL,
    created_at  TIMESTAMP   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_assistant_audit_farm ON assistant_audit (farm_id, created_at DESC);
