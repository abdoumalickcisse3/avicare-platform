# Analytique globale + dépense auto sur visite véto — Design

**Date :** 2026-07-06
**Contexte :** Jawdi, module `finance` (root context `com.avicare.finance`). Fait suite à
la P1 (dépenses + analytique par-lot, PR #116) et au batch de bugs PR #118 (retrait du tag
lot sur la création de dépense).

Deux features indépendantes livrées ensemble :

1. **Analytique globale** — remplacer l'analytique « par-lot uniquement » par un compte de
   résultat ferme : total revenus − total dépenses = marge.
2. **Visite véto → dépense** — le coût saisi sur une visite vétérinaire crée automatiquement
   une dépense `veterinary`.

---

## Feature 1 — Analytique globale (compte de résultat ferme)

### Motivation

L'analytique actuelle (`FinanceAnalyticsService.unitAnalytics`) ne fonctionne que par lot et
expose un « coût par tête ». Depuis PR #118, les dépenses ne sont plus rattachées à un lot
(`productionUnitId` toujours nul à la création manuelle), donc la ventilation des coûts par
lot est devenue vide. Le besoin réel est un **P&L au niveau ferme**.

### Définition du revenu (décidée)

```
revenu   = Σ ventes directes COMPLETED (Sale.totalXof)
         + Σ amountPaidXof des factures dont sourceType = DELIVERY
marge    = revenu − Σ toutes les dépenses de la ferme
```

**Pas de double comptage.** Le modèle commercial :

- Une **vente directe** (`Sale`) est COMPLETED immédiatement → revenu reconnu au comptant.
  Elle peut *optionnellement* être facturée (`Invoice.sourceType = SALE`).
- Une **commande** (`Order`) → livraison (`Delivery`) → facture (`Invoice.sourceType = DELIVERY`)
  → paiement. Une commande n'est un revenu qu'une fois **livrée + payée**.

On additionne donc : toutes les ventes COMPLETED (comptant) **+** uniquement les paiements
des factures de **livraison**. Les paiements des factures issues d'une vente (`sourceType = SALE`)
sont volontairement **exclus** — la vente est déjà comptée à la source → aucun double comptage.

**Totaux cumulés (all-time).** Pas de sélecteur de période en V1 (YAGNI) — cohérent avec la
formulation « le total des revenus / le total des dépenses ». Un filtre de période pourra être
ajouté ultérieurement sans casser le contrat.

### Backend

**`CommercialFacade`** (interface publique commerciale) — deux méthodes ajoutées :

```java
/** Σ des ventes directes COMPLETED de la ferme (lifetime). */
long totalSalesRevenue(Long farmId);

/** Σ des montants encaissés sur les factures issues d'une LIVRAISON (non annulées), lifetime. */
long totalPaidFromDeliveryInvoices(Long farmId);
```

Requêtes repo correspondantes :

- `SaleRepository.sumAllRevenue(farmId)` :
  `SELECT COALESCE(SUM(s.totalXof),0) FROM Sale s WHERE s.farmId = :farmId AND s.status = COMPLETED`
- `InvoiceRepository.sumPaidFromDeliveries(farmId)` :
  `SELECT COALESCE(SUM(i.amountPaidXof),0) FROM Invoice i WHERE i.farmId = :farmId AND i.sourceType = DELIVERY AND i.status <> CANCELLED`

**`ExpenseRepository`** — deux méthodes ajoutées :

