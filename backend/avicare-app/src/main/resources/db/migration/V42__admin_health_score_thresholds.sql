-- V42 — Console super-admin, Phase 1 : seuils du health-score des fermes.
--
-- En catalogue plutôt qu'en dur, comme toute valeur métier de la plateforme : ces seuils
-- se règleront avec l'expérience terrain, et un ajustement ne doit pas demander un
-- redéploiement. Lus via ParametersFacade.listPlatform("admin").

INSERT INTO catalog_items (category, key, value, locale) VALUES
  ('admin', 'health_score_thresholds',
   '{"label":"Seuils de décrochage des fermes","watch_days":7,"at_risk_days":21}'::jsonb, NULL);
