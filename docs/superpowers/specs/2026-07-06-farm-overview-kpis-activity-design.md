# Page Ferme « Vue d'ensemble » — KPIs + activité récente — Design

**Date :** 2026-07-06
**Contexte :** Jawdi. La page `Fermes › [ferme] › Vue d'ensemble` (`FarmDetailView.tsx`, onglet
`overview`) affiche aujourd'hui 4 cartes KPI vides (« — · bientôt disponible ») et un placeholder
« Activité récente ». Bug #9 du backlog de test. Objectif : brancher des données réelles.

Deux parties :
1. **Cartes KPI** — 4 indicateurs élevage sur une fenêtre 7 jours.
2. **Activité récente** — flux multi-sources (élevage + ventes + stock) fusionné, récent d'abord.

---

## Décisions verrouillées (brainstorming)

- Fenêtre KPI = **fixe 7 jours** (pas de sélecteur ; libellé « Production (7j) », esprit « aperçu rapide »).
- Widget « Aliment (journalier) » = **consommation moyenne journalière (kg)** dérivée de `DailyRecord.feed_kg`, PAS un FCR.
- Activité récente = **multi-sources** (élevage `lifecycle_events` + `stock_movements` + commercial ventes/paiements), fusionnée côté `reporting`.
- Pas de pagination V1 (top ~20).

---

## Partie 1 — Les 4 cartes KPI

Une seule requête : l'endpoint existant `GET /api/v1/farms/{farmId}/dashboard?period=7d` renvoie déjà
`DashboardResponse.LivestockSection`. Mapping des cartes :

| Carte (libellé existant) | Champ `livestock.*` | Statut |
|---|---|---|
| Effectif total | `totalHeadcount` (long, snapshot) | existe |
| Taux de mortalité | `mortalityRate` (Double %, null si pas d'effectif initial) | existe |
| Production (7j) | `layingRate` (Double %, null hors pondeuses/pas de ponte) | existe |
| Aliment (journalier) | **`dailyFeedKg` (Double, nullable)** — NOUVEAU | à ajouter |

### Backend — nouveau champ `dailyFeedKg`

- `LivestockStats` (record, `com.avicare.livestock.api.dto`) : ajouter `Double dailyFeedKg` (dernier
  champ). Nullable quand aucune saisie journalière dans la fenêtre.
- `DashboardResponse.LivestockSection` (`com.avicare.reporting.api.dto`) : ajouter `Double dailyFeedKg`
  (dernier champ ; `@JsonInclude(NON_NULL)` déjà en place → omis si null).
- Calcul (dans le producteur de `LivestockStats`, `LivestockFacade` impl / son agrégateur) :
  `dailyFeedKg = Σ(DailyRecord.feed_kg de la ferme dans [from, to]) / nombre de jours distincts saisis`.
  Choix « moyenne journalière » (lisse les trous de saisie). Si aucun `DailyRecord` dans la fenêtre → `null`.
  Nouvelle requête repo `DailyRecordRepository` : somme des `feed_kg` (et count des jours) sur la ferme + fenêtre.
  Arrondi à 1 décimale à l'affichage (frontend), valeur brute `Double` côté API.
- La ferme peut avoir plusieurs unités : sommer les `feed_kg` de toutes les unités de la ferme.
  Le `DailyRecord` porte `production_unit_id` ; joindre à `production_units.farm_id` (via la requête, comme les autres agrégats élevage).

> Le dashboard principal héritera aussi de `dailyFeedKg` (même agrégat) — bénéfice gratuit, pas d'usage requis là-bas.

### Frontend — cartes

- `FarmDetailView` (onglet overview) : appeler `useGetDashboardQuery({ farmId, period: "7d" })`
  (le hook accepte déjà `period`/`from`/`to`). Remplacer chaque « — » par la valeur formatée :
  - Effectif total : `totalHeadcount` (entier).
  - Taux de mortalité : `mortalityRate != null ? mortalityRate.toFixed(1) + " %" : "n/d"`.
  - Production (7j) : `layingRate != null ? layingRate.toFixed(1) + " %" : "n/d"`.
  - Aliment (journalier) : `dailyFeedKg != null ? dailyFeedKg.toFixed(1) + " kg" : "n/d"`, hint → « Consommation moy./jour ».
- États : pendant le chargement, garder un skeleton/« … » ; en erreur, « n/d ». Ne pas casser si `livestock` absent.
- Le champ `dailyFeedKg` s'ajoute au type `DashboardResponse` frontend (`@/types/dashboard`).

---

## Partie 2 — Activité récente (multi-sources)

### DTO partagé

`com.avicare.common.api.dto.ActivityItem` (record, à côté de `DayValue`/`NamedValue`) :

```java
public record ActivityItem(
    String kind,            // ex. "MORTALITY", "VET_VISIT", "SALE", "PAYMENT", "STOCK_IN", ...
    LocalDateTime at,       // horodatage de tri (récent d'abord)
    String label,           // libellé FR prêt à afficher, ex. "Mortalité : 5 sujets"
    String detail) {}       // ligne secondaire optionnelle (peut être null), ex. nom d'unité / montant
```

### Sources & façades

**`LivestockFacade.recentActivity(Long farmId, int limit)` → `List<ActivityItem>`** (contexte livestock) :
- `lifecycle_events` de la ferme (join `production_units.farm_id`), **liste blanche** d'`event_type` :
  `MORTALITY`, `COUNT_ADJUSTMENT`, `VACCINATION_ADMINISTERED`, `VET_VISIT_RECORDED`,
  `DAILY_PRODUCTION_CLOSED`, `CREATED`, `HEALTH_OBSERVATION`. **Exclure** les marqueurs de garde /
  rejet : `INVALID_*`, `UNKNOWN_*`, `*_NOOP`, `NO_COLLECTIONS_TO_CLOSE`, `STOCK_ADJUSTMENT_NEGATIVE`,
  `VACCINATION_ALREADY_RECORDED`, `VACCINATION_PROGRAM_NOT_FOUND`, `VET_WRONG_FARM`.
  `at` = `lifecycle_events.created_at`. `label` mappé par `event_type` (FR), en s'aidant de
  `details` JSONB / `reason` quand utile (ex. MORTALITY → « Mortalité : {quantityDelta} sujets »).
- `stock_movements` de la ferme (join `stock_items` → ferme) : `movementType` IN/OUT/ADJUSTMENT →
  `kind` `STOCK_IN`/`STOCK_OUT`/`STOCK_ADJUSTMENT` ; `at` = `movementDate.atStartOfDay()` (pas de
  `created_at` sur ce journal) ; `label` = ex. « Entrée stock : {article} (+{qty}) ».
- Prend au plus `limit` de CHAQUE sous-source (déjà triées desc) avant de rendre la liste.

**`CommercialFacade.recentActivity(Long farmId, int limit)` → `List<ActivityItem>`** (contexte commercial) :
- `sales` COMPLETED : `kind="SALE"`, `at=created_at`, `label="Vente {totalXof} XOF"`.
- `payments` : `kind="PAYMENT"`, `at=created_at`, `label="Paiement reçu {amountXof} XOF"`.
- Au plus `limit` par sous-source.

### Fusion (reporting)

- Nouveau `com.avicare.reporting.service.ActivityService` (ou méthode sur `ReportingService`) :
  `recentActivity(farmId, limit)` = concatène `livestockFacade.recentActivity(farmId, limit)` +
  `commercialFacade.recentActivity(farmId, limit)`, trie par `at` **desc** (nulls en dernier), prend `limit`.
- Endpoint : `GET /api/v1/farms/{farmId}/activity?limit=20` dans un `ActivityController`
  (`com.avicare.reporting.controller`), RBAC `@PreAuthorize("@farmAccess.hasAccess(#farmId)")`
  (comme `DashboardController`). `limit` défaut 20, borné (ex. max 50).
  Réponse : `ApiResponse<List<ActivityItem>>`.

### Frontend — flux

- Type `ActivityItem` dans `@/types` ; hook `useGetFarmActivityQuery({ farmId, limit })` dans un
  `activityApi.ts` (ou ajout à `dashboardApi.ts`), `GET .../activity?limit=20`, unwrap `{data}`.
- Remplacer le placeholder « Activité récente » de `FarmDetailView` par une liste : par item, une
  icône selon `kind` (MUI icons : mortalité, vaccin, véto, vente, paiement, stock…), le `label`, le
  `detail` en secondaire, et la date relative (« il y a 2 h »). État vide : « Aucune activité récente. »
  État chargement : skeleton.

---

## Architecture & isolation

- Réutilise le pattern `reporting` existant (reporting agrège via façades publiques ; déjà dépendant
  de `LivestockFacade` + `CommercialFacade`). Aucun cross-import de domaine.
- `ActivityItem` en `common-api` : visible par les 2 façades productrices et par reporting sans
  violation de contexte (même emplacement que `DayValue`/`NamedValue`).
- Chaque façade ne connaît que ses propres tables ; reporting ne connaît que le DTO partagé.

## Tests

- **Backend** : requête `DailyRecordRepository` feed (slice `@DataJpaTest` Testcontainers) ; `dailyFeedKg`
  dans l'agrégat (test du producteur) ; `LivestockFacade.recentActivity` (IT Testcontainers : whitelist
  respectée, stock inclus, tri) ; `CommercialFacade.recentActivity` (IT) ; `ActivityService` merge/tri
  (unit, façades mockées) ; endpoint `/activity` (IT E2E, RBAC).
