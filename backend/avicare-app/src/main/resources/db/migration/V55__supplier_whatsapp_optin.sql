-- Prévenir un fournisseur par WhatsApp est un message à un TIERS : quelqu'un qui
-- n'a rien accepté de la plateforme, et à qui l'éleveur doit de l'argent. Le défaut
-- est donc FALSE, et c'est l'éleveur qui l'active, fournisseur par fournisseur.
ALTER TABLE suppliers ADD COLUMN notify_whatsapp BOOLEAN NOT NULL DEFAULT FALSE;
