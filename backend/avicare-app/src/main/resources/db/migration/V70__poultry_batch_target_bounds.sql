-- Bornes sur les cibles de croissance d'un lot de chair.
--
-- target_age_days n'était contraint ni par une validation ni par un CHECK (V6). Tant qu'aucun code
-- ne le lisait au-delà d'un calcul en O(1), une valeur absurde restait inerte. Ce n'est plus vrai
-- depuis GrowthReferenceService.expectedCurve (tâche 5, courbe de référence servie par le serveur) :
-- la courbe échantillonne tous les 7 jours de 0 à target_age_days, donc une valeur du type
-- 2 000 000 000 transforme une ligne dormante en boucle infinie (int qui dépasse Integer.MAX_VALUE
-- et repart négatif) sur un lot lu à chaque affichage de la liste des lots — un déni de service
-- sur une API multi-tenant. La requête HTTP et le service portent déjà la même borne
-- (CreatePoultryBatchRequest.@Max, GrowthReferenceService.MAX_TARGET_AGE_DAYS = 3650) ; cette
-- contrainte protège les lignes déjà en base et tout futur chemin d'écriture qui oublierait de
-- valider (LivestockFacadeImpl.createPoultryBatch n'est pas le seul site de construction d'un
-- PoultryBatchCreate et ne passe pas par le DTO HTTP validé).
--
-- 3650 jours = 10 ans : aucune volaille de chair ne vit un cycle aussi long, la borne n'existe que
-- pour couper la queue absurde, pas pour contraindre un usage réel.
--
-- target_weight_g reçoit la même discipline : pas de valeur métier justifiant une borne partagée
-- avec un autre composant (contrairement à target_age_days, qui est lu par une boucle), mais rien
-- n'empêchait avant cette migration un poids cible négatif ou aberrant (ex. 999 999 999 g) d'entrer
-- en base par le même chemin d'écriture non validé. 50 000 g (50 kg) est large pour un poulet de
-- chair ou une pondeuse et reste cohérent avec le @Max(50_000) ajouté côté requête HTTP.

ALTER TABLE poultry_batches
    ADD CONSTRAINT chk_poultry_batches_target_age_days
        CHECK (target_age_days IS NULL OR (target_age_days > 0 AND target_age_days <= 3650));

ALTER TABLE poultry_batches
    ADD CONSTRAINT chk_poultry_batches_target_weight_g
        CHECK (target_weight_g IS NULL OR (target_weight_g > 0 AND target_weight_g <= 50000));
