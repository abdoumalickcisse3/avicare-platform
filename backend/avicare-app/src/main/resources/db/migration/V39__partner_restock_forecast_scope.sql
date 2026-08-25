-- V39 — Couche « Développer » : 6ᵉ curseur de partage, la prévision de recommande.
--
-- DEFAULT FALSE délibéré : les cinq curseurs de V36 autorisent un partenaire à *constater* un
-- état ; celui-ci lui livre une prédiction commercialement actionnable sur une ferme nommée
-- (« cette ferme aura besoin de 800 kg dans 12 jours »). Les adhésions existantes ne consentent
-- donc PAS rétroactivement — l'éleveur doit vouloir être démarché.
-- Cf. spec 2026-08-25 couche « Développer » §3.

ALTER TABLE partner_farm_memberships
    ADD COLUMN share_restock_forecast BOOLEAN NOT NULL DEFAULT FALSE;
