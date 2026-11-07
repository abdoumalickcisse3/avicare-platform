-- Le profil de production d'une souche, et deux souches hors catalogue qui n'en avaient pas.
--
-- Jusqu'ici une souche n'avait ni cible par défaut ni famille déclarée : un éleveur qui saisit
-- Goliath, Kuroiler ou une "locale améliorée" (demande entrante, zone XOF, spec locale-ameliorees)
-- n'avait aucune base pour un poids cible, un âge cible, ni même pour savoir si une courbe de
-- croissance de référence existe pour sa souche. `profile` porte cette famille ; le catalogue
-- `breed_profiles` porte les cibles qui en découlent, par famille et non par souche — une souche
-- hors catalogue emprunte le profil d'une famille connue plutôt que d'inventer sa propre fiche.
--
-- CHECK de forme plutôt qu'un FK vers le catalogue `breed_profiles` : les quatre valeurs sont un
-- vocabulaire fermé côté code (l'enum Java les porte aussi), pas une liste ouverte au super-admin.

ALTER TABLE breeds
    ADD COLUMN profile VARCHAR(30);

ALTER TABLE breeds
    ADD CONSTRAINT chk_breeds_profile
        CHECK (profile IS NULL OR profile IN ('BROILER_FAST', 'BROILER_RUSTIC', 'LAYER_INDUSTRIAL', 'LAYER_RUSTIC'));

-- Reprise des cinq souches déjà semées (V5, depuis le catalogue 'breeds' de V4) : elles ont un
-- type connu (broiler/layer) et une réputation qui ne fait pas débat, donc un profil sans
-- ambiguïté. Pas de valeur pour les souches custom existantes (farm_id non nul) : leur famille
-- n'est pas de notre ressort, et NULL reste une réponse honnête ("non renseigné").
UPDATE breeds SET profile = 'BROILER_FAST'
    WHERE farm_id IS NULL AND code IN ('cobb_500', 'ross_308');

UPDATE breeds SET profile = 'LAYER_INDUSTRIAL'
    WHERE farm_id IS NULL AND code IN ('isa_brown', 'lohmann_brown', 'hyline_w36');

-- Remplacer l'unicité. `UNIQUE (species, code, farm_id)` de V5 ne protège rien au niveau
-- plateforme : farm_id y est NULL pour toutes les souches plateforme, et sous Postgres
-- NULL <> NULL dans un UNIQUE — la contrainte ne bloquait donc jamais deux lignes plateforme de
-- même code. Elle interdisait en revanche ce qu'on veut désormais permettre : le même code
-- ("locale_amelioree") décliné sous deux profils (BROILER_RUSTIC et LAYER_RUSTIC). On la remplace
-- par un index unique sur expression qui comble le trou NULL (COALESCE) et inclut le profil dans
-- la clé d'identité.
ALTER TABLE breeds
    DROP CONSTRAINT IF EXISTS breeds_species_code_farm_id_key;

CREATE UNIQUE INDEX uq_breeds_identity
    ON breeds (species, code, COALESCE(profile, ''), COALESCE(farm_id, 0));

-- Catalogue `breed_profiles` : les cibles par défaut par famille, pas par souche. Les deux
-- profils de ponte n'ont volontairement aucune cible (spec §7.1) : la ponte se pilote par taux de
-- ponte et non par poids/âge cible, un sujet hors-périmètre de cette tâche. Les cibles rustiques
-- partent des chiffres Kuroiler convergents de la spec §3 (2 kg en 3 mois en intensif, 4-5 mois en
-- semi-extensif) ; leur validation terrain par un éleveur reste à faire côté produit.
INSERT INTO catalog_items (category, key, value, locale) VALUES
  ('breed_profiles', 'broiler_fast',
   '{"label":"Chair à croissance rapide","type":"broiler","default_target_weight_g":2100,"default_target_age_days":42}'::jsonb, NULL),
  ('breed_profiles', 'broiler_rustic',
   '{"label":"Chair rustique (croissance lente)","type":"broiler","default_target_weight_g":2000,"default_target_age_days":90}'::jsonb, NULL),
  ('breed_profiles', 'layer_industrial',
   '{"label":"Ponte industrielle","type":"layer"}'::jsonb, NULL),
  ('breed_profiles', 'layer_rustic',
   '{"label":"Ponte rustique (locale améliorée)","type":"layer"}'::jsonb, NULL);

-- Seed plateforme des souches rustiques/locales demandées par la spec. catalog_item_id reste NULL :
-- ces souches ne viennent pas du catalogue `breeds` (contrairement aux cinq souches V5) mais sont
-- déclarées directement ici, en BROILER_RUSTIC. `locale_amelioree` existe en plus en LAYER_RUSTIC,
-- sous le même code : un éleveur qui l'élève pour la ponte doit pouvoir la choisir aussi, et
-- l'index uq_breeds_identity ci-dessus l'autorise désormais (le profil fait partie de la clé).
INSERT INTO breeds (species, code, name, type, profile, catalog_item_id, farm_id) VALUES
  ('POULTRY', 'goliath',          'Goliath',                     'broiler', 'BROILER_RUSTIC', NULL, NULL),
  ('POULTRY', 'kuroiler',         'Kuroiler',                    'broiler', 'BROILER_RUSTIC', NULL, NULL),
  ('POULTRY', 'sasso',            'Sasso',                       'broiler', 'BROILER_RUSTIC', NULL, NULL),
  ('POULTRY', 'poulet_local',     'Poulet local',                'broiler', 'BROILER_RUSTIC', NULL, NULL),
  ('POULTRY', 'locale_amelioree', 'Locale améliorée (chair)',    'broiler', 'BROILER_RUSTIC', NULL, NULL),
  ('POULTRY', 'locale_amelioree', 'Locale améliorée (ponte)',    'layer',   'LAYER_RUSTIC',    NULL, NULL);
