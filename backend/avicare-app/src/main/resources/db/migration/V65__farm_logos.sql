-- V65 — Le logo de la ferme, pour ses factures.
--
-- Stocké en base et non sur disque : la facture est fabriquée CÔTÉ CLIENT — react-pdf dans le
-- navigateur, expo-print sur le téléphone — et sept éleveurs sur dix-sept n'ont pas d'internet
-- fiable. Une image servie par un endpoint et mise en cache par le client reste disponible hors
-- ligne ; un fichier distant, non. La base est déjà sauvegardée toutes les nuits, un volume de
-- fichiers ne l'est pas.
--
-- Table à part plutôt qu'une colonne sur `farms` : sans amélioration du bytecode, Hibernate
-- charge toutes les colonnes simples d'une entité. Une colonne BYTEA sur `farms` ferait
-- descendre l'image à chaque lecture de ferme, y compris le listing du sélecteur de ferme.
--
-- `farms.logo_url` (V1) reste en place, inutilisé : une migration mergée ne se modifie pas, et la
-- colonne pourrait servir le jour où un logo viendrait d'une adresse externe.

CREATE TABLE farm_logos (
    farm_id      BIGINT PRIMARY KEY REFERENCES farms(id) ON DELETE CASCADE,
    image        BYTEA NOT NULL,
    content_type VARCHAR(50) NOT NULL CHECK (content_type IN ('image/png','image/jpeg')),
    created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TRIGGER trg_farm_logos_updated_at
    BEFORE UPDATE ON farm_logos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
