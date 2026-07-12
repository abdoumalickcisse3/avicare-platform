# Formules à la saisie journalière + saisie pondeuses — Design

**Date :** 2026-07-12
**Contexte :** Brainstorm #6 du backlog de test. Deux manques constatés :
1. Les **formules d'aliment** créées dans Stock ne sont pas utilisables à la saisie journalière —
   elles ne consomment donc jamais leurs ingrédients (« j'ai créé une formule que je n'utilise pas »).
2. Il n'existe **aucune saisie journalière pour un lot de pondeuses** (seulement collecte d'œufs +
   attrition/mortalité).

## Décisions verrouillées (brainstorming)

- **Sémantique stock d'une formule = décomposition (Option 1, avance la V2 de D20).** Choisir une
  formule à la saisie journalière décrémente **chaque ingrédient** proportionnellement au total kg
  saisi. La décision D20 (« V1 = article unique, formule = aide au coût sans décomposition ») est
  **révisée** : la décomposition passe en V1. Choix de roadmap assumé (solo owner).
- **Saisie pondeuses = aliment + eau uniquement.** `feedKg` + `waterL` + source aliment. La
  **mortalité reste dans l'onglet Pondeuses → Attrition** (`FlockAttritionPanel`) et les **œufs dans
  Collectes** — pas de double-saisie. `mortalityCount` est forcé à `0` dans le nouveau dialogue.
- **Stock négatif toléré** à la décomposition (D19, non bloquant) ; **atomicité** : la décomposition
  se fait dans la transaction existante de `record` (rollback global si un ingrédient échoue).
- Périmètre formule = **aliment uniquement** (pas de formule pour vaccination/traitement).

## Architecture existante (réutilisée)

- Lots poulet de chair **et** pondeuses sont tous des `PoultryBatch` et partagent l'endpoint
  générique `POST /api/v1/farms/{farmId}/poultry-batches/{batchId}/daily-records`
  (`PoultryDailyRecordController`).
- `DailyRecordService.record(unitId, cmd, userId)` **n'a aucune contrainte d'espèce** → il supporte
  déjà un `DailyRecord` pour un lot pondeuse. Il upsert un `DailyRecord` par (unité, date) et, si
  `cmd.feedConsumption() != null`, pose un mouvement OUT via `StockConsumptionService.applyConsumption`.
- `StockConsumptionService.applyConsumption(...)` pose un mouvement `OUT` atomique, raison
  `CONSUMPTION_LOT` pour un lot ; tolère un stock résultant négatif (D19).
