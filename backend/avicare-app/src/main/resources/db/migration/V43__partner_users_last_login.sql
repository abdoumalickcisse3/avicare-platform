-- V43 — Console super-admin : dernière connexion d'un compte partenaire.
--
-- Sans elle, impossible de savoir si un partenaire signé se sert réellement du portail —
-- la seule métrique qui dise si le produit tient sa promesse. Même patron que
-- users.last_login_at, écrit au login.

ALTER TABLE partner_users ADD COLUMN last_login_at TIMESTAMP;
