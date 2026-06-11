# ADR 005 — Mapping Plan → Modules : source de vérité backend

**Date** : 2026-06-11
**Statut** : Accepté
**Auteur** : Abdou Malick Cisse

## Contexte

La page de tarification expose 4 formules (Starter / Pro / Ferme Complète / Sur
mesure). Jusqu'ici le mapping **Plan → Modules** était **hardcodé côté frontend**
dans `web/src/constants/bundles.ts` : c'est le wizard de signup qui activait les
modules un par un (`POST /subscription/modules` en boucle) à partir de cette
constante.

Problèmes :

1. **Désynchronisation** possible front/back — le backend ne connaissait pas
   quel plan implique quels modules.
2. **Logique métier dans le client** — l'orchestration d'activation vivait dans
   le navigateur, non rejouable côté serveur.

Or le mapping existait **déjà** côté backend : la **Décision 15** modélise les
bundles comme des `catalog_items` de catégorie `bundles` (pas de table dédiée),
seedés en `V4` avec `value {label, price_xof, wave, modules[], quotas}`. Il
manquait seulement de **l'exposer** et de **l'utiliser**.

## Décision

Le **backend est la source de vérité unique** du mapping Plan → Modules
(**Décision 16**). On s'appuie sur le catalogue `bundles` existant — **pas de
nouvelle table** (cohérent Décision 15).

### Politique produit (tranchée avec Mr)

- **V1 : plans = pré-bundles uniquement** — pas d'ajout de modules à la carte.
- **Limites « soft »** : les quotas affichés (« ≤ 100 animaux », « ≤ 3 fermes »)
  sont **indicatifs marketing, NON enforced** backend (Option 3).

### Implémentation (Voie α — catalogue, pas de table dédiée)

- **`GET /api/v1/subscription/plans`** (public, allow-listé dans `SecurityConfig`)
  → plans V1 avec leurs `modules[]` (les plans d'une vague ultérieure, ex.
  `tabaski_edition` V2, sont filtrés).
- **`POST /api/v1/farms/{farmId}/subscription/plan`** (`OWNER`) : le serveur
  résout les modules du plan depuis le catalogue, **réconcilie** l'abonnement de
  la ferme à exactement cet ensemble (active les manquants, désactive les
  surnuméraires — en V1 tout module provient d'un plan) et fixe `plan_key`.
  Idempotent (même plan → no-op) ; plan custom (sur mesure) → `422
  PLAN_REQUIRES_QUOTE` ; plan inconnu / hors V1 → `404`. Le statut d'abonnement
  reste inchangé (pas de facturation en V1).
- **`ParametersFacade.listPlatform(category)`** ajouté : le contexte
  `subscription` lit le catalogue via la façade publique (pas d'accès direct au
  repository d'un autre bounded context).
- **`V11`** (seed-only) : aligne `ferme_complete` sur les 12 modules V1, ajoute
  les flags d'affichage (`recommended`) et le plan `sur_mesure`.

### Volet frontend (PR #2)

- Slice `subscriptionApi` : `getPlans` + `applyPlan`.
- Le wizard de signup et l'onglet abonnement consomment l'API ; le signup
  appelle `applyPlan(planKey)` au lieu de boucler `enableModule`.
- `constants/bundles.ts` réduit aux libellés UI ; `DEV_BYPASS_BUNDLE_KEY =
  "ferme_complete"`.

## Conséquences

### Positives

- Une seule source de vérité (catalogue backend) → plus de dérive front/back.
- Orchestration d'activation côté serveur, rejouable et testable.
- Aucune nouvelle table ni repository (respecte Décision 15) → mocks de sécurité
  DB-less inchangés.
- `plan_key` est désormais réellement renseigné sur l'abonnement.

### Négatives

- `sur_mesure` doit être traité spécialement (pas d'activation instantanée).
- Les libellés UI des modules restent côté front (le catalogue ne les porte pas
  tous) — duplication mineure assumée.

## Tests

- `SubscriptionPlanIT` (Testcontainers, V1–V11) : catalogue public et V1-only,
  apply + réconciliation au changement de plan, plan custom → 422, inconnu → 404.
- Slice `subscriptionApi` (front) : URLs `getPlans` / `applyPlan`.
- Wizard signup & `FarmSubscriptionTab` migrés vers l'API plans.

## Alternatives écartées

- **Tables dédiées `subscription_plans` + `subscription_plan_modules`** :
  renverserait la Décision 15 (qui a explicitement choisi de modéliser les
  bundles comme `catalog_items`) et dupliquerait un modèle déjà existant.
- **Garder bundles.ts comme source** : maintient la désynchronisation, c'est le
  problème qu'on corrige.

## Référence

- Décisions 15 et 16 — `docs/00-vision-strategique.md` §11
- `SubscriptionService.listPlans/applyPlan`, `SubscriptionPlanController`,
  `ParametersFacade.listPlatform` ; migration `V11`
- doc 06 §3 (paramétrage 3 couches)