- `long sumAll(Long farmId)` : Σ `amount_xof` de toutes les dépenses non supprimées de la ferme.
- `List<Object[]> sumByCategory(Long farmId)` : `[category_key, SUM(amount_xof)]` groupé,
  dépenses non supprimées. (Même forme de ligne que l'existant `sumByCategoryForUnit`.)

> Note soft-delete : les dépenses portent `deleted_at` ; toutes les sommes filtrent
> `deleted_at IS NULL` (via `@SQLRestriction` sur l'entité pour le JPQL, ou clause explicite
> pour le SQL natif — suivre le style de la requête existante `sumByCategoryForUnit`).

**Nouveau DTO** `com.avicare.finance.dto.response.FarmAnalyticsResponse` :

```java
public record FarmAnalyticsResponse(
    long totalRevenueXof,
    long directSalesXof,
    long paidOrdersXof,
    long totalExpenseXof,
    long marginXof,
    List<CategoryCost> expensesByCategory,
    List<UnitRevenue> revenueByUnit) {

  /** Une catégorie de dépense et son total, avec le libellé lisible du catalogue. */
  public record CategoryCost(String categoryKey, String label, long amountXof) {}

  /** Revenu (ventes attribuées) d'un lot. */
  public record UnitRevenue(Long unitId, String unitName, long revenueXof) {}
}
```

**`FinanceAnalyticsService.farmAnalytics(Long farmId)`** :

- `directSalesXof = commercialFacade.totalSalesRevenue(farmId)`
- `paidOrdersXof  = commercialFacade.totalPaidFromDeliveryInvoices(farmId)`
- `totalRevenueXof = directSalesXof + paidOrdersXof`
- `totalExpenseXof = expenseRepository.sumAll(farmId)`
- `marginXof = totalRevenueXof − totalExpenseXof`
- `expensesByCategory` : `expenseRepository.sumByCategory(farmId)` joint au catalogue
  `expense_categories` (labels lisibles, même logique que `unitAnalytics` aujourd'hui).
- `revenueByUnit` : pour chaque lot de la ferme (`livestockFacade.listFarmUnits(farmId)`),
  `commercialFacade.revenueByProductionUnit(farmId, info.id())` ;
  ne retenir que les lots avec `revenueXof > 0`, triés par revenu décroissant.
  Le nom du lot vient de `info.name()` (voir enrichissement du record ci-dessous).

**Enrichissement `LivestockFacade` / `ProductionUnitInfo`** — le record de façade n'expose pas
le nom du lot aujourd'hui ; on ajoute le champ `name` (l'entité `ProductionUnit` porte déjà
`private String name`). Un seul site de construction à mettre à jour :

```java
public record ProductionUnitInfo(
    Long id, Long farmId, Species species, UnitKind unitKind,
    Long breedId, String name, int currentCount, UnitStatus status) {}
```

et dans `LivestockFacadeImpl.toInfo(...)`, insérer `u.getName()` à la bonne position. C'est
un record à construction unique (`toInfo`) → pas d'autre appelant positionnel à corriger ;
les consommateurs lisent par accesseur, aucun impact.

**Endpoint** — ajouté dans `ExpenseController` (`@RequestMapping("/api/v1/farms/{farmId}/finance")`,
qui porte déjà l'analytique) :

```
GET /api/v1/farms/{farmId}/finance/analytics   → FarmAnalyticsResponse
```

RBAC identique à l'existant : `@PreAuthorize` lecture `finance:read` + gating `module.finance`.

**Suppression** (remplacement, pas de conservation en parallèle — validé) :

- `FinanceAnalyticsService.unitAnalytics(...)`
- `UnitAnalyticsResponse` (record + `CategoryCost` interne)
- l'endpoint `GET .../finance/units/{unitId}/analytics` (ancien, dans `ExpenseController`)
- l'usage de `livestockFacade.initialCountOf(...)` et le calcul `costPerHeadXof`
  (la méthode de façade `initialCountOf` reste, elle n'est simplement plus appelée ici)

### Frontend

- `financeApi.ts` : `getFarmAnalytics(farmId)` remplace `getUnitAnalytics(farmId, unitId)`.
- Nouveau composant `web/src/components/finance/FarmAnalyticsView.tsx` :
  - 3 KPIs héros : **Total revenus**, **Total dépenses**, **Marge**
    (marge en vert si `≥ 0`, rouge si `< 0`).
  - Détail du revenu : « Ventes directes » + « Commandes payées ».
  - Dépenses par catégorie (tableau ou barres, libellés du catalogue).
  - Revenu par lot (tableau : nom du lot → revenu). Aucun coût/tête, aucune ventilation
    de coûts par lot.
  - États : chargement (spinner), vide (revenu et dépenses à 0 → message « Aucune donnée
    financière pour le moment »).
- `web/src/app/(dashboard)/finance/analytique/page.tsx` : plus de sélecteur de lot ;
  affiche `FarmAnalyticsView`.
- Suppression de `web/src/components/finance/UnitAnalyticsView.tsx` et de son test.

---

## Feature 2 — Visite véto → dépense automatique

### Motivation

Une visite vétérinaire peut porter un coût (`vet_visits.cost_xof`, déjà existant) qui n'était
pas comptabilisé dans les dépenses. Le coût saisi doit créer automatiquement une dépense
`veterinary`, comme la réception d'un bon de commande crée une dépense `PURCHASE`.

### État existant (vérifié)

- L'entité `VetVisit` a déjà `Integer costXof` (`@Column(name = "cost_xof")`).
- `VetVisitService` expose `record(...)` (création) et `delete(...)` — **pas de méthode
  `update`**. Le hook ne concerne donc que création + suppression.
- Précédent livestock→finance : `PurchaseOrderService` et `StockMovementService`
  (`com.avicare.livestock.inventory`) appellent déjà `FinanceFacade`. `VetVisitService`
  (`com.avicare.livestock.health`) suivra le même pattern.
- Catégorie `veterinary` déjà seedée (V4, `{"label":"Veterinaire / medicaments"}`).

### Backend

**`ExpenseSource`** — ajout de la valeur `VET_VISIT` :

```java
public enum ExpenseSource { MANUAL, PURCHASE, STOCK_ENTRY, SALARY, VET_VISIT }
```

**Migration `V28__expenses_vet_visit_source.sql`** :

```sql
ALTER TABLE expenses DROP CONSTRAINT expenses_source_check;
ALTER TABLE expenses ADD CONSTRAINT expenses_source_check
    CHECK (source IN ('MANUAL','PURCHASE','STOCK_ENTRY','SALARY','VET_VISIT'));

ALTER TABLE expenses ADD COLUMN vet_visit_id BIGINT REFERENCES vet_visits(id);
CREATE INDEX idx_expenses_vet_visit ON expenses(vet_visit_id);
```

**`Expense`** entité — nouveau champ :

```java
@Column(name = "vet_visit_id")
private Long vetVisitId;
```

**`ExpenseRepository`** — lookup d'idempotence :

```java
Optional<Expense> findByFarmIdAndVetVisitId(Long farmId, Long vetVisitId);
```

**`FinanceFacade`** — deux méthodes ajoutées :

```java
/**
 * Enregistre une dépense catégorie `veterinary`, source VET_VISIT, liée à la visite.
 * Idempotent : si une dépense existe déjà pour ce vetVisitId, ne fait rien.
 */
void recordVetVisitExpense(
    Long farmId, Long vetVisitId, String label, long amountXof,
    LocalDate date, Long productionUnitId, Long userId);

/** Réverse (soft-delete) la dépense liée à une visite supprimée. No-op si absente. */
void reverseVetVisitExpense(Long farmId, Long vetVisitId);
```

`FinanceFacadeImpl` :
- `recordVetVisitExpense` : si `findByFarmIdAndVetVisitId` présent → return ; sinon construit
  un `Expense` (`categoryKey = "veterinary"`, `source = VET_VISIT`, `vetVisitId`,
  `productionUnitId`, `amountXof`, `expenseDate = date`, `label`, `createdBy = userId`) et save.
- `reverseVetVisitExpense` : `findByFarmIdAndVetVisitId` → si présent, `expenseRepository.delete`
  (soft-delete via `@SQLDelete`).

**`VetVisitService`** — injection de `FinanceFacade` (constructeur, comme inventory) :

- `record(...)` : après `save`, si `cmd.costXof() != null && cmd.costXof() > 0` →
  `financeFacade.recordVetVisitExpense(unit.getFarmId(), saved.getId(),
   "Visite vétérinaire — " + cmd.reason(), cmd.costXof(), cmd.visitDate(), unitId, userId)`.
- `delete(id)` : résoudre la visite (déjà chargée via `get(id)`), récupérer
  `farmId = visit.getProductionUnit().getFarmId()`, appeler
  `financeFacade.reverseVetVisitExpense(farmId, id)` **avant** le delete de la visite
  (la FK `vet_visit_id` reste valide ; le soft-delete de la dépense ne dépend pas de la visite).

**Absence de cycle de beans :** `FinanceFacadeImpl` dépend de `LivestockFacade` +
`CommercialFacade` ; `VetVisitService` dépendra de `FinanceFacade`. Aucun cycle tant que les
impls de `LivestockFacade`/`CommercialFacade` ne dépendent pas de `VetVisitService` (ce n'est
pas le cas). Le boot des tests IT confirme.

### Anti-double-comptage

`record` est création-seule (pas d'`update`) → une visite = au plus une dépense.
`recordVetVisitExpense` est idempotent (garde sur `vetVisitId`). `delete` réverse.

---

## Tests (TDD)

**Feature 1 — backend**
- `FinanceAnalyticsService.farmAnalytics` : revenu = ventes + paiements livraison, **sans**
  double comptage d'une vente aussi facturée+payée ; marge = revenu − dépenses ;
  `expensesByCategory` agrégé + libellé ; `revenueByUnit` ne liste que les lots à revenu > 0.
- Requêtes repo : `SaleRepository.sumAllRevenue`, `InvoiceRepository.sumPaidFromDeliveries`,
  `ExpenseRepository.sumAll` / `sumByCategory` (slices `@DataJpaTest` Testcontainers).
- IT E2E : `GET .../finance/analytics` renvoie les bons totaux sur un jeu ventes + commande
  livrée+payée + dépenses.

**Feature 2 — backend**
- `FinanceFacadeImpl` : `recordVetVisitExpense` crée une dépense `veterinary`/`VET_VISIT`
  liée ; idempotent (2e appel = no-op) ; `reverseVetVisitExpense` soft-delete ; no-op si absente.
- `VetVisitService` : `record` avec `costXof > 0` → dépense créée ; `costXof` null/0 → aucune
  dépense ; `delete` → dépense réversée.
- IT E2E : POST visite avec coût → la dépense apparaît dans `GET .../finance/expenses` ;
  DELETE visite → dépense absente.

**Frontend**
- `FarmAnalyticsView` : rend les 3 KPIs, la marge colorée (vert/rouge), la ventilation
  dépenses, le tableau revenu par lot ; état vide.
- `analytique/page.tsx` : appelle `getFarmAnalytics`, plus de sélecteur de lot.

**Boot DB-less (footgun récurrent)** — vérifier que les **trois** contextes DB-less bootent
toujours après l'ajout de la dépendance `FinanceFacade` sur `VetVisitService` :
`SecurityE2ETest`, `SecurityIntegrationTest`, `DashboardControllerIT`. Aucun nouveau repo
n'est introduit (seule une méthode s'ajoute à `ExpenseRepository`, déjà mocké), donc pas de
nouveau `@MockitoBean` attendu — mais le boot doit être confirmé.

---

## Hors périmètre (V1)

- Filtre de période sur l'analytique globale (totaux cumulés seulement).
- Backfill des dépenses pour les visites véto **existantes** portant déjà un coût (seules les
  visites créées/supprimées après ce déploiement déclenchent le hook).
- Édition du coût d'une visite (pas de méthode `update` sur `VetVisitService`).
- Toute analyse de coûts **par lot** (les dépenses ne sont plus taguées par lot).

---

## Contraintes globales

- Aucune signature Claude/AI dans les commits ; Conventional Commits, scope bounded-context.
- Branch protection → PR + `gh pr merge --rebase --delete-branch`.
- Pas de cross-import entre bounded contexts — passer par les façades publiques
  (`CommercialFacade`, `FinanceFacade`, `LivestockFacade`), référencement par ID.
- Migrations Flyway immuables une fois **mergées** ; V28 est le prochain numéro libre.
- Money en `BIGINT` XOF (pas de décimales) ; soft-delete via `@SQLDelete`/`@SQLRestriction`.
- Services `@Service` + `@RequiredArgsConstructor` ; DTOs = records Java 21 ; AssertJ pour les tests.
- Spotless Google Java Format (`./mvnw -q spotless:apply -pl avicare-app`) avant commit backend.
- Les `*IT` Testcontainers ne tournent qu'en CI (Docker local indisponible) ; valider le reste
  en local, s'appuyer sur la CI verte pour les IT.
