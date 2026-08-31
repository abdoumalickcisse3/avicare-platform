-- V51 — Détection de menaces et blocage d'IP (chantier P4).
--
-- Aujourd'hui : rien. Un attaquant peut forcer un mot de passe, créer des comptes en série ou
-- balayer les endpoints publics sans que personne ne le sache. Avant un premier client payant,
-- c'est autant une question de réputation que de coût d'infra.
--
-- Deux tables, deux durées de vie :
--   - security_events : le journal, gardé pour comprendre après coup.
--   - blocked_ips     : l'état courant, consulté à chaque requête.
--
-- Écart assumé vs la roadmap : `ip_address` est un VARCHAR(45) et non un INET. C'est le type déjà
-- utilisé par admin_audit_log.ip et request_traces.ip ; garder une seule représentation de l'IP
-- dans le schéma vaut mieux que le typage plus fin d'une troisième table isolée (et évite un
-- convertisseur JPA pour rien). 45 caractères = la longueur maximale d'une IPv6.

CREATE TABLE security_events (
    id          BIGSERIAL PRIMARY KEY,
    event_type  VARCHAR(50) NOT NULL,
    severity    VARCHAR(20) NOT NULL,
    ip_address  VARCHAR(45) NOT NULL,
    -- L'utilisateur quand il est connu ; l'email est conservé à part car un échec de connexion
    -- porte souvent un email qui ne correspond à aucun compte — et c'est justement le signal.
    user_id     BIGINT REFERENCES users(id) ON DELETE SET NULL,
    email       VARCHAR(255),
    user_agent  TEXT,
    details     JSONB NOT NULL DEFAULT '{}'::jsonb,
    action_taken VARCHAR(80),
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_security_severity CHECK (severity IN ('INFO','WARNING','CRITICAL')),
    CONSTRAINT chk_security_event_type CHECK (event_type IN (
        'FAILED_LOGIN', 'BRUTEFORCE_DETECTED', 'RATE_LIMIT_EXCEEDED',
        'SIGNUP_ANOMALY', 'IP_BLOCKED', 'IP_UNBLOCKED'
    ))
);

-- Lectures attendues : la chronologie des 7 derniers jours, l'enquête sur une IP, l'enquête sur un
-- email (« est-ce qu'on essaie d'entrer chez ce client ? »), et le filtre sur le grave.
CREATE INDEX idx_sec_events_recent ON security_events(created_at DESC);
CREATE INDEX idx_sec_events_ip ON security_events(ip_address, created_at DESC);
CREATE INDEX idx_sec_events_email ON security_events(email, created_at DESC) WHERE email IS NOT NULL;
CREATE INDEX idx_sec_events_critical ON security_events(created_at DESC) WHERE severity = 'CRITICAL';

CREATE TABLE blocked_ips (
    ip_address   VARCHAR(45) PRIMARY KEY,
    blocked_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    -- Toujours borné : un blocage automatique qui ne se lève jamais finit par exclure un vrai
    -- éleveur derrière un NAT d'opérateur, et personne ne saura pourquoi.
    blocked_until TIMESTAMP NOT NULL,
    reason       VARCHAR(255) NOT NULL,
    -- 'AUTO_BRUTEFORCE' ou l'email du membre du personnel qui a bloqué à la main.
    blocked_by   VARCHAR(120) NOT NULL,
    created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_blocked_ips_updated_at
    BEFORE UPDATE ON blocked_ips
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Le filtre ne demande qu'une chose, à chaque requête : « cette IP est-elle bloquée maintenant ? »
CREATE INDEX idx_blocked_ips_active ON blocked_ips(blocked_until);
