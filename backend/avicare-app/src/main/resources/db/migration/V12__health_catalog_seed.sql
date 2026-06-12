-- Health module library (Sprint B3-1). Platform catalog only — vaccines,
-- treatments and standard vaccination programs are seeded as catalog_items
-- (Décision 15 — no dedicated table; farms may override via farm_catalog_items
-- later). Read through ParametersFacade.listPlatform (Décision 16). Single-line
-- jsonb literals (V11 lesson: :: binds tighter than ||).

-- Replace the 4 placeholder vaccines seeded in V4 (minimal {label, schedule_days}
-- doc example, referenced by no code) with the real B3-1 library below.
DELETE FROM catalog_items WHERE category = 'vaccines' AND locale IS NULL;

-- --- Vaccines (10, V1) -----------------------------------------------------
INSERT INTO catalog_items (category, key, value, locale) VALUES
  ('vaccines', 'newcastle_la_sota', '{"label":"Newcastle La Sota","disease":"Newcastle","route":"OCULAR","active_strain":true,"wave":"V1"}'::jsonb, NULL),
  ('vaccines', 'newcastle_clone30', '{"label":"Newcastle Clone 30","disease":"Newcastle","route":"WATER","active_strain":true,"wave":"V1"}'::jsonb, NULL),
  ('vaccines', 'newcastle_i2',      '{"label":"Newcastle I-2","disease":"Newcastle","route":"OCULAR","active_strain":true,"wave":"V1"}'::jsonb, NULL),
  ('vaccines', 'gumboro_d78',       '{"label":"Gumboro D78","disease":"Gumboro","route":"WATER","active_strain":true,"wave":"V1"}'::jsonb, NULL),
  ('vaccines', 'gumboro_228e',      '{"label":"Gumboro 228E","disease":"Gumboro","route":"WATER","active_strain":true,"wave":"V1"}'::jsonb, NULL),
  ('vaccines', 'marek_hvt',         '{"label":"Marek HVT","disease":"Marek","route":"INJECTION","active_strain":true,"usage":"DAY_OLD","wave":"V1"}'::jsonb, NULL),
  ('vaccines', 'bronchitis_h120',   '{"label":"Bronchite H120","disease":"Bronchite infectieuse","route":"SPRAY","active_strain":true,"wave":"V1"}'::jsonb, NULL),
  ('vaccines', 'fowl_pox',          '{"label":"Variole aviaire","disease":"Variole aviaire","route":"WING_WEB","active_strain":true,"wave":"V1"}'::jsonb, NULL),
  ('vaccines', 'pasteurellosis',    '{"label":"Pasteurellose","disease":"Pasteurellose","route":"INJECTION","active_strain":false,"wave":"V1"}'::jsonb, NULL),
  ('vaccines', 'coryza',            '{"label":"Coryza infectieux","disease":"Coryza infectieux","route":"INJECTION","active_strain":false,"wave":"V1"}'::jsonb, NULL);

-- --- Treatments (6, V1) ----------------------------------------------------
INSERT INTO catalog_items (category, key, value, locale) VALUES
  ('treatments', 'amoxicillin_50',  '{"label":"Amoxicilline 50%","molecule":"Amoxicilline","class":"ANTIBIOTIC","withdrawal_days_meat":7,"withdrawal_days_eggs":7,"routes":["WATER","FEED"],"wave":"V1"}'::jsonb, NULL),
  ('treatments', 'enrofloxacin_10', '{"label":"Enrofloxacine 10%","molecule":"Enrofloxacine","class":"ANTIBIOTIC","withdrawal_days_meat":10,"withdrawal_days_eggs":14,"routes":["WATER"],"wave":"V1"}'::jsonb, NULL),
  ('treatments', 'sulfaclozine',    '{"label":"Sulfaclozine","molecule":"Sulfaclozine sodique","class":"ANTI_COCCIDIAL","withdrawal_days_meat":5,"withdrawal_days_eggs":5,"routes":["WATER"],"wave":"V1"}'::jsonb, NULL),
  ('treatments', 'levamisole',      '{"label":"Lévamisole","molecule":"Lévamisole","class":"DEWORMER","withdrawal_days_meat":8,"withdrawal_days_eggs":8,"routes":["WATER"],"wave":"V1"}'::jsonb, NULL),
  ('treatments', 'ivermectin',      '{"label":"Ivermectine","molecule":"Ivermectine","class":"DEWORMER","withdrawal_days_meat":21,"withdrawal_days_eggs":28,"routes":["INJECTION"],"wave":"V1"}'::jsonb, NULL),
  ('treatments', 'amprolium',       '{"label":"Amprolium","molecule":"Amprolium","class":"ANTI_COCCIDIAL","withdrawal_days_meat":7,"withdrawal_days_eggs":7,"routes":["WATER","FEED"],"wave":"V1"}'::jsonb, NULL);