- `FeedFormula` porte `List<FormulaIngredient>` en JSONB ; `FormulaIngredient(String articleKey,
  ArticleSource articleSource, BigDecimal percentage)` où `percentage` ∈ [0,100] (= kg pour 100 kg
  d'aliment). `FeedFormulaService` est **farm-scopé** et distingue deux natures de formule :
  **plateforme** (templates, identifiées par `key`, via `getPlatformFormula(farmId, key)` →
  `PlatformFormulaDto` qui porte `List<FormulaIngredient> ingredients()`) et **ferme** (créées par
  l'utilisateur, identifiées par `id`, via `listFarmFormulas(farmId)` → entités `FeedFormula` avec
  `getIngredients()`). `getAvailableFormulas` / `listAllAvailable(farmId)` renvoient les deux listes.
  > Ce sont surtout les **formules ferme** (celles que l'utilisateur crée) qui motivent ce brainstorm :
  > la décomposition **doit** les supporter, pas seulement les templates plateforme.
- `StockConsumptionService.applyConsumption(Long farmId, StockConsumption consumption,
  ConsumptionSource source, Long userId)` : signature réelle. `ConsumptionSource.dailyRecord(unitId,
  recordId)` est une **factory** (pas un enum). L'appel exige `quantity > 0` (sinon 422) et impose
  le module `inventory` actif (sinon 422). C'est exactement le chemin déjà emprunté par
  `feedConsumption`.
- Frontend : `StockConsumptionSection` (picker 1 article + quantité), `poultryBatchesApi`
  (`listDailyRecords`, mutation `recordDailyRecord`, tous génériques sur `batchId`),
  `LayerUnitDetailView` (onglets Vue d'ensemble / Collectes / Pondeuses / Sanitaire).

## Backend (aucune migration, aucun nouvel endpoint)

### `FormulaConsumption` — nouveau record de commande

```java
package com.avicare.livestock.poultry;

import java.math.BigDecimal;

/**
 * Optional feed-formula reference at daily entry (Décision D20 révisée). When set on a
 * {@link DailyRecordCommand}, the formula's ingredients are each drawn from stock as an OUT
 * movement proportional to {@code totalKg}. Mutually exclusive with {@code feedConsumption}.
 * Exactly one of {@code formulaKey} (platform template) / {@code formulaId} (farm formula) is set.
 */
public record FormulaConsumption(
    String formulaKey, Long formulaId, BigDecimal totalKg, String notes) {}
```

### `DailyRecordCommand` — champ `feedFormula`

Ajouter `FormulaConsumption feedFormula` (dernier composant). Contrat : `feedConsumption` et
`feedFormula` sont **mutuellement exclusifs** (au plus un non-null).

### `DailyRecordRequest` (REST DTO) — champ `feedFormula`

Ajouter le champ optionnel `FeedFormulaRequest feedFormula` (record REST miroir :
`formulaKey`, `formulaId`, `totalKg`, `notes`), mappé vers `FormulaConsumption` dans le contrôleur.

### `FeedFormulaService.resolveIngredients` — nouvelle méthode d'accès unifiée

```java
/** Ingredients of a platform (by key) OR farm (by id) formula. Exactly one id must be non-null. */
public List<FormulaIngredient> resolveIngredients(Long farmId, String formulaKey, Long formulaId) {
  if (formulaKey != null) {
    PlatformFormulaDto dto = getPlatformFormula(farmId, formulaKey); // throws 422 if missing
    return dto.ingredients();
  }
  if (formulaId != null) {
    FeedFormula f = feedFormulaRepository
        .findByFarmIdAndIdAndActiveTrue(farmId, formulaId)
        .orElseThrow(() -> new BusinessRuleException("FEED_FORMULA_NOT_FOUND", "..."));
    return f.getIngredients();
  }
  throw new BusinessRuleException("FEED_FORMULA_REFERENCE_REQUIRED", "...");
}
```

> Vérifier le nom exact du repo/finder existant (`load(farmId, id)` privé ou `findByFarmIdAndId…`).
> Réutiliser ce qui existe plutôt qu'ajouter un finder si un équivalent est déjà là.

### `DailyRecordService.record` — décomposition

- `farmId` est déjà accessible via `unit.getFarmId()` (utilisé aujourd'hui pour `feedConsumption`).
- **Garde xor** : si `cmd.feedConsumption() != null && cmd.feedFormula() != null` →
  `BusinessRuleException` (422), code `"DAILY_RECORD_FEED_SOURCE_CONFLICT"`.
- Si `cmd.feedFormula() != null` :
  - `totalKg` null ou ≤ 0 → `BusinessRuleException` (422) `"FEED_FORMULA_QUANTITY"`.
  - `List<FormulaIngredient> ings = feedFormulaService.resolveIngredients(unit.getFarmId(),
    ff.formulaKey(), ff.formulaId())` (422 si introuvable / référence absente).
  - Pour chaque `ing` : `qty = totalKg.multiply(ing.percentage()).divide(BigDecimal.valueOf(100),
    3, RoundingMode.HALF_UP)` ; **si `qty.signum() > 0`**, appeler :

    ```java
    stockConsumptionService.applyConsumption(
        unit.getFarmId(),
        new StockConsumption(ing.articleKey(), ing.articleSource(), qty, ff.notes()),
        ConsumptionSource.dailyRecord(unitId, saved.getId()),
        userId);
    ```

  - Tout dans la transaction `@Transactional` existante de `record` → atomique (rollback global).
- Si `cmd.feedConsumption() != null` (et `feedFormula == null`) : comportement inchangé.
- Si aucun des deux : aucun mouvement (inchangé).

## Frontend

### `FeedSourceSection` (partagé — remplace l'usage direct de `StockConsumptionSection`)

Composant à **3 états** exclusifs (RadioGroup ou ToggleButtonGroup) :
- **Aucun** (défaut) : n'émet rien (`onChange(null, null)`).
- **Article standard** : réutilise le picker actuel (1 article FEED depuis
  `useGetAllArticlesQuery`, `sourceFilter="INVENTORY"`, + quantité). Émet `feedConsumption:
  StockConsumption`, `feedFormula: null`.
- **Formule** : select de formule listant **plateforme + ferme** (`useGetAvailableFormulasQuery`
  de `feedFormulasApi`) + champ **total kg**. Chaque option connaît sa nature (plateforme→`key`,
  ferme→`id`). Affiche un **aperçu décomposé lecture seule** : par ingrédient `label — qty = totalKg
  × pct% — (stock actuel → stock après)`. Émet `feedFormula: {formulaKey?, formulaId?, totalKg}`
  (exactement un des deux identifiants), `feedConsumption: null`.

Signature : `onChange(feedConsumption: StockConsumption | null, feedFormula: FeedFormulaRef | null)`
où `FeedFormulaRef = {formulaKey?: string; formulaId?: number; totalKg: number}`. Le parent stocke
les deux et n'en envoie qu'un (l'autre est `undefined`).

### `DailyRecordDialog` (poulet de chair) — bascule sur `FeedSourceSection`

Remplacer `<StockConsumptionSection>` par `<FeedSourceSection>`. Le submit envoie
`feedConsumption` **ou** `feedFormula` selon le mode (l'un `undefined`).

### `poultryBatchesApi` / types — champ `feedFormula`

- Type `RecordDailyRecordBody` (ou équivalent) : ajouter `feedFormula?: {formulaKey?: string;
  formulaId?: number; totalKg: number; notes?: string}`.
- La mutation `recordDailyRecord` passe déjà le corps tel quel → aucun changement de query, juste le
  type.

### Pondeuses — onglet + dialogue

- `LayerUnitDetailView` : nouvel onglet **« Suivi journalier »** (`key: "records"`, inséré entre
  Collectes et Pondeuses), rendant un `LayerDailyRecordsTab`.
- `LayerDailyRecordsTab` : liste les `DailyRecord` du lot (`useListDailyRecordsQuery({farmId,
  batchId: unit.id})`, générique) — colonnes date / aliment (kg) / eau (L) / observations ; bouton
  « Saisir » (gate rôle opérationnel) ouvre `LayerDailyEntryDialog`.
- `LayerDailyEntryDialog` : champs `recordDate`, `feedKg`, `waterL`, `observations` +
  `FeedSourceSection`. **`mortalityCount` codé en dur à `0`** (commentaire : la mortalité pondeuse
  passe par Attrition). Submit → `recordDailyRecord` sur le même endpoint. Reset edge-triggered sur
  `open` (leçon `member_access_customization`).

## Tests

- **Backend** `DailyRecordServiceTest` (Mockito, `feedFormulaService` mocké) :
  - Formule 3 ingrédients (50/30/20 %) + `totalKg=100` → **3** `applyConsumption` de 50/30/20 kg,
    `ConsumptionSource.dailyRecord(unitId, recordId)` (capture d'arguments).
  - Référence **ferme** (`formulaId`) résolue via `resolveIngredients(farmId, null, id)` décompose
    aussi (le cas qui motive le besoin).
  - `feedConsumption` **et** `feedFormula` tous deux non-null → `BusinessRuleException` 422.
  - `resolveIngredients` lève 422 (introuvable) → propagé ; `totalKg` null/≤0 → 422.
  - `feedConsumption` seul → **1** mouvement (non-régression) ; aucun des deux → **0** mouvement.
  - Ingrédient à 0 kg calculé (pct=0) → pas d'appel `applyConsumption` pour lui.
- **Backend** `FeedFormulaServiceTest` : `resolveIngredients` renvoie les ingrédients plateforme
  (par key) et ferme (par id) ; référence vide (les deux null) → 422.
- **Backend IT** (`*IT`, CI only) : optionnel — un POST daily-record avec `feedFormula` sur un lot
  décrémente N `stock_movements`. Suffit si le test unitaire couvre la décomposition.
- **Frontend** :
  - `FeedSourceSection` — bascule des 3 états émet le bon couple `(feedConsumption, feedFormula)` ;
    mode formule calcule l'aperçu (50 kg pour 50 % de 100 kg).
  - `LayerDailyEntryDialog` — payload `mortalityCount: 0`, `feedKg`/`waterL` transmis, source aliment
    optionnelle ; reset à l'ouverture.
  - `LayerUnitDetailView` — l'onglet « Suivi journalier » est présent et liste les records.

## Hors périmètre (V1)

- Édition/annulation rétroactive des mouvements générés par une décomposition (correction =
  ajustement stock manuel).
- Formule pour vaccination/traitement (aliment uniquement).
- Saisie mortalité ou œufs dans le dialogue pondeuse (restent Attrition / Collecte).

## Contraintes globales

- Aucune signature Claude/AI dans les commits ; Conventional Commits, scope bounded-context
  (`feat(livestock:poultry)`, `feat(web)`).
- Branch protection → PR + `gh pr merge --rebase --delete-branch`.
- Pas de cross-import entre bounded contexts — l'inventaire/formules restent dans `livestock`
  (même contexte, pas de façade nécessaire ici).
- RBAC : saisie journalière = rôle opérationnel (déjà enforce via `PoultryBatchController.WRITE`) ;
  l'UI gate le bouton en miroir.
- `@Transactional` sur `record` (écriture) : la décomposition doit rester dans cette transaction.
- Spotless Google Java Format avant commit backend (`./mvnw -q spotless:apply -pl avicare-app`) ;
  vitest + `npm run lint` côté frontend.
- `*IT` Testcontainers = CI only (Docker local indisponible).
- Web : « This is NOT the Next.js you know » — consulter `web/node_modules/next/dist/docs/` au besoin.
- MUI est **v9** dans ce repo (pas v7 — cf. leçon `member_access_customization`).
