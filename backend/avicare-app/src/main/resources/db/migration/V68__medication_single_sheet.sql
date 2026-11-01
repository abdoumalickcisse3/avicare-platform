-- ADR-020 — un médicament = un produit, deux faces, un seul solde.
--
-- Avant cette migration, la bibliothèque sanitaire (`treatments`) et le catalogue d'articles
-- (`inventory_items`) étaient deux référentiels sans passerelle : un médicament déclaré côté Stock
-- n'apparaissait jamais dans le formulaire de traitement, et inversement. Les fermes ont donc
-- déclaré le même flacon deux fois, sous deux orthographes, avec deux soldes.
--
-- Cette migration ne touche QUE du paramétrage et l'étiquette de source d'une ligne de stock.
-- Aucune quantité n'est modifiée, aucun mouvement n'est inventé : le journal de stock reste en
-- ajout seul (cf. V66).

-- 1) Chaque traitement propre à une ferme reçoit sa face « article de stock », si elle manque.
--    Les molécules de la plateforme sont volontairement exclues : ce sont des références
--    médicales, pas des articles que chaque ferme prétend stocker — les matérialiser imposerait
--    une ligne de stock vide par molécule et par ferme.
INSERT INTO farm_catalog_items (farm_id, catalog_item_id, category, key, value)
SELECT t.farm_id,
       NULL,
       'inventory_items',
       t.key,
       jsonb_build_object(
         'label', COALESCE(t.value->>'label', t.key),
         'subcategory', 'MEDICATION'
       )
FROM farm_catalog_items t
WHERE t.category = 'treatments'
  -- Un traitement que l'éleveur a masqué ne doit pas réapparaître sous forme d'article.
  AND t.is_disabled = false
  AND NOT EXISTS (
    SELECT 1 FROM farm_catalog_items i
    WHERE i.farm_id = t.farm_id
      AND i.category = 'inventory_items'
      AND i.key = t.key
  );

-- 2) Une ligne de stock de source TREATMENT devient une ligne INVENTORY : même id, mêmes
--    mouvements, même solde — on ne change que le catalogue qui la définit. C'est ce qui garantit
--    « un seul solde » sans transférer de quantité.
UPDATE stock_items s
SET article_source = 'INVENTORY'
WHERE s.article_source = 'TREATMENT'
  AND NOT EXISTS (
    SELECT 1 FROM stock_items i
    WHERE i.farm_id = s.farm_id
      AND i.article_key = s.article_key
      AND i.article_source = 'INVENTORY'
  );

-- 3) Collision : les deux faces portent déjà une ligne de stock pour la même clé. La ligne
--    INVENTORY fait foi. On ne désactive la ligne TREATMENT que si elle est à zéro — sinon on la
--    laisse telle quelle, visible, car fusionner deux soldes réels est une décision métier qui
--    appartient à l'éleveur, pas à une migration.
UPDATE stock_items s
SET active = false,
    notes = COALESCE(s.notes || E'\n', '')
            || 'Doublon de source neutralisé par V68 (ADR-020) : le solde fait foi sur la ligne INVENTORY de même article.'
WHERE s.article_source = 'TREATMENT'
  AND s.active = true
  AND s.current_quantity = 0
  AND EXISTS (
    SELECT 1 FROM stock_items i
    WHERE i.farm_id = s.farm_id
      AND i.article_key = s.article_key
      AND i.article_source = 'INVENTORY'
  );
