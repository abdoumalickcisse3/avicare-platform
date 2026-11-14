-- Les souches saisies par les fermes via le gestionnaire générique « Lots », avant qu'il soit
-- retiré.
--
-- POURQUOI. Jusqu'à ce changement, l'écran « Lots » des réglages écrivait dans la catégorie
-- `breeds` de `farm_catalog_items` sans jamais demander le profil de production. Ces lignes
-- existent donc sans famille déclarée : pas de cible de poids, pas d'âge cible, pas de courbe de
-- référence. L'écran « Souches » les remplace et demande le profil ; les lignes déjà saisies, elles,
-- restent muettes.
--
-- CE QUE CE SCRIPT FAIT, ET NE FAIT PAS. Il LIT. Il ne corrige rien et ne devine aucun profil :
-- la famille d'une souche n'est pas de notre ressort (spec §7.3), et l'inventer reviendrait à
-- rendre un verdict de croissance tiré au sort. La sortie sert à PRÉVENIR les fermes concernées,
-- pour qu'elles redéclarent leur souche depuis le nouvel écran.
--
-- AVANT OU APRÈS V69. Le script se lit sur les deux schémas : `to_jsonb(b) ->> 'profile'` vaut
-- NULL tant que la colonne n'existe pas, et la vraie valeur ensuite. Référencer `b.profile`
-- directement empêcherait la requête de seulement compiler avant la migration — or c'est
-- justement là qu'elle doit tourner.
--
-- QUAND. À jouer sur la production AVANT la fusion, en lecture seule :
--
--   ssh deploy@<VPS>
--   docker exec -i <conteneur_postgres> psql -U <user> -d <db> < audit-farm-breed-catalog-entries.sql
--
-- (`docker exec`, pas `docker compose exec` : l'interpolation meurt sur JWT_PRIVATE_KEY. Et le SQL
-- par stdin, jamais par -c.)

\echo ''
\echo '=== 1. Les lignes, ferme par ferme ==='
\echo ''

SELECT
    f.id                                        AS ferme_id,
    f.name                                      AS ferme,
    fci.key                                     AS cle,
    fci.value ->> 'label'                       AS libelle,
    fci.value ->> 'type'                        AS type_declare,   -- broiler / layer, jamais le profil
    fci.is_disabled                             AS desactivee,
    fci.created_at::date                        AS saisie_le,
    -- La souche a-t-elle déjà été redéclarée proprement dans `breeds` ? Si oui, la ligne de
    -- catalogue est un résidu sans conséquence, et la ferme n'a pas besoin d'être prévenue.
    EXISTS (
        SELECT 1 FROM breeds b
        WHERE b.farm_id = fci.farm_id
          AND b.code = fci.key
          AND to_jsonb(b) ->> 'profile' IS NOT NULL
    )                                           AS deja_redeclaree
FROM farm_catalog_items fci
JOIN farms f ON f.id = fci.farm_id
WHERE fci.category = 'breeds'
ORDER BY f.name, fci.key;

\echo ''
\echo '=== 2. Qui prévenir, et combien de souches chacun ==='
\echo ''

-- Le numéro vit sur `users`, pas sur `farms` : on passe par le propriétaire de la ferme.
-- string_agg plutôt qu'une jointure simple — une ferme peut avoir plusieurs OWNER, et en lister
-- un seul au hasard reviendrait à prévenir la mauvaise personne.
SELECT
    f.id              AS ferme_id,
    f.name            AS ferme,
    string_agg(DISTINCT u.phone, ', ') AS telephones_proprietaires,
    COUNT(DISTINCT fci.key)            AS souches_a_redeclarer
FROM farm_catalog_items fci
JOIN farms f ON f.id = fci.farm_id
LEFT JOIN user_farms uf ON uf.farm_id = f.id AND uf.role = 'OWNER'
LEFT JOIN users u ON u.id = uf.user_id
WHERE fci.category = 'breeds'
  AND NOT EXISTS (
        SELECT 1 FROM breeds b
        WHERE b.farm_id = fci.farm_id
          AND b.code = fci.key
          AND to_jsonb(b) ->> 'profile' IS NOT NULL
  )
GROUP BY f.id, f.name
ORDER BY souches_a_redeclarer DESC, f.name;

\echo ''
\echo '=== 3. Ces souches sont-elles utilisées par un lot en cours ? ==='
\echo ''
\echo '    Une souche qui ne porte aucun lot peut être redéclarée sans urgence.'
\echo '    Une souche qui porte un lot VIVANT prive cet éleveur de sa courbe dès maintenant.'
\echo ''

SELECT
    f.name                                      AS ferme,
    fci.value ->> 'label'                       AS souche,
    COUNT(pu.id) FILTER (WHERE pu.status = 'ACTIVE') AS lots_en_cours,
    COUNT(pu.id)                                AS lots_au_total
FROM farm_catalog_items fci
JOIN farms f ON f.id = fci.farm_id
LEFT JOIN breeds b
       ON b.farm_id = fci.farm_id AND b.code = fci.key
LEFT JOIN production_units pu
       ON pu.breed_id = b.id
WHERE fci.category = 'breeds'
GROUP BY f.name, fci.value ->> 'label'
ORDER BY lots_en_cours DESC, f.name;
