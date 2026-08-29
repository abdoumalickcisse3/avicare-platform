-- Console Phase 5 (I) — aggregated benchmarks.
--
-- In the catalog rather than in constants, like every platform business value (see V42): the
-- cohort minimum will be tuned with experience, and tuning it must not need a redeploy.
--
-- min_cohort is the privacy guard, not a display preference. Below it, an "average" computed from
-- two or three farms lets any of them work out the others' figures — so nothing is published at
-- all. Off by default: a farm's mortality is its own business until the platform decides
-- otherwise, deliberately.

INSERT INTO catalog_items (category, key, value, locale) VALUES
  ('admin', 'benchmarks',
   '{"label":"Comparaison anonyme entre fermes","enabled":false,"min_cohort":5}'::jsonb, NULL);
