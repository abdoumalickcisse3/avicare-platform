-- Le pays de la ferme, et la donnée de référence qui va avec.
--
-- Jusqu'ici une ferme n'avait pas de pays : son fuseau valait 'Africa/Dakar' et son identifiant
-- fiscal s'appelait NINEA sur la facture, ce qui est sénégalais. La demande entrante ne l'est plus
-- (un éleveur de pondeuses ivoirien, le 2026-10-24), et une ferme ivoirienne héritait donc de
-- valeurs qui ne la concernent pas.
--
-- Pourquoi VARCHAR(2) + CHECK de forme, et non un CHECK énumérant les pays : la liste des pays est
-- de la donnée de référence, pas un enum métier. Un pays de plus doit être une ligne de catalogue
-- modifiable par le super-admin, jamais une migration et un déploiement.
--
-- Le défaut 'SN' rend correctes les fermes existantes sans reprise de données : elles sont toutes
-- sénégalaises.

ALTER TABLE farms
    ADD COLUMN country VARCHAR(2) NOT NULL DEFAULT 'SN';

ALTER TABLE farms
    ADD CONSTRAINT chk_farms_country_shape CHECK (country ~ '^[A-Z]{2}$');

-- Les huit pays de la zone XOF. Le périmètre s'arrête là volontairement : un pays hors XOF pose
-- d'abord une question de devise, qui se tranche séparément.
--
-- Le fuseau n'est pas uniforme malgré la monnaie commune : le Bénin et le Niger sont à UTC+1, les
-- six autres à UTC+0. Le supposer aurait décalé d'une heure toutes les saisies de deux pays.
--
-- `tax_id_label` nomme le champ que la ferme imprime sur ses factures. La colonne qui le porte
-- s'appelle toujours `ninea` et ne sera pas renommée : trois écrans et deux générateurs de PDF la
-- lisent, et la migration serait irréversible pour un gain de clarté interne.
INSERT INTO catalog_items (category, key, value, locale) VALUES
  ('countries', 'SN', '{"name":"Sénégal","timezone":"Africa/Dakar","tax_id_label":"NINEA"}'::jsonb, NULL),
  ('countries', 'CI', '{"name":"Côte d''Ivoire","timezone":"Africa/Abidjan","tax_id_label":"N° contribuable"}'::jsonb, NULL),
  ('countries', 'BJ', '{"name":"Bénin","timezone":"Africa/Porto-Novo","tax_id_label":"N° contribuable"}'::jsonb, NULL),
  ('countries', 'BF', '{"name":"Burkina Faso","timezone":"Africa/Ouagadougou","tax_id_label":"N° contribuable"}'::jsonb, NULL),
  ('countries', 'ML', '{"name":"Mali","timezone":"Africa/Bamako","tax_id_label":"N° contribuable"}'::jsonb, NULL),
  ('countries', 'TG', '{"name":"Togo","timezone":"Africa/Lome","tax_id_label":"N° contribuable"}'::jsonb, NULL),
  ('countries', 'NE', '{"name":"Niger","timezone":"Africa/Niamey","tax_id_label":"N° contribuable"}'::jsonb, NULL),
  ('countries', 'GW', '{"name":"Guinée-Bissau","timezone":"Africa/Bissau","tax_id_label":"N° contribuable"}'::jsonb, NULL);
