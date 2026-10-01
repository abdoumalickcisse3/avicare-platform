# ADR 016 — Production sur un seul serveur (VPS, Docker Compose)

**Date** : 2026-10-01 (décision en vigueur depuis la mise en ligne, formalisée ici)
**Statut** : Accepté
**Auteur** : Abdou Malick Cisse

## Contexte

Jawdi est en production sur `jawdi.app`, en pilote gratuit (ADR-009), avec une personne pour
l'exploiter (ADR-001 : construction en solo). Les doutes d'architecture de départ (Kubernetes,
services managés, plusieurs nœuds) coûtent de l'argent et de l'attention avant qu'il y ait un
client payant.

## Décision

Toute la plateforme tourne sur **un seul VPS** (Contabo), décrit par `infra/docker-compose.prod.yml` :
Caddy (HTTPS automatique) → web (Next.js) + backend (Spring Boot) + landing (nginx) ; PostgreSQL,
Redis et Jaeger sur la même machine. Les images sont construites par GitHub Actions, poussées sur
GHCR, puis tirées sur le serveur par `infra/deploy.sh <sha>`. Procédure : `infra/DEPLOY.md`.

## Conséquences

- **Pas de haute disponibilité.** Un redémarrage coupe le service quelques dizaines de secondes
  (Caddy retient les requêtes pendant ce temps au lieu de répondre 502) ; une panne du serveur
  coupe tout. Acceptable pour un pilote, à revoir avant des clients payants.
- **Perte de données possible : jusqu'à 24 h.** La sauvegarde est un `pg_dump` quotidien (local,
  14 jours, plus une copie hors site si `BACKUP_REMOTE` est défini). Il n'y a ni réplication ni
  archivage continu. La restauration est documentée (`docs/runbooks/ops/restaurer-une-sauvegarde.md`)
  mais n'a pas encore été rejouée sur le VPS.
- **La surveillance ne peut pas vivre sur la machine surveillée** : les sondes d'uptime tournent
  sur les runners GitHub (`.github/workflows/uptime.yml`).
- **Le rollback restaure le code, pas le schéma** : Flyway n'est pas réversible.
- Chemin d'évolution prévu, sans réécriture : PostgreSQL managé (retirer le service `postgres`),
  un second nœud derrière un répartiteur, ou un VPS plus gros (`BACKEND_MEM`). Il se déclenche sur
  le premier client payant ou le premier incident qui coûte une journée.