- **Frontend** : cartes KPI branchées (vitest, y compris null → « n/d ») ; liste d'activité (rendu des
  items, icônes par kind, état vide).
- **Boot DB-less** : `ActivityController` + `ActivityService` s'ajoutent aux beans ; vérifier que les
  **3 contextes DB-less** (`SecurityE2ETest`, `SecurityIntegrationTest`, `DashboardControllerIT`)
  bootent (aucun nouveau repo non mocké : les façades sont déjà des beans, mais si `ActivityService`
  dépend d'un nouveau repo côté façade, le mocker le cas échéant).

## Hors périmètre (V1)

- Pagination / « voir tout » de l'activité (top 20 seulement).
- Factures émises, mouvements de commande/livraison dans le flux (ventes + paiements suffisent V1).
- FCR réel (indice de conversion) — le widget montre la consommation kg, pas un ratio.
- Sélecteur de période sur la page Ferme (fenêtre 7j fixe).
- Onglet « Paramètres » de la ferme (reste un placeholder, hors sujet).

## Contraintes globales

- Aucune signature Claude/AI dans les commits ; Conventional Commits, scope bounded-context.
- Branch protection → PR + `gh pr merge --rebase --delete-branch`.
- Pas de cross-import entre bounded contexts — façades publiques uniquement, référencement par ID.
- DTO partagé en `common-api` (`com.avicare.common.api.dto`).
- `*IT` Testcontainers : CI only (Docker local indisponible) ; valider le reste en local.
- Spotless Google Java Format avant commit backend (`./mvnw -q spotless:apply -pl avicare-app`).
- Après édition d'un fichier test Java : `clean test-compile`. Frontend : vitest + `npm run lint`.
- Web : « This is NOT the Next.js you know » — consulter `web/node_modules/next/dist/docs/` si API Next spécifique.
