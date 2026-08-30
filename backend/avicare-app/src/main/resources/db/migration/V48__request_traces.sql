-- V48 — Traçabilité des requêtes HTTP (chantier P1).
--
-- Objectif : quand un éleveur dit « j'ai eu une erreur ce matin à 10h37 », on retrouve la requête,
-- son payload et son erreur en quelques secondes depuis la console, au lieu de fouiller les logs
-- du conteneur. Le X-Correlation-Id qui circule déjà en MDC devient une clé de recherche.
--
-- Table à durée de vie courte : purge à 30 jours (job nocturne). Écrite hors du chemin de requête
-- (executor borné), donc elle n'a jamais le droit de ralentir ni de faire échouer un appel métier.
--
-- Pas de updated_at ni de trigger : une trace est écrite une fois et ne change jamais.
-- Pas de deleted_at : la purge supprime réellement (rétention, pas soft delete).
-- Pas d'unicité sur request_id : l'id peut venir du client (header entrant), et une trace perdue
-- vaut mieux qu'un insert en échec.

CREATE TABLE request_traces (
    id             BIGSERIAL PRIMARY KEY,
    request_id     VARCHAR(64) NOT NULL,
    method         VARCHAR(10) NOT NULL,
    path           VARCHAR(500) NOT NULL,
    route_pattern  VARCHAR(200),
    user_id        BIGINT REFERENCES users(id) ON DELETE SET NULL,
    user_email     VARCHAR(255),
    farm_id        BIGINT REFERENCES farms(id) ON DELETE SET NULL,
    status_code    INTEGER,
    duration_ms    INTEGER,
    ip             VARCHAR(45),
    request_body   TEXT,
    response_body  TEXT,
    error_message  TEXT,
    stack_trace    TEXT,
    started_at     TIMESTAMP NOT NULL,
    ended_at       TIMESTAMP NOT NULL,
    created_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN request_traces.user_email IS
    'Dénormalisé : on veut retrouver l''auteur même après désactivation ou anonymisation du compte.';
COMMENT ON COLUMN request_traces.request_body IS
    'Mutations JSON uniquement, secrets masqués et contenu tronqué. Jamais de multipart/binaire.';
COMMENT ON COLUMN request_traces.response_body IS
    'Uniquement en erreur (status >= 400), tronqué.';

-- Lectures attendues : la recherche par identifiant communiqué par le client, le flux
-- chronologique, l'activité d'un utilisateur ou d'une ferme, et le filtre « erreurs seulement ».
CREATE INDEX idx_traces_request_id ON request_traces(request_id);
CREATE INDEX idx_traces_recent     ON request_traces(started_at DESC);
CREATE INDEX idx_traces_user       ON request_traces(user_id, started_at DESC);
CREATE INDEX idx_traces_farm       ON request_traces(farm_id, started_at DESC);
CREATE INDEX idx_traces_errors     ON request_traces(started_at DESC) WHERE status_code >= 400;

-- Jointure trace <-> journal d'audit : depuis une trace on veut voir l'action staff correspondante,
-- et inversement. La colonne est nullable (les entrées antérieures à V48 n'ont pas d'id de requête,
-- et le bootstrap fondateur s'exécute hors requête HTTP).
--
-- Le trigger trg_admin_audit_log_append_only refuse UPDATE et DELETE de LIGNES ; un ALTER TABLE est
-- du DDL et n'est pas concerné. Les lignes existantes restent intactes (ajout d'une colonne
-- nullable, sans réécriture de table en PostgreSQL 11+).
ALTER TABLE admin_audit_log ADD COLUMN request_id VARCHAR(64);
CREATE INDEX idx_admin_audit_request ON admin_audit_log(request_id) WHERE request_id IS NOT NULL;
