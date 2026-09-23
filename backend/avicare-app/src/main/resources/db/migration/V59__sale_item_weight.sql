-- Poulets de chair vendus au poids (lot pesé ensemble) plutôt qu'à la tête à prix fixe (retour
-- éleveur pilote, 2026-09-23). NULL = ligne à la tête, comportement inchangé. Renseigné = le
-- prix de la ligne se calcule sur le poids, pas sur `quantity` (qui reste le nombre de têtes,
-- toujours utilisé pour décrémenter le stock du lot).
ALTER TABLE sale_items ADD COLUMN weight_kg NUMERIC(10,2) NULL;
