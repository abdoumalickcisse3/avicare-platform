-- V50 — Contrôles d'intégrité des données (chantier P2).
--
-- La cascade D18 (consommation de stock cross-contexte) et les workflows
-- commande → livraison → facture → paiement finiront par produire des incohérences : bugs subtils,
-- concurrence, déploiement raté. Sans détection automatique, on les découvre par un client furieux.
--
-- Numérotation : V50 pour P2, conformément à la règle posée en P3 (le numéro suit l'ordre de merge,
-- pas l'ordre du plan ; Flyway tourne sans out-of-order).
--
-- Deux écarts assumés par rapport au brouillon de la roadmap, dictés par l'usage quotidien :
--
--   1. `last_seen_at` + index unique partiel sur (check_key, entity_type, entity_id) tant que
--      l'anomalie n'est pas résolue. Le balayage tourne toutes les nuits : sans cela, la même
--      anomalie non corrigée créerait une ligne par nuit et la console deviendrait illisible en une
--      semaine. On met à jour la ligne existante au lieu d'en empiler.
--
--   2. `notified_at`. L'astreinte doit être prévenue d'une anomalie CRITICAL une fois, pas à chaque
--      passage du cron jusqu'au correctif — une alerte qui se répète est une alerte qu'on ignore.

CREATE TABLE integrity_findings (
    id                BIGSERIAL PRIMARY KEY,
    check_key         VARCHAR(80) NOT NULL,
    severity          VARCHAR(20) NOT NULL,
    entity_type       VARCHAR(50) NOT NULL,
    entity_id         BIGINT NOT NULL,
    farm_id           BIGINT REFERENCES farms(id) ON DELETE CASCADE,
    -- Valeurs sous forme texte : selon le contrôle il s'agit d'un montant, d'une quantité ou d'un
    -- état de workflow. Le comparatif se lit tel quel dans la console.
    expected_value    TEXT,
    actual_value      TEXT,
    details           JSONB NOT NULL DEFAULT '{}'::jsonb,
    detected_at       TIMESTAMP NOT NULL DEFAULT NOW(),
    last_seen_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    notified_at       TIMESTAMP,
    resolved_at       TIMESTAMP,
    resolved_by       BIGINT REFERENCES users(id) ON DELETE SET NULL,
    -- 'recomputed' (moteur de recalcul), 'manual_fix' (corrigé à la main dans l'app),
    -- 'accepted_drift' (écart assumé, avec raison), 'auto_resolved' (redevenu sain tout seul).
    resolution_action VARCHAR(80),
    resolution_notes  TEXT,
    created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_integrity_severity CHECK (severity IN ('INFO','WARNING','CRITICAL')),
    CONSTRAINT chk_integrity_resolution CHECK (
        (resolved_at IS NULL AND resolution_action IS NULL)
        OR (resolved_at IS NOT NULL AND resolution_action IS NOT NULL)
    )
);

CREATE TRIGGER trg_integrity_findings_updated_at
    BEFORE UPDATE ON integrity_findings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Une anomalie ouverte par (contrôle, entité) : le balayage suivant met à jour, il n'empile pas.
CREATE UNIQUE INDEX uq_integrity_open
    ON integrity_findings(check_key, entity_type, entity_id)
    WHERE resolved_at IS NULL;

-- Lectures attendues : le tableau de bord des anomalies ouvertes, l'enquête sur une entité,
-- et le filtre par ferme quand un client appelle.
CREATE INDEX idx_integrity_unresolved ON integrity_findings(severity, detected_at DESC)
    WHERE resolved_at IS NULL;
CREATE INDEX idx_integrity_entity ON integrity_findings(entity_type, entity_id);
CREATE INDEX idx_integrity_farm ON integrity_findings(farm_id, detected_at DESC)
    WHERE farm_id IS NOT NULL;
