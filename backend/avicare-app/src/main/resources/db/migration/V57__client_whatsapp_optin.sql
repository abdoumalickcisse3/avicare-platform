-- Consentement WhatsApp du client, à l'image de celui du fournisseur (V55).
--
-- Le fournisseur est prévenu d'un paiement et d'un bon de commande ; le client, lui, n'était
-- prévenu de rien — ni de sa facture, ni de son paiement reçu. Or c'est le client qui a une action
-- à faire : payer.
--
-- Défaut à FALSE, délibérément. Écrire au client d'un éleveur engage l'image de l'éleveur auprès
-- de SES clients : cela s'accorde, cela ne se suppose pas. Et le second garde-fou reste par
-- message (`notifyClient` sur chaque envoi), comme pour le compte-courant fournisseur.

ALTER TABLE clients
    ADD COLUMN notify_whatsapp BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN clients.notify_whatsapp IS
    'Le client accepte de recevoir des avis WhatsApp (facture, paiement). Interrupteur permanent ; chaque envoi porte en plus son propre garde-fou.';
