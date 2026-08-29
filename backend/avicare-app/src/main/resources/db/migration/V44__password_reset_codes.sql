-- V44 — Réinitialisation de mot de passe par code WhatsApp.
--
-- Le code est stocké HACHÉ, et avec BCrypt et non SHA-256. La différence compte ici : un code à
-- 6 chiffres n'a qu'un million de combinaisons, qu'un SHA-256 permettrait de retrouver en
-- millisecondes à partir d'une fuite de la base. BCrypt(12) met ce parcours à des dizaines
-- d'heures — largement au-delà des 15 minutes de validité. (Pour un JWT de 550 caractères,
-- SHA-256 suffit : c'est l'entropie du secret qui décide, pas l'habitude.)
--
-- Usage unique (consumed_at), et le compteur de tentatives borne le brute force en ligne.

CREATE TABLE password_reset_codes (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash   VARCHAR(100) NOT NULL,
    expires_at  TIMESTAMP NOT NULL,
    consumed_at TIMESTAMP,
    attempts    INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- La recherche est toujours « le dernier code vivant de cet utilisateur ».
CREATE INDEX idx_password_reset_codes_user
    ON password_reset_codes(user_id, created_at DESC);
