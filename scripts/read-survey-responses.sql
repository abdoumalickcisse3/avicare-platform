-- Lire les réponses au questionnaire terrain (docs/13-enquete-200-eleveurs.md).
--
-- L'écran /console/enquete fait cette lecture dans l'application, et c'est par là qu'il
-- faut passer d'habitude. Ce fichier reste pour ce qu'un navigateur ne sait pas faire :
-- inspecter la base sans console, pendant un incident, ou vérifier que l'écran dit bien
-- ce que la table contient.
--
-- Depuis ce poste :
--   ssh -o BatchMode=yes deploy@169.58.109.93 \
--     'docker exec -i avicare-prod-postgres-1 psql -U avicare -d avicare' \
--     < scripts/read-survey-responses.sql
--
-- La table est en ajout seul : ne jamais y écrire, ni corriger une réponse.

\pset pager off

\echo '=== 1. Combien, d où, et par qui ==='
SELECT country,
       count(*)                                       AS reponses,
       count(DISTINCT region)                         AS regions,
       count(*) FILTER (WHERE phone IS NOT NULL)      AS avec_telephone,
       count(*) FILTER (WHERE accepts_interview)      AS acceptent_entretien,
       max(created_at)::date                          AS derniere
FROM survey_responses
GROUP BY country
ORDER BY reponses DESC;

\echo '=== 2. Qui relaie le lien (le champ « qui vous a envoyé ce lien ») ==='
SELECT coalesce(nullif(trim(referrer), ''), '(non renseigné)') AS relais,
       count(*) AS reponses
FROM survey_responses
GROUP BY 1
ORDER BY 2 DESC;

\echo '=== 3. Chaque réponse, la plus récente en premier ==='
SELECT id,
       created_at::date       AS le,
       country || ' / ' || region AS ou,
       flock_type             AS type,
       current_birds          AS sujets,
       birds_placed           AS mis_en_place,
       birds_died             AS morts,
       chick_price            AS prix_poussin,
       last_bag_price         AS prix_sac,
       last_bag_brand         AS marque_sac,
       feed_supplier          AS provendier,
       payment_terms          AS paiement,
       main_buyer             AS acheteur,
       last_sale_price        AS prix_vente,
       last_sale_unit         AS unite,
       record_keeping         AS tenue_de_compte,
       willingness_to_pay     AS pret_a_payer,
       first_call             AS appelle_qui,
       referrer               AS envoye_par,
       phone                  AS telephone
FROM survey_responses
ORDER BY created_at DESC
LIMIT 50;

\echo '=== 4. Ce qu ils disent en clair (matieres premieres, abandon d un outil) ==='
SELECT id, country, nullif(trim(raw_material_prices), '') AS prix_matieres,
       has_quit AS a_abandonne_un_outil, nullif(trim(quit_reason), '') AS pourquoi
FROM survey_responses
WHERE nullif(trim(raw_material_prices), '') IS NOT NULL
   OR nullif(trim(quit_reason), '') IS NOT NULL
ORDER BY created_at DESC;

\echo '=== 5. A rappeler : ils ont laisse un numero et acceptent un entretien ==='
SELECT created_at::date AS le, country || ' / ' || region AS ou, phone, referrer
FROM survey_responses
WHERE accepts_interview IS TRUE AND phone IS NOT NULL
ORDER BY created_at DESC;

\echo '=== 6. Distance au plancher de publication (5 reponses par chiffre et par region) ==='
SELECT country, region, count(*) AS reponses,
       greatest(0, 5 - count(*)) AS manquantes_avant_publication
FROM survey_responses
GROUP BY country, region
ORDER BY reponses DESC;
