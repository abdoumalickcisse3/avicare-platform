-- V53 — Lien entre la traçabilité applicative (V48) et le traçage distribué.
-- L'identifiant de trace OpenTelemetry permet à /console/traces d'ouvrir la
-- décomposition en spans correspondante dans Jaeger : la table dit ce qui est
-- arrivé à un éleveur, Jaeger dit où le temps est passé.
--
-- Nullable par construction : une requête enregistrée alors que l'agent est
-- désactivé (OTEL_SDK_DISABLED=true, ou TRACING_JAVA_OPTS vidé) n'a pas
-- d'identifiant. La colonne vide est un état normal, pas une anomalie.
--
-- Index partiel : on ne cherche jamais les lignes dépourvues d'identifiant.

ALTER TABLE request_traces ADD COLUMN otel_trace_id VARCHAR(32);

CREATE INDEX idx_request_traces_otel ON request_traces(otel_trace_id)
    WHERE otel_trace_id IS NOT NULL;
