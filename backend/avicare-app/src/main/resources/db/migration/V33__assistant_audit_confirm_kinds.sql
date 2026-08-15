-- =====================================================================
-- V33 — Extend the assistant_audit kinds with the server-confirm outcomes.
-- CONFIRMED: an action claim was executed server-side via /assistant/confirm.
-- EXPIRED:   a claim was swept unconfirmed past its TTL.
-- (The interaction kinds DRAFT/ANSWER/CLARIFICATION are unchanged.)
-- =====================================================================

ALTER TABLE assistant_audit DROP CONSTRAINT assistant_audit_kind_check;

ALTER TABLE assistant_audit
    ADD CONSTRAINT assistant_audit_kind_check
    CHECK (kind IN ('DRAFT', 'ANSWER', 'CLARIFICATION', 'CONFIRMED', 'EXPIRED'));