-- --- Vaccination programs (4, V1) ------------------------------------------
INSERT INTO catalog_items (category, key, value, locale) VALUES
  ('vaccination_programs', 'broiler_standard_cobb500', '{"label":"Programme Chair Standard - Cobb 500","species":"POULTRY","breed_keys":["cobb_500"],"schedule":[{"age":{"value":1,"unit":"DAY"},"vaccine_key":"marek_hvt","route":"INJECTION","mandatory":true},{"age":{"value":7,"unit":"DAY"},"vaccine_key":"newcastle_la_sota","route":"OCULAR"},{"age":{"value":14,"unit":"DAY"},"vaccine_key":"gumboro_d78","route":"WATER"},{"age":{"value":21,"unit":"DAY"},"vaccine_key":"newcastle_clone30","route":"WATER"},{"age":{"value":28,"unit":"DAY"},"vaccine_key":"gumboro_228e","route":"WATER"}]}'::jsonb, NULL),
  ('vaccination_programs', 'broiler_standard_ross308', '{"label":"Programme Chair Standard - Ross 308","species":"POULTRY","breed_keys":["ross_308"],"schedule":[{"age":{"value":1,"unit":"DAY"},"vaccine_key":"marek_hvt","route":"INJECTION","mandatory":true},{"age":{"value":7,"unit":"DAY"},"vaccine_key":"newcastle_la_sota","route":"OCULAR"},{"age":{"value":14,"unit":"DAY"},"vaccine_key":"gumboro_d78","route":"WATER"},{"age":{"value":21,"unit":"DAY"},"vaccine_key":"newcastle_clone30","route":"WATER"},{"age":{"value":28,"unit":"DAY"},"vaccine_key":"gumboro_228e","route":"WATER"}]}'::jsonb, NULL),
  ('vaccination_programs', 'layer_standard_isabrown', '{"label":"Programme Ponte Standard - ISA Brown","species":"POULTRY","breed_keys":["isa_brown"],"schedule":[{"age":{"value":1,"unit":"DAY"},"vaccine_key":"marek_hvt","route":"INJECTION","mandatory":true},{"age":{"value":7,"unit":"DAY"},"vaccine_key":"newcastle_la_sota","route":"OCULAR"},{"age":{"value":14,"unit":"DAY"},"vaccine_key":"gumboro_d78","route":"WATER"},{"age":{"value":6,"unit":"WEEK"},"vaccine_key":"newcastle_clone30","route":"WATER"},{"age":{"value":10,"unit":"WEEK"},"vaccine_key":"fowl_pox","route":"WING_WEB"},{"age":{"value":16,"unit":"WEEK"},"vaccine_key":"bronchitis_h120","route":"SPRAY"},{"age":{"value":18,"unit":"WEEK"},"vaccine_key":"newcastle_la_sota","route":"OCULAR"}]}'::jsonb, NULL),
  ('vaccination_programs', 'layer_standard_lohmann', '{"label":"Programme Ponte Standard - Lohmann Brown","species":"POULTRY","breed_keys":["lohmann_brown"],"schedule":[{"age":{"value":1,"unit":"DAY"},"vaccine_key":"marek_hvt","route":"INJECTION","mandatory":true},{"age":{"value":7,"unit":"DAY"},"vaccine_key":"newcastle_la_sota","route":"OCULAR"},{"age":{"value":14,"unit":"DAY"},"vaccine_key":"gumboro_d78","route":"WATER"},{"age":{"value":6,"unit":"WEEK"},"vaccine_key":"newcastle_clone30","route":"WATER"},{"age":{"value":10,"unit":"WEEK"},"vaccine_key":"fowl_pox","route":"WING_WEB"},{"age":{"value":16,"unit":"WEEK"},"vaccine_key":"bronchitis_h120","route":"SPRAY"},{"age":{"value":18,"unit":"WEEK"},"vaccine_key":"newcastle_la_sota","route":"OCULAR"}]}'::jsonb, NULL);

-- --- Plan → Modules coherence (Décision 16): pro_volaille must include the
-- lower health tier (it had health.advanced but not health.basic).
UPDATE catalog_items
SET value = '{"label":"Pro Volaille","price_xof":25000,"wave":"V1","recommended":true,"modules":["module.poultry.broiler","module.poultry.layer","module.health.basic","module.health.advanced","module.commercial.basic","module.inventory"],"quotas":{"farms_max":3,"animals_max":3000}}'::jsonb
WHERE category = 'bundles' AND key = 'pro_volaille';
