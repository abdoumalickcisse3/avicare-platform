# Onglet « Pondeuses » — suivi de bande (layer flock tab)

**Date** : 2026-06-29
**Statut** : Validé (design) — en attente de relecture spec
**Périmètre** : Frontend uniquement (`web/`). Aucune migration, aucun changement backend.

> Remplace le `LayerPlaceholderTab` (« bientôt disponible ») de l'onglet **Pondeuses** dans
> `LayerUnitDetailView`. Présentation retenue : **« Courbe-héros + panneau attrition »** (pas de
> bandeau de cartes KPI — celui-ci existe déjà dans la Vue d'ensemble).

---

## 1. Contexte & problème

La fiche d'un lot de pondeuses (`/elevage/oeufs/[unitId]`) a 4 onglets : Vue d'ensemble, Collectes,
**Pondeuses**, Sanitaire. L'onglet **Pondeuses** est aujourd'hui un placeholder. Il doit devenir le
suivi de **la bande elle-même** : effectif, mortalité, réforme, entrée en ponte, et le stock de
plateaux d'œufs issu des collectes.

## 2. Objectif & non-objectifs

**Objectif** : développer l'onglet Pondeuses pour suivre et faire évoluer l'effectif de la bande
(mortalité, réforme), visualiser son attrition (courbe + relevé), repérer l'entrée en ponte, et
afficher le stock de plateaux.

**Non-objectifs (hors périmètre)** :
- Tout changement backend ou migration Flyway (on réutilise les endpoints existants).
- Taxonomie des causes de mortalité ; la cause reste un texte libre (`reason`).
- Entrée en ponte **stockée** en base (on la **dérive**, cf. §5).
- Vente des poules de réforme via le flux commercial (séparé) — ici la réforme = retrait d'effectif.
- Bandeau de cartes KPI (rejeté par l'utilisateur).

## 3. Décisions verrouillées

- **100 % frontend**, réutilisation des endpoints existants. Aucun nouveau slice ; on **étend**
  `productionUnitsApi`.
- **Mortalité** → `POST /api/v1/farms/{farmId}/production-units/{unitId}/mortality` (existant ;
  décrémente l'effectif, journalise un événement `MORTALITY`).
- **Réforme** → `POST …/production-units/{unitId}/events` avec
  `{ eventType: "REFORM", quantityDelta: -N, reason }`. `lifecycle_events.event_type` est un VARCHAR
  **libre** (aucune contrainte CHECK vérifiée en base) → pas de migration. Le service `recordEvent`
  applique le delta à `current_count` et conserve les gardes-fous (jamais < 0 → `COUNT_BELOW_ZERO` 422,
  refus si lot CLOSED/CANCELLED → `PRODUCTION_UNIT_NOT_OPEN` 422).
- **Entrée en ponte = dérivée** : date de la **première journée de production clôturée avec œufs > 0**
  (`useGetDailyProductionsQuery`), repli sur la première collecte si aucune journée clôturée. Affichée
  en semaine d'âge (via `ageInDays(unit.startDate)`) + date. Si indéterminée → « — ».
- **Courbe d'effectif** reconstruite côté client depuis la timeline d'événements : on **accumule les
  deltas depuis 0** dans l'ordre chronologique. L'événement `CREATED` porte `quantityDelta =
  initialCount` (vérifié côté backend ; aussi `details.initial_count`) → le 1er point vaut
  l'effectif initial, le dernier vaut l'effectif courant. Aucun champ `initialCount` n'est requis sur
  `ProductionUnit` (il n'en a pas) : tout se dérive des événements.
- **Plateaux d'œufs** = réutilisation directe du composant existant `TrayStockPanel` (stock ferme,
  pleins/vides, ajustable ; alimenté par les clôtures de ponte).
- **Actions visibles uniquement si `unit.status === "ACTIVE"`** (cohérent avec l'en-tête de la fiche).

## 4. Disposition (présentation retenue)

```
┌─ Effectif de la bande (courbe, héros) ─────┐ ┌─ Attrition ──────────┐
│  1000 ▉▇▆▅▄▃▂ 942   (courbe effectif/temps) │ │ Initial      1 000   │
│                                             │ │ − Mortalité     48   │
│                                             │ │ − Réforme       10   │
│                                             │ │ = Effectif     942   │
│                                             │ │ Entrée ponte   S.21  │
│                                             │ │ [Mortalité] [Réforme]│
└─────────────────────────────────────────────┘ └──────────────────────┘
┌─ Plateaux d'œufs (TrayStockPanel) ───────────────────────────────────┐
│  Pleins 29    Vides 4                               [Ajuster]         │
└──────────────────────────────────────────────────────────────────────┘
┌─ Historique de bande ────────────────────────────────────────────────┐
│  29/06   Réforme     −10    réforme fin de ponte                      │
│  25/06   Mortalité    −3    chaleur                                   │
│  01/03   Création   1 000                                            │
└──────────────────────────────────────────────────────────────────────┘
```

- **Ligne 1** : deux cartes côte à côte (`md`: ~2/3 + 1/3 ; `xs`: empilées). Carte gauche = courbe
  d'effectif (héros). Carte droite = panneau **attrition** (relevé `Initial → −Mortalité → −Réforme =
  Effectif` + entrée en ponte) et les deux boutons d'action.
- **Ligne 2** : `TrayStockPanel`.
- **Ligne 3** : historique de bande (timeline simple : date, type traduit, delta signé, motif).
- Style aligné sur `LayerOverviewTab` (cartes MUI, `colors` de `@/theme/tokens`, `mono` pour les
  nombres, `formatNumber`). Mortalité teintée `error`, réforme teintée `accent`/`warning`.

## 5. Données & API (ajouts frontend uniquement)

`store/api/productionUnitsApi.ts` (tag existant `ProductionUnit`, nouveau tag `UnitEvent`) :
- `getUnitEvents({ farmId, unitId }) → LifecycleEvent[]` — `GET …/production-units/{unitId}/events` ;
  `providesTags: [{ type: "UnitEvent", id: unitId }]`.
- `recordMortality({ farmId, unitId, body: { count, reason } }) → LifecycleEvent` —
  `POST …/mortality` ; `invalidatesTags: [{ type:"ProductionUnit", id:unitId }, { type:"ProductionUnit", id:"LIST" }, { type:"UnitEvent", id:unitId }]`.
- `recordUnitEvent({ farmId, unitId, body: { eventType, quantityDelta, reason } }) → LifecycleEvent` —
  `POST …/events` ; mêmes invalidations. (Sert la réforme : `eventType:"REFORM"`, delta négatif.)

Types (`types/index.ts`) :
```ts
export interface LifecycleEvent {
  id: number;
  productionUnitId: number;
  eventType: string;          // CREATED | MORTALITY | REFORM | COUNT_ADJUSTMENT | SALE | SALE_CANCEL
  quantityDelta: number;
  reason: string | null;
  details: Record<string, unknown>;
  occurredAt: string;
}
export interface MortalityInput { count: number; reason?: string; }
export interface UnitEventInput { eventType: string; quantityDelta: number; reason?: string; }
```

Helpers purs (`lib/flock.ts`, testés) — tout se dérive de la liste d'événements (l'effectif initial =
le `quantityDelta` du `CREATED`) :
- `reconstructFlockCurve(events): { date: string; count: number }[]` — trie par `occurredAt`, **accumule
  les deltas depuis 0**, renvoie un point par événement (date ISO `YYYY-MM-DD` + effectif cumulé après
  application). Le 1er point (CREATED) = effectif initial ; le dernier = effectif courant.
- `summarizeAttrition(events): { initial, mortality, reform, current, attritionPct }` — `initial` =
  Σ des deltas `CREATED` ; `mortality` = Σ|delta| des `MORTALITY` ; `reform` = Σ|delta| des `REFORM` ;
  `current` = somme de **tous** les deltas (= effectif courant reconstitué) ;
  `attritionPct = (initial − current) / initial * 100` (0 si `initial === 0`).
- `deriveLayingOnset(dailyProductions, collections): string | null` — 1re `production_date` d'une
  journée clôturée avec `total_eggs_collected > 0` ; repli sur la 1re `collectionDate` avec
  `totalEggs > 0` ; sinon `null`.

## 6. Composants (fichiers)

**Nouveaux** (`components/poultry-layer/`) :
- `LayerFlockTab.tsx` — orchestre l'onglet (queries effectif/événements/productions, layout §4).
- `FlockAttritionPanel.tsx` — le relevé attrition + entrée en ponte + boutons d'action.
- `LayerFlockEventDialog.tsx` — un seul dialog avec `mode: "mortality" | "reform"` (champ quantité +
  motif ; appelle `recordMortality` ou `recordUnitEvent` selon le mode ; garde front quantité > 0 et
  ≤ effectif, le 422 backend restant la garde réelle).
- `charts/FlockCountCurve.tsx` — courbe d'effectif (même techno que les charts `charts/` existants).
- `BandEventList.tsx` — l'historique de bande (liste timeline).

**Nouveau** (`lib/`) : `flock.ts` (helpers purs §5).

**Modifiés** :
- `LayerUnitDetailView.tsx` — onglet `layers` : remplacer `<LayerPlaceholderTab .../>` par
  `<LayerFlockTab farmId={farmId} unit={unit} />`. (Le `LayerPlaceholderTab` reste utilisé ailleurs.)
- `store/api/productionUnitsApi.ts`, `types/index.ts` (§5). Tag `UnitEvent` ajouté au `tagTypes` du
  `baseApi` si nécessaire.

## 7. Gestion d'erreurs & états

- `LayerFlockTab` reçoit `farmId` + `unit` (déjà chargés par la vue parente) → pas de `FeatureLock`
  propre (géré par la vue). Les queries internes gèrent `isLoading` (squelettes) et listes vides
  (« Aucun événement enregistré »).
- Dialog : motif optionnel ; quantité entière > 0 requise ; si quantité > effectif, alerte douce mais
  envoi possible (le backend tranche). Toast succès/erreur via `useToast` + `apiErrorMessage`.
- Lot non `ACTIVE` → boutons d'action masqués ; lecture seule (courbe/attrition/historique/plateaux).

## 8. Tests (Vitest)

- **Purs** (`lib/flock.test.ts`) : `reconstructFlockCurve` (ordre chrono, delta CREATED ignoré, série
  décroissante) ; `summarizeAttrition` (mortalité/réforme séparées, attritionPct, init 0) ;
  `deriveLayingOnset` (1re journée clôturée avec œufs ; repli collecte ; null).
- **Composant** : `FlockAttritionPanel` affiche initial/mortalité/réforme/effectif/entrée en ponte ;
  `LayerFlockEventDialog` soumet (mortalité et réforme) et bloque quantité 0 ; boutons masqués si lot
  non ACTIVE. Stub `fetch` (pattern `QuickSaleDialog.test.tsx` / `renderWithProviders`).
- Garde-fou : `tsc --noEmit`, `npm run lint` (projet entier, 0 erreur), `vitest run`, `next build`.

## 9. Risques & mitigations

- **L'endpoint `/events` renvoie tous les types** (dont `SALE`) : l'attrition ne compte que
  `MORTALITY`/`REFORM` ; la courbe applique tous les deltas (effet réel sur l'effectif). Cohérent.
- **Entrée en ponte dérivée approximative** (dépend des journées clôturées) : acceptable V1 ; un champ
  stocké pourra l'affiner plus tard (hors périmètre).
- **`event_type` libre** : si une contrainte CHECK est ajoutée plus tard côté DB, elle devra inclure
  `REFORM` — noté pour le futur (pas de contrainte aujourd'hui, vérifié en base).
- **Réforme vs vente** : ici la réforme ne génère ni facture ni encaissement ; si l'utilisateur veut
  vendre les poules de réforme, c'est le flux commercial (séparé).
