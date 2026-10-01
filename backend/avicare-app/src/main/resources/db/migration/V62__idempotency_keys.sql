-- V62 — Rejeu hors-ligne sans doublon.
-- Le mobile rejoue ses écritures en file d'attente avec une clé `Idempotency-Key`. Si la réponse
-- s'est perdue (réseau coupé après l'écriture), le rejeu ne doit pas écrire une seconde fois :
-- le serveur rend la réponse déjà donnée. Un seul mécanisme couvre tous les endpoints, au lieu
-- d'une colonne client_ref par table (V30 ne couvrait que mortalité et pesée).
-- status_code NULL = requête en cours de traitement ; renseigné = réponse mémorisée.

CREATE TABLE idempotency_keys (
    id            BIGSERIAL PRIMARY KEY,
    user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    idem_key      UUID NOT NULL,
    method        VARCHAR(10) NOT NULL,
    path          VARCHAR(255) NOT NULL,
    status_code   INTEGER,
    content_type  VARCHAR(100),
    response_body TEXT,
    created_at    TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
    completed_at  TIMESTAMP,
    CONSTRAINT uq_idempotency_keys_user_key UNIQUE (user_id, idem_key)
);
CREATE INDEX idx_idempotency_keys_created_at ON idempotency_keys(created_at);
