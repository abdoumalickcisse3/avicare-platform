# ADR 006 — `production_focus` par ferme (métier vs commercial)

**Date** : 2026-06-11
**Statut** : Accepté
**Auteur** : Abdou Malick Cisse

## Contexte

La sidebar filtre les items « Élevage » selon les **modules d'abonnement actifs**
du compte (PR #52). Mais l'abonnement est **commercial** (« le compte a payé pour
le module ponte »), pas **métier** (« cette ferme-ci fait de la ponte »).

Conséquence : un compte « Pro Volaille » (chair + ponte activés) qui gère
plusieurs fermes voit **les deux** items partout — même sur une ferme qui ne fait
**que** de la chair. L'item « Œufs » pollue l'UI d'une ferme chair-only.

L'utilisateur raisonne en **termes métier** (« je fais de la chair »), pas en
termes d'entitlements (« module.poultry.broiler activé »).

## Décision

Introduire un **focus de production par ferme** (Décision 17), **distinct** des
modules d'abonnement.

- **Pas de `farm.type` enum** : reste cohérent avec la Décision 5 (pivot
  `ProductionUnit`, pas de type de ferme figé). Une ferme peut être mixte.
- Stocké via **`farm_settings`** (paramétrage 3 couches, doc 06 §3) :
  - `key = production_focus`
  - `value = {"value": [...]}` — JSONB (objet, jamais tableau top-level), le
    tableau étant `["broiler"]` | `["layer"]` | `["broiler","layer"]`.
- **Aucune migration** : `farm_settings` existe depuis A4.

### Sémantique

- Le focus est **sélectionné à la création** de la ferme (multi-select **filtré
  par les modules abonnés actifs** du compte) et **modifiable** ensuite (dialogue
  d'édition de ferme).
- Tokens validés ⊆ `{broiler, layer}` (V1) → `422 INVALID_PRODUCTION_FOCUS`.
- **Focus vide = « pas de filtre »** (rétro-compatible : les fermes existantes
  sans focus continuent d'afficher tous les modules actifs).
- **Filtrage sidebar = (modules abonnés actifs) ∩ (focus de la ferme courante).**
  Le switch de ferme reconfigure la sidebar.

### Endpoints / surface

- `POST /api/v1/farms` et `PUT /api/v1/farms/{id}` acceptent `productionFocus[]` ;
  `GET` le renvoie sur `FarmResponse`. Écrit/lu via `FarmSettingService` à travers
  `ParametersFacade` (pas d'accès cross-context au repository).
- Frontend : `CreateFarmDialog` (sélecteur « Type d'élevage »),
  `useCurrentFarmFocus()`, combiné à `useActiveModules()` dans la sidebar.

## Conséquences

### Positives

- L'UI d'une ferme reflète ce qu'elle **fait**, pas seulement ce que le compte a
  **acheté**.
- Multi-fermes propre : chair-only / ponte-only / mixte par ferme, sous un même
  abonnement.
- Zéro migration, zéro nouvelle table (réutilise `farm_settings`).

### Négatives

- Deux niveaux de filtrage (commercial ∩ métier) à comprendre.
- Lecture du focus par ferme dans la liste (`GET /farms`) = un lookup par ferme
  (N+1) — acceptable à l'échelle V1 (peu de fermes par compte).

## Tests

- `FarmProductionFocusIT` (Testcontainers) : focus à la création + read-back +
  update, token invalide → 422, défaut vide.
- Frontend : filtrage sidebar par focus (2 modules actifs + focus broiler → item
  « Œufs » masqué).

## Alternatives écartées

- **`farm.type` enum** (chair/ponte/mixte) : fige le modèle, contredit la
  Décision 5, et ne gère pas l'évolution d'une ferme.
- **Dériver le focus des `ProductionUnit` existantes** : une ferme neuve n'a pas
  encore d'unité ; le focus est un choix amont, pas une conséquence.

## Référence

- Décision 17 — `docs/00-vision-strategique.md` §11
- `FarmService` (`production_focus`), `ParametersFacade.setFarmSetting` ;
  `useCurrentFarmFocus`, `Sidebar`
- doc 06 §3 (paramétrage 3 couches) ; ADR-005 (filtrage commercial par modules)
