# Clôture de bande et bilan de fin de cycle — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** permettre de clôturer une unité de production et figer son bilan de fin de cycle — technique et financier — pour que le gérant puisse enfin répondre à « est-ce que cette bande a été bonne ? ».

**Architecture:** un paquet `com.avicare.livestock.closure` qui lit trois sources déjà présentes dans livestock (ventes via `CommercialFacade`, consommations via `StockMovementRepository`, technique via `GrowthAnalysisService`) et une seule hors contexte (`FinanceFacade`, une méthode ajoutée). Le calcul est valorisé **à la clôture** puis figé dans une table `unit_closures`, une ligne par unité.

**Tech Stack:** Spring Boot 3.4 / Java 21, JPA + Flyway (PostgreSQL), JUnit 5 + Mockito + AssertJ, Testcontainers pour l'IT ; Next.js 16 + MUI v9 + RTK Query côté web.

**Spec:** `docs/superpowers/specs/2026-09-02-cloture-bande-bilan-design.md`

## Global Constraints

- **Commits sans aucune signature Claude** — pas de `Co-Authored-By`, pas de mention d'IA, pas d'emoji robot. Conventional Commits, scope par bounded context.
- **Branche** : `feat/cloture-bande`. Aucun push direct sur `main`. PR puis `gh pr merge --rebase --delete-branch`.
- **La tâche 1 part dans sa propre PR**, avant les autres (défaut de production visible aujourd'hui).
- **Argent en `BIGINT` XOF entier** (décision D6), jamais `NUMERIC(12,2)`.
- **Migration `V52__unit_closures.sql`** — numéro à revalider juste avant merge : il vaut pour l'ordre de merge, pas l'ordre du plan.
- **Une migration mergée ne se modifie jamais.**
- **Spotless** : `./mvnw spotless:apply -pl avicare-app` puis `spotless:check` **après** la dernière édition, jamais avant.
- **Gardes recopiées** de `ProductionUnitController` (décision D7) : lecture `poultry:read`, écriture OWNER/MANAGER.
- Services : `@Service` + `@RequiredArgsConstructor`. DTOs : records Java 21. Exceptions : héritent de `BusinessException`.
- **Testcontainers ne tourne pas sur ce Mac** (Docker 29 contre docker-java) : les IT sont validés en CI.

---

## Structure des fichiers

**Backend — créés**

| Fichier | Responsabilité |
|---|---|
| `db/migration/V52__unit_closures.sql` | la table figée |
| `livestock/closure/UnitClosure.java` | l'entité |
| `livestock/closure/UnitClosureRepository.java` | accès données |
| `livestock/closure/UnitCostService.java` | **la valorisation** — isolée pour être testable seule |
| `livestock/closure/UnitClosureService.java` | orchestration : calcule, fige, rouvre |
| `livestock/closure/UnitClosureController.java` | les trois endpoints |
| `livestock/closure/dto/CloseUnitRequest.java` | corps du POST |
| `livestock/closure/dto/UnitClosureResponse.java` | vue HTTP du bilan |

**Backend — modifiés**

| Fichier | Changement |
|---|---|
| `livestock/repository/LifecycleEventRepository.java` | `sumMortalityDelta` |
| `livestock/poultry/GrowthAnalysisService.java` | mortalité et IC cessent de confondre vente et perte |
| `finance/api/FinanceFacade.java` | `directExpensesForUnit` |
| `finance/service/FinanceFacadeImpl.java` | implémentation |
| `finance/repository/ExpenseRepository.java` | `sumDirectForUnit` |
| 6 contextes DB-less | `@MockitoBean UnitClosureRepository` |

**Web — créés**

| Fichier | Responsabilité |
|---|---|
| `store/api/closureApi.ts` | les trois endpoints |
| `components/poultry/CloseBatchDialog.tsx` | dialogue de clôture |
| `components/poultry/BatchClosureTab.tsx` | le bilan figé |

**Web — modifiés** : `store/api/baseApi.ts` (tag `UnitClosure`), `components/poultry/PoultryBatchDetailView.tsx` (bouton + onglet), `types/index.ts`.

---

## Task 1 : les compteurs cessent de confondre vente et perte

> **PR séparée**, mergée avant le reste. Corrige un chiffre faux en production.

**Files:**
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/repository/LifecycleEventRepository.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/poultry/GrowthAnalysisService.java:47-50, 264, et la méthode `mortalityPercent``
- Test: `backend/avicare-app/src/test/java/com/avicare/livestock/poultry/GrowthAnalysisMortalityTest.java` (créer)

**Interfaces:**
- Produces: `LifecycleEventRepository.sumMortalityDelta(Long unitId) -> long` (somme négative ou 0)

**Contexte pour l'implémenteur.** `recordEvent` décrémente `current_count` pour tout delta négatif, `EVENT_SALE` compris. `mortalityPercent` calcule `initial - currentCount`, donc chaque sujet vendu passe pour un mort. `fcr` souffre du même mal : son dénominateur `batch.getCurrentCount()` rétrécit à chaque vente, ce qui gonfle l'indice de consommation.

- [ ] **Step 1 : écrire le test qui échoue**

Créer `GrowthAnalysisMortalityTest.java` :

```java
package com.avicare.livestock.poultry;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

import com.avicare.livestock.domain.GrowthPerformance;
import com.avicare.livestock.domain.PoultryBatch;
import com.avicare.livestock.domain.WeighingSample;
import com.avicare.livestock.repository.DailyRecordRepository;
import com.avicare.livestock.repository.GrowthPerformanceRepository;
import com.avicare.livestock.repository.LifecycleEventRepository;
import com.avicare.livestock.repository.PoultryBatchRepository;
import com.avicare.livestock.repository.WeighingSampleRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.ObjectProvider;

/**
 * Les ventes décrémentent current_count comme les morts : la mortalité et l'IC doivent
 * lire le registre des événements MORTALITY, pas l'écart entre effectif initial et actuel.
 */
class GrowthAnalysisMortalityTest {

  private WeighingSampleRepository weighingSampleRepository;
  private GrowthPerformanceRepository growthPerformanceRepository;
  private PoultryBatchRepository poultryBatchRepository;
  private DailyRecordRepository dailyRecordRepository;
  private LifecycleEventRepository lifecycleEventRepository;
  private GrowthAnalysisService service;

  @BeforeEach
  void setUp() {
    weighingSampleRepository = Mockito.mock(WeighingSampleRepository.class);
    growthPerformanceRepository = Mockito.mock(GrowthPerformanceRepository.class);
    poultryBatchRepository = Mockito.mock(PoultryBatchRepository.class);
    dailyRecordRepository = Mockito.mock(DailyRecordRepository.class);
    lifecycleEventRepository = Mockito.mock(LifecycleEventRepository.class);
    @SuppressWarnings("unchecked")
    ObjectProvider<GrowthAnalysisService> self = Mockito.mock(ObjectProvider.class);
    service =
        new GrowthAnalysisService(
            weighingSampleRepository,
            growthPerformanceRepository,
            poultryBatchRepository,
            dailyRecordRepository,
            lifecycleEventRepository,
            self);

    lenient()
        .when(growthPerformanceRepository.findByPoultryBatchIdAndSnapshotDate(anyLong(), any()))
        .thenReturn(Optional.empty());
    lenient()
        .when(growthPerformanceRepository.save(any(GrowthPerformance.class)))
        .thenAnswer(inv -> inv.getArgument(0));
    lenient()
        .when(weighingSampleRepository.findFirstByPoultryBatchIdOrderBySampleDateDesc(anyLong()))
        .thenReturn(Optional.empty());
    lenient().when(dailyRecordRepository.sumFeedKgUpTo(anyLong(), any())).thenReturn(BigDecimal.ZERO);
    lenient().when(dailyRecordRepository.sumWaterLUpTo(anyLong(), any())).thenReturn(BigDecimal.ZERO);
  }

  private PoultryBatch batch(int initialCount, int currentCount) {
    PoultryBatch b = new PoultryBatch();
    b.setId(1L);
    b.setInitialCount(initialCount);
    b.setCurrentCount(currentCount);
    b.setStartDate(LocalDate.now().minusDays(30));
    when(poultryBatchRepository.findById(1L)).thenReturn(Optional.of(b));
    return b;
  }

  @Test
  void mortality_countsOnlyMortalityEvents_notSales() {
    // 1000 placés, 20 morts, 800 vendus → il en reste 180.
    batch(1000, 180);
    when(lifecycleEventRepository.sumMortalityDelta(1L)).thenReturn(-20L);

    GrowthPerformance perf = service.computePerformance(1L, LocalDate.now());

    // Avant le correctif : (1000 - 180) / 1000 = 82,00 %.
    assertThat(perf.getCumulativeMortalityPercent()).isEqualByComparingTo("2.00");
  }

  @Test
  void mortality_isZero_whenNoMortalityEventRecorded() {
    batch(500, 500);
    when(lifecycleEventRepository.sumMortalityDelta(1L)).thenReturn(0L);

    GrowthPerformance perf = service.computePerformance(1L, LocalDate.now());

    assertThat(perf.getCumulativeMortalityPercent()).isEqualByComparingTo("0.00");
  }

  @Test
  void mortality_isNull_whenInitialCountIsZero() {
    batch(0, 0);
    lenient().when(lifecycleEventRepository.sumMortalityDelta(1L)).thenReturn(0L);

    GrowthPerformance perf = service.computePerformance(1L, LocalDate.now());

    assertThat(perf.getCumulativeMortalityPercent()).isNull();
  }

  @Test
  void fcr_usesLiveBirdsProduced_notRemainingHeadcount() {
    // 1000 placés, 20 morts → 980 sujets produits, pesés 2000 g, 3920 kg d'aliment.
    // IC attendu = 3920 / (980 × 2,0 kg) = 2,000.
    batch(1000, 180);
    when(lifecycleEventRepository.sumMortalityDelta(1L)).thenReturn(-20L);
    when(weighingSampleRepository.findFirstByPoultryBatchIdOrderBySampleDateDesc(1L))
        .thenReturn(Optional.of(weighing(new BigDecimal("2000"))));
    when(dailyRecordRepository.sumFeedKgUpTo(anyLong(), any()))
        .thenReturn(new BigDecimal("3920"));

    GrowthPerformance perf = service.computePerformance(1L, LocalDate.now());

    // Avant le correctif : 3920 / (180 × 2,0) = 10,889.
    assertThat(perf.getFeedConversionRatio()).isEqualByComparingTo("2.000");
  }

  private static WeighingSample weighing(BigDecimal avgWeightG) {
    WeighingSample s = new WeighingSample();
    s.setAvgWeightG(avgWeightG);
    return s;
  }
}
```

- [ ] **Step 2 : lancer le test, vérifier qu'il échoue**

```bash
cd backend && ./mvnw test -pl avicare-app -Dtest=GrowthAnalysisMortalityTest
```

Attendu : échec de compilation (`GrowthAnalysisService` n'a pas encore ce constructeur, `sumMortalityDelta` n'existe pas).

- [ ] **Step 3 : ajouter la requête au repository**

Dans `LifecycleEventRepository`, après `findByProductionUnitIdAndEventType` :

```java
  /**
   * Somme des deltas des événements {@code MORTALITY} d'une unité — négative, ou 0 si aucune
   * mort. Les ventes ({@code EVENT_SALE}) décrémentent {@code current_count} au même titre que
   * les morts : compter « initial − current » ferait passer chaque sujet vendu pour un mort.
   */
  @Query(
      "SELECT COALESCE(SUM(e.quantityDelta), 0) FROM LifecycleEvent e "
          + "WHERE e.productionUnitId = :unitId AND e.eventType = 'MORTALITY'")
  long sumMortalityDelta(@Param("unitId") Long unitId);
```

- [ ] **Step 4 : corriger le service**

Dans `GrowthAnalysisService`, ajouter le champ après `dailyRecordRepository` :

```java
  private final LifecycleEventRepository lifecycleEventRepository;
```

(l'import : `com.avicare.livestock.repository.LifecycleEventRepository`)

Remplacer `mortalityPercent` — elle cesse d'être `static` :

```java
  /** Morts réelles / effectif initial. Lit le registre MORTALITY : une vente n'est pas une perte. */
  private BigDecimal mortalityPercent(PoultryBatch batch) {
    int initial = batch.getInitialCount();
    if (initial <= 0) {
      return null;
    }
    long deaths = -lifecycleEventRepository.sumMortalityDelta(batch.getId());
    return scaled(deaths * 100.0 / initial, 2);
  }
```

Remplacer l'appel à `fcr` dans `computePerformance` :

```java
    long liveBirds = batch.getInitialCount() + lifecycleEventRepository.sumMortalityDelta(batchId);
    perf.setFeedConversionRatio(fcr(cumulativeFeedKg, currentWeightG, (int) liveBirds));
```

`sumMortalityDelta` étant négative, l'addition retranche bien les morts. Le dénominateur devient le nombre de sujets produits vivants, et non ce qu'il en reste en stock.

- [ ] **Step 5 : lancer le test, vérifier qu'il passe**

```bash
cd backend && ./mvnw test -pl avicare-app -Dtest=GrowthAnalysisMortalityTest
```

Attendu : 4 tests verts.

- [ ] **Step 6 : vérifier que rien d'autre ne casse**

```bash
cd backend && ./mvnw clean test -pl avicare-app
```

`LivestockServiceTest` et `GrowthAnalysisServiceTest` (s'il existe) peuvent nécessiter le nouveau paramètre de constructeur : ajouter `Mockito.mock(LifecycleEventRepository.class)` dans leur `setUp`.

- [ ] **Step 7 : formater puis commiter**

```bash
cd backend && ./mvnw spotless:apply -pl avicare-app && ./mvnw spotless:check -pl avicare-app
cd .. && git add -A && git commit -m "fix(backend:livestock): stop counting sold birds as dead

recordEvent decrements current_count for every negative delta, EVENT_SALE
included, so mortalityPercent (initial - currentCount) reported a batch that
sold 80% of its birds as 80% mortality. The FCR denominator had the same
flaw: currentCount shrinks with each sale, inflating the ratio.

Both now read the MORTALITY event ledger. Mortality counts real deaths;
the FCR denominator is the number of birds produced alive.

GrowthAnalysisMortalityTest covers 4 scenarios."
```

---

## Task 2 : les dépenses directes d'une unité, via la facade finance

**Files:**
- Modify: `backend/avicare-app/src/main/java/com/avicare/finance/repository/ExpenseRepository.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/finance/api/FinanceFacade.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/finance/service/FinanceFacadeImpl.java`
- Test: `backend/avicare-app/src/test/java/com/avicare/finance/service/FinanceFacadeUnitExpensesTest.java` (créer)

**Interfaces:**
- Produces: `FinanceFacade.directExpensesForUnit(Long farmId, Long productionUnitId) -> long`
- Produces: `ExpenseRepository.sumDirectForUnit(Long farmId, Long unitId) -> long`

**Contexte.** `FinanceFacadeImpl` a **déjà** `ExpenseRepository` en dépendance : n'y ajoutez aucun bean. Élargir le graphe d'une facade casse les slices `@DataJpaTest` qui l'importent — vert en local, rouge en CI Testcontainers. La source `STOCK_ENTRY` est exclue parce que cette dépense est déjà comptée à l'entrée en stock ; la compter aussi au titre du lot doublerait l'aliment.

- [ ] **Step 1 : écrire le test qui échoue**

```java
package com.avicare.finance.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.avicare.finance.repository.ExpenseRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

/** La facade relaie la somme des dépenses directes d'une unité, hors STOCK_ENTRY. */
class FinanceFacadeUnitExpensesTest {

  private ExpenseRepository expenseRepository;
  private FinanceFacadeImpl facade;

  @BeforeEach
  void setUp() {
    expenseRepository = Mockito.mock(ExpenseRepository.class);
    FinanceAnalyticsService analyticsService = Mockito.mock(FinanceAnalyticsService.class);
    facade = new FinanceFacadeImpl(expenseRepository, analyticsService);
  }

  @Test
  void directExpensesForUnit_relaysTheRepositorySum() {
    when(expenseRepository.sumDirectForUnit(7L, 42L)).thenReturn(125_000L);

    assertThat(facade.directExpensesForUnit(7L, 42L)).isEqualTo(125_000L);
  }

  @Test
  void directExpensesForUnit_isZero_whenNothingAttributed() {
    when(expenseRepository.sumDirectForUnit(7L, 42L)).thenReturn(0L);

    assertThat(facade.directExpensesForUnit(7L, 42L)).isZero();
  }
}
```

> Si le constructeur de `FinanceFacadeImpl` porte d'autres paramètres, adaptez l'appel — mais **n'en ajoutez aucun**.

- [ ] **Step 2 : lancer le test, vérifier qu'il échoue**

```bash
cd backend && ./mvnw test -pl avicare-app -Dtest=FinanceFacadeUnitExpensesTest
```

Attendu : échec de compilation (`sumDirectForUnit` et `directExpensesForUnit` n'existent pas).

- [ ] **Step 3 : ajouter la requête**

Dans `ExpenseRepository` :

```java
  /**
   * Σ des dépenses rattachées à une unité de production, hors source {@code STOCK_ENTRY} : cette
   * dernière est déjà comptée à l'entrée en stock (anti-double-comptage V25), la recompter au
   * titre du lot doublerait l'aliment.
   */
  @Query(
      "SELECT COALESCE(SUM(e.amountXof), 0) FROM Expense e "
          + "WHERE e.farmId = :farmId AND e.productionUnitId = :unitId "
          + "AND e.deletedAt IS NULL AND e.source <> com.avicare.finance.domain.ExpenseSource.STOCK_ENTRY")
  long sumDirectForUnit(@Param("farmId") Long farmId, @Param("unitId") Long unitId);
```

> Vérifiez le nom du champ de soft delete sur `Expense` (`deletedAt`) et celui de la source (`source`) avant de compiler ; l'entité est dans `finance/domain/Expense.java`. Si `Expense` porte `@SQLRestriction("deleted_at IS NULL")`, la clause `e.deletedAt IS NULL` est redondante mais inoffensive — gardez-la explicite.

- [ ] **Step 4 : ajouter la méthode à la facade**

Dans `FinanceFacade`, avant `farmPnl` :

```java
  /**
   * Σ des dépenses directement rattachées à une unité de production, hors source {@code
   * STOCK_ENTRY} (déjà comptée à l'entrée en stock). Sert le bilan de fin de bande.
   */
  long directExpensesForUnit(Long farmId, Long productionUnitId);
```

Dans `FinanceFacadeImpl` :

```java
  @Override
  @Transactional(readOnly = true)
  public long directExpensesForUnit(Long farmId, Long productionUnitId) {
    return expenseRepository.sumDirectForUnit(farmId, productionUnitId);
  }
```

- [ ] **Step 5 : lancer le test, vérifier qu'il passe**

```bash
cd backend && ./mvnw test -pl avicare-app -Dtest=FinanceFacadeUnitExpensesTest
```

Attendu : 2 tests verts.

- [ ] **Step 6 : commiter**

```bash
cd backend && ./mvnw spotless:apply -pl avicare-app && ./mvnw spotless:check -pl avicare-app
cd .. && git add -A && git commit -m "feat(backend:finance): expose per-unit direct expenses on the facade

directExpensesForUnit sums the expenses attributed to a production unit,
excluding STOCK_ENTRY — already counted when the stock came in, so counting
it again against the batch would double the feed.

No new bean enters the facade's dependency graph: FinanceFacadeImpl already
holds ExpenseRepository."
```

---

## Task 3 : la table figée, l'entité, le repository

**Files:**
- Create: `backend/avicare-app/src/main/resources/db/migration/V52__unit_closures.sql`
- Create: `backend/avicare-app/src/main/java/com/avicare/livestock/closure/UnitClosure.java`
- Create: `backend/avicare-app/src/main/java/com/avicare/livestock/closure/UnitClosureRepository.java`
- Modify: les 6 contextes DB-less

**Interfaces:**
- Produces: entité `UnitClosure` (getters/setters Lombok), `UnitClosureRepository.findByProductionUnitId(Long) -> Optional<UnitClosure>`

- [ ] **Step 1 : écrire la migration**

`V52__unit_closures.sql` :

```sql
-- V52 — Bilan de fin de cycle figé (une ligne par unité clôturée).
-- Figé et non recalculé : une dépense saisie après coup ne doit pas réécrire un
-- résultat passé. Pas de deleted_at : rouvrir une unité supprime la ligne.
-- Montants en BIGINT XOF entiers, comme expenses.amount_xof et sale_items.

CREATE TABLE unit_closures (
    id                    BIGSERIAL PRIMARY KEY,
    production_unit_id    BIGINT NOT NULL UNIQUE REFERENCES production_units(id) ON DELETE CASCADE,
    farm_id               BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    closed_at             TIMESTAMP NOT NULL,
    closed_by             BIGINT REFERENCES users(id),

    start_date            DATE NOT NULL,
    end_date              DATE NOT NULL,
    duration_days         INTEGER NOT NULL CHECK (duration_days >= 0),

    initial_count         INTEGER NOT NULL,
    remaining_count       INTEGER NOT NULL,
    deaths                INTEGER NOT NULL CHECK (deaths >= 0),
    mortality_percent     NUMERIC(5,2),

    -- Technique : nullable, renseigné pour la volaille de chair.
    exit_weight_g         NUMERIC(10,2),
    avg_daily_gain_g      NUMERIC(10,2),
    total_feed_kg         NUMERIC(14,3),
    feed_conversion_ratio NUMERIC(6,3),

    -- Argent (XOF entiers).
    revenue_xof           BIGINT NOT NULL DEFAULT 0,
    feed_cost_xof         BIGINT NOT NULL DEFAULT 0,
    chick_cost_xof        BIGINT NOT NULL DEFAULT 0,
    other_expense_xof     BIGINT NOT NULL DEFAULT 0,
    total_cost_xof        BIGINT NOT NULL DEFAULT 0,
    margin_xof            BIGINT NOT NULL DEFAULT 0,
    cost_per_kg_xof       INTEGER,

    -- Couverture de valorisation : sans elle, le bilan ment par omission.
    consumed_articles     INTEGER NOT NULL DEFAULT 0,
    valued_articles       INTEGER NOT NULL DEFAULT 0,

    notes                 TEXT,
    created_at            TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_unit_closures_farm ON unit_closures(farm_id);

CREATE TRIGGER trg_unit_closures_updated_at
    BEFORE UPDATE ON unit_closures
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

- [ ] **Step 2 : valider la migration sur une base réelle, sans la garder**

```bash
docker exec -i avicare-postgres psql -U avicare -d avicare <<'SQL'
BEGIN;
\i /dev/stdin
ROLLBACK;
SQL
```

Si le montage de fichier n'est pas commode, coller le contenu entre `BEGIN;` et `ROLLBACK;`. Attendu : `CREATE TABLE`, `CREATE INDEX`, `CREATE TRIGGER`, puis `ROLLBACK`. Postgres local sur le **port 5434**.

- [ ] **Step 3 : écrire l'entité**

`UnitClosure.java` — `@Entity`, `@Table(name = "unit_closures")`, `@Getter @Setter @NoArgsConstructor`, `@Id @GeneratedValue(strategy = GenerationType.IDENTITY)`. Un champ par colonne, en camelCase, `@Column(name = "...")` explicite. `createdAt` et `updatedAt` en lecture seule (`insertable = false, updatable = false`) : le trigger les gère. Types : `Long` pour les ids et les XOF, `Integer` pour les compteurs et `costPerKgXof`, `BigDecimal` pour `mortalityPercent`, `exitWeightG`, `avgDailyGainG`, `totalFeedKg`, `feedConversionRatio`, `LocalDate` pour les dates, `LocalDateTime` pour `closedAt`.

Pas de `@SQLDelete` ni de `@SQLRestriction` : cette table n'a pas de soft delete.

- [ ] **Step 4 : écrire le repository**

```java
package com.avicare.livestock.closure;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/** Accès aux bilans de fin de cycle. Une ligne au plus par unité de production. */
public interface UnitClosureRepository extends JpaRepository<UnitClosure, Long> {

  Optional<UnitClosure> findByProductionUnitId(Long productionUnitId);

  void deleteByProductionUnitId(Long productionUnitId);
}
```

- [ ] **Step 5 : déclarer le repository dans les contextes sans base**

Trouver les fichiers concernés — **ne pas se fier au nombre, il est passé de 2 à 6** :

```bash
grep -rln "FarmRepository" backend/avicare-app/src/test/java | xargs grep -l "@SpringBootTest"
```

Dans chacun, ajouter à côté des autres `@MockitoBean` :

```java
  @MockitoBean private com.avicare.livestock.closure.UnitClosureRepository unitClosureRepository;
```

- [ ] **Step 6 : vérifier que les contextes démarrent toujours**

```bash
cd backend && ./mvnw clean test -pl avicare-app
```

Attendu : vert. Un `UnsatisfiedDependencyException` signale un contexte oublié à l'étape 5.

- [ ] **Step 7 : commiter**

```bash
cd backend && ./mvnw spotless:apply -pl avicare-app && ./mvnw spotless:check -pl avicare-app
cd .. && git add -A && git commit -m "feat(backend:livestock): add the frozen unit-closure record

V52 unit_closures: one row per closed production unit, never recomputed.
No deleted_at — reopening a unit removes the row outright.

Carries the valuation coverage (consumed_articles / valued_articles) so the
report can say what it could not price rather than quietly reporting zero."
```

---

## Task 4 : `UnitCostService` — la valorisation

**Files:**
- Create: `backend/avicare-app/src/main/java/com/avicare/livestock/closure/UnitCostService.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/repository/StockMovementRepository.java`
- Test: `backend/avicare-app/src/test/java/com/avicare/livestock/closure/UnitCostServiceTest.java` (créer)

**Interfaces:**
- Produces: `record FeedCost(long costXof, int consumedArticles, int valuedArticles)`
- Produces: `UnitCostService.feedCost(Long unitId) -> FeedCost`

**Contexte.** C'est ici qu'est le risque du chantier. `stock_items.typical_unit_price_xof` est **nullable** : un article sans prix pèse zéro, et le bilan flatte sans le dire. D'où le comptage des articles valorisés. On lit `m.totalValueXof` en priorité — nulle aujourd'hui sur toutes les consommations, mais renseignée si un jour les sorties sont valorisées : le calcul deviendra exact sans réécriture.

- [ ] **Step 1 : écrire le test qui échoue**

```java
package com.avicare.livestock.closure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.avicare.livestock.domain.MovementType;
import com.avicare.livestock.domain.StockItem;
import com.avicare.livestock.domain.StockMovement;
import com.avicare.livestock.repository.StockMovementRepository;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

/** Valorisation des sorties de stock d'un lot, et honnêteté sur ce qui n'a pas pu être valorisé. */
class UnitCostServiceTest {

  private StockMovementRepository stockMovementRepository;
  private UnitCostService service;

  @BeforeEach
  void setUp() {
    stockMovementRepository = Mockito.mock(StockMovementRepository.class);
    service = new UnitCostService(stockMovementRepository);
  }

  private static StockItem item(long id, Integer priceXof) {
    StockItem i = new StockItem();
    i.setId(id);
    i.setTypicalUnitPriceXof(priceXof);
    return i;
  }

  private static StockMovement out(StockItem item, String qty, Long totalValueXof) {
    StockMovement m = new StockMovement();
    m.setStockItem(item);
    m.setMovementType(MovementType.OUT);
    m.setQuantity(new BigDecimal(qty));
    m.setTotalValueXof(totalValueXof);
    return m;
  }

  @Test
  void valuesConsumption_atTheArticlePrice() {
    StockItem feed = item(1L, 400); // 400 F le kg
    when(stockMovementRepository.findOutMovementsForUnit(42L))
        .thenReturn(List.of(out(feed, "150", null), out(feed, "50", null)));

    UnitCostService.FeedCost cost = service.feedCost(42L);

    assertThat(cost.costXof()).isEqualTo(80_000L); // 200 kg × 400
    assertThat(cost.consumedArticles()).isEqualTo(1);
    assertThat(cost.valuedArticles()).isEqualTo(1);
  }

  @Test
  void articleWithoutPrice_countsAsUnvalued_andAddsNothing() {
    StockItem feed = item(1L, 400);
    StockItem maize = item(2L, null); // jamais tarifé
    when(stockMovementRepository.findOutMovementsForUnit(42L))
        .thenReturn(List.of(out(feed, "100", null), out(maize, "300", null)));

    UnitCostService.FeedCost cost = service.feedCost(42L);

    assertThat(cost.costXof()).isEqualTo(40_000L);
    assertThat(cost.consumedArticles()).isEqualTo(2);
    assertThat(cost.valuedArticles()).isEqualTo(1); // le bilan devra le signaler
  }

  @Test
  void movementCarryingItsOwnValue_winsOverTheArticlePrice() {
    StockItem feed = item(1L, 400);
    when(stockMovementRepository.findOutMovementsForUnit(42L))
        .thenReturn(List.of(out(feed, "100", 35_000L))); // sortie déjà valorisée à 350 F

    UnitCostService.FeedCost cost = service.feedCost(42L);

    assertThat(cost.costXof()).isEqualTo(35_000L);
    assertThat(cost.valuedArticles()).isEqualTo(1);
  }

  @Test
  void noConsumption_yieldsZeroAndEmptyCoverage() {
    when(stockMovementRepository.findOutMovementsForUnit(42L)).thenReturn(List.of());

    UnitCostService.FeedCost cost = service.feedCost(42L);

    assertThat(cost.costXof()).isZero();
    assertThat(cost.consumedArticles()).isZero();
    assertThat(cost.valuedArticles()).isZero();
  }

  @Test
  void sameArticleValuedOnce_andUnvaluedOnce_countsAsValued() {
    StockItem feed = item(1L, null);
    when(stockMovementRepository.findOutMovementsForUnit(42L))
        .thenReturn(List.of(out(feed, "100", 20_000L), out(feed, "50", null)));

    UnitCostService.FeedCost cost = service.feedCost(42L);

    assertThat(cost.costXof()).isEqualTo(20_000L);
    assertThat(cost.consumedArticles()).isEqualTo(1);
    assertThat(cost.valuedArticles()).isEqualTo(1);
  }
}
```

- [ ] **Step 2 : lancer le test, vérifier qu'il échoue**

```bash
cd backend && ./mvnw test -pl avicare-app -Dtest=UnitCostServiceTest
```

Attendu : échec de compilation.

- [ ] **Step 3 : ajouter la requête au repository**

Dans `StockMovementRepository` :

```java
  /**
   * Sorties de stock rattachées à une unité de production, article chargé — c'est la matière
   * du coût de la bande. {@code JOIN FETCH} pour éviter un N+1 sur {@code stockItem}.
   */
  @Query(
      "SELECT m FROM StockMovement m JOIN FETCH m.stockItem "
          + "WHERE m.productionUnitId = :unitId AND m.movementType = "
          + "com.avicare.livestock.domain.MovementType.OUT")
  List<StockMovement> findOutMovementsForUnit(@Param("unitId") Long unitId);
```

- [ ] **Step 4 : écrire le service**

```java
package com.avicare.livestock.closure;

import com.avicare.livestock.domain.StockMovement;
import com.avicare.livestock.repository.StockMovementRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Valorise ce qu'une unité de production a consommé (décision D1 : à la clôture, pas à la
 * sortie). Rend aussi la couverture de valorisation : un article sans prix pèse zéro dans le
 * total, et un bilan qui tairait cela flatterait toujours dans le même sens.
 */
@Service
@RequiredArgsConstructor
public class UnitCostService {

  private final StockMovementRepository stockMovementRepository;

  /**
   * @param costXof total valorisé, en XOF entiers
   * @param consumedArticles nombre d'articles distincts sortis vers l'unité
   * @param valuedArticles ceux dont on a su donner un prix
   */
  public record FeedCost(long costXof, int consumedArticles, int valuedArticles) {}

  @Transactional(readOnly = true)
  public FeedCost feedCost(Long productionUnitId) {
    List<StockMovement> movements =
        stockMovementRepository.findOutMovementsForUnit(productionUnitId);

    long total = 0;
    Set<Long> consumed = new HashSet<>();
    Set<Long> valued = new HashSet<>();

    for (StockMovement m : movements) {
      Long itemId = m.getStockItem().getId();
      consumed.add(itemId);

      Long value = valueOf(m);
      if (value != null) {
        total += value;
        valued.add(itemId);
      }
    }
    return new FeedCost(total, consumed.size(), valued.size());
  }

  /**
   * Valeur d'une sortie : celle portée par le mouvement si elle existe — aujourd'hui nulle sur
   * toute consommation, mais renseignée le jour où les sorties seront valorisées — sinon
   * quantité × prix de l'article. {@code null} quand aucun prix n'est connu.
   */
  private static Long valueOf(StockMovement m) {
    if (m.getTotalValueXof() != null) {
      return m.getTotalValueXof();
    }
    Integer unitPrice = m.getStockItem().getTypicalUnitPriceXof();
    if (unitPrice == null) {
      return null;
    }
    return m.getQuantity()
        .multiply(BigDecimal.valueOf(unitPrice))
        .setScale(0, RoundingMode.HALF_UP)
        .longValue();
  }
}
```

- [ ] **Step 5 : lancer le test, vérifier qu'il passe**

```bash
cd backend && ./mvnw test -pl avicare-app -Dtest=UnitCostServiceTest
```

Attendu : 5 tests verts.

- [ ] **Step 6 : commiter**

```bash
cd backend && ./mvnw spotless:apply -pl avicare-app && ./mvnw spotless:check -pl avicare-app
cd .. && git add -A && git commit -m "feat(backend:livestock): value a unit's stock consumption

feedCost prices the OUT movements of a production unit at closing time: the
movement's own value when it carries one, the article's typical price
otherwise. Feed leaves stock in kilos and never in XOF today, so this is the
only way to reach a per-batch cost without touching the daily write path.

Returns the valuation coverage alongside the total. An article with no price
adds nothing, and a report that hid that would always flatter."
```

---

## Task 5 : `UnitClosureService` — calculer, figer, rouvrir

**Files:**
- Create: `backend/avicare-app/src/main/java/com/avicare/livestock/closure/UnitClosureService.java`
- Test: `backend/avicare-app/src/test/java/com/avicare/livestock/closure/UnitClosureServiceTest.java` (créer)

**Interfaces:**
- Consumes: `UnitCostService.feedCost`, `FinanceFacade.directExpensesForUnit`, `CommercialFacade.revenueByProductionUnit`, `LifecycleEventRepository.sumMortalityDelta` et `sumInitialCountByUnit`, `LivestockService.closeUnit`, `GrowthAnalysisService.computePerformance`
- Produces: `close(Long farmId, Long unitId, Long chickCostXof, String notes, Long userId) -> UnitClosure`, `get(Long farmId, Long unitId) -> UnitClosure`, `reopen(Long farmId, Long unitId)`

**Contexte.** `ProductionUnit` ne porte **pas** d'effectif initial : il vient de l'événement `CREATED`, via `lifecycleEventRepository.sumInitialCountByUnit(unitId)` — générique, valable aussi pour les pondeuses. La technique vient du dernier `GrowthPerformance` : appelez `growthAnalysisService.computePerformance(unitId, LocalDate.now())` pour en obtenir un à jour, et acceptez ses champs nuls (un lot jamais pesé n'a pas de poids de sortie).

- [ ] **Step 1 : écrire le test qui échoue**

```java
package com.avicare.livestock.closure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.common.api.exception.ConflictException;
import com.avicare.common.api.exception.NotFoundException;
import com.avicare.finance.api.FinanceFacade;
import com.avicare.livestock.commercial.CommercialFacade;
import com.avicare.livestock.domain.GrowthPerformance;
import com.avicare.livestock.domain.ProductionUnit;
import com.avicare.livestock.poultry.GrowthAnalysisService;
import com.avicare.livestock.repository.LifecycleEventRepository;
import com.avicare.livestock.repository.ProductionUnitRepository;
import com.avicare.livestock.service.LivestockService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

/**
 * Le bilan agrège quatre sources et se fige. Ce test verrouille l'arithmétique et les deux
 * règles de cycle de vie : on ne clôture pas deux fois, rouvrir efface.
 */
class UnitClosureServiceTest {

  private UnitClosureRepository unitClosureRepository;
  private UnitCostService unitCostService;
  private ProductionUnitRepository productionUnitRepository;
  private LifecycleEventRepository lifecycleEventRepository;
  private GrowthAnalysisService growthAnalysisService;
  private LivestockService livestockService;
  private CommercialFacade commercialFacade;
  private FinanceFacade financeFacade;
  private UnitClosureService service;

  @BeforeEach
  void setUp() {
    unitClosureRepository = Mockito.mock(UnitClosureRepository.class);
    unitCostService = Mockito.mock(UnitCostService.class);
    productionUnitRepository = Mockito.mock(ProductionUnitRepository.class);
    lifecycleEventRepository = Mockito.mock(LifecycleEventRepository.class);
    growthAnalysisService = Mockito.mock(GrowthAnalysisService.class);
    livestockService = Mockito.mock(LivestockService.class);
    commercialFacade = Mockito.mock(CommercialFacade.class);
    financeFacade = Mockito.mock(FinanceFacade.class);
    service =
        new UnitClosureService(
            unitClosureRepository,
            unitCostService,
            productionUnitRepository,
            lifecycleEventRepository,
            growthAnalysisService,
            livestockService,
            commercialFacade,
            financeFacade);

    // Le lot de référence : 1000 placés, 20 morts, 180 restants, pesé à 2000 g.
    ProductionUnit unit = new ProductionUnit();
    unit.setId(42L);
    unit.setFarmId(7L);
    unit.setCurrentCount(180);
    unit.setStartDate(LocalDate.now().minusDays(45));
    lenient().when(productionUnitRepository.findById(42L)).thenReturn(Optional.of(unit));

    lenient().when(unitClosureRepository.findByProductionUnitId(42L)).thenReturn(Optional.empty());
    lenient().when(unitClosureRepository.save(any(UnitClosure.class)))
        .thenAnswer(inv -> inv.getArgument(0));
    lenient().when(lifecycleEventRepository.sumInitialCountByUnit(42L)).thenReturn(1000L);
    lenient().when(lifecycleEventRepository.sumMortalityDelta(42L)).thenReturn(-20L);
    lenient().when(commercialFacade.revenueByProductionUnit(7L, 42L)).thenReturn(1_800_000L);
    lenient().when(unitCostService.feedCost(42L))
        .thenReturn(new UnitCostService.FeedCost(900_000L, 1, 1));
    lenient().when(financeFacade.directExpensesForUnit(7L, 42L)).thenReturn(90_000L);

    GrowthPerformance perf = new GrowthPerformance();
    perf.setCurrentWeightG(new BigDecimal("2000"));
    perf.setGmqGPerDay(new BigDecimal("44.44"));
    perf.setCumulativeFeedKg(new BigDecimal("2250"));
    perf.setFeedConversionRatio(new BigDecimal("1.148"));
    lenient().when(growthAnalysisService.computePerformance(anyLong(), any())).thenReturn(perf);
  }

  /** Un lot jamais pesé : la performance existe, mais sans poids. */
  private static GrowthPerformance performanceWithoutWeight() {
    return new GrowthPerformance();
  }

  @Test
  void close_freezesRevenueMinusCosts() {
    // recettes 1 800 000 ; aliment 900 000 ; poussins 250 000 ; autres 90 000
    // → coût total 1 240 000, marge 560 000
    // 1000 placés, 20 morts → 980 vivants ; poids de sortie 2000 g → 1960 kg
    // → coût au kilo = 1 240 000 / 1960 = 632 F
    UnitClosure closure = service.close(7L, 42L, 250_000L, null, 3L);

    assertThat(closure.getRevenueXof()).isEqualTo(1_800_000L);
    assertThat(closure.getTotalCostXof()).isEqualTo(1_240_000L);
    assertThat(closure.getMarginXof()).isEqualTo(560_000L);
    assertThat(closure.getDeaths()).isEqualTo(20);
    assertThat(closure.getCostPerKgXof()).isEqualTo(632);
  }

  @Test
  void close_marksTheUnitClosed() {
    service.close(7L, 42L, null, null, 3L);
    verify(livestockService).closeUnit(42L);
  }

  @Test
  void close_rejectsAnAlreadyClosedUnit() {
    when(unitClosureRepository.findByProductionUnitId(42L)).thenReturn(Optional.of(new UnitClosure()));

    assertThatThrownBy(() -> service.close(7L, 42L, null, null, 3L))
        .isInstanceOf(ConflictException.class)
        .hasMessageContaining("already closed");
    verify(unitClosureRepository, never()).save(any());
  }

  @Test
  void close_withoutChickCost_countsItAsZero() {
    UnitClosure closure = service.close(7L, 42L, null, null, 3L);
    assertThat(closure.getChickCostXof()).isZero();
  }

  @Test
  void close_leavesCostPerKgNull_whenNoWeighingEverRecorded() {
    when(growthAnalysisService.computePerformance(anyLong(), any()))
        .thenReturn(performanceWithoutWeight());

    UnitClosure closure = service.close(7L, 42L, null, null, 3L);

    assertThat(closure.getCostPerKgXof()).isNull(); // nul plutôt que faux
  }

  @Test
  void close_recordsTheValuationCoverage() {
    when(unitCostService.feedCost(42L))
        .thenReturn(new UnitCostService.FeedCost(900_000L, 4, 3));

    UnitClosure closure = service.close(7L, 42L, null, null, 3L);

    assertThat(closure.getConsumedArticles()).isEqualTo(4);
    assertThat(closure.getValuedArticles()).isEqualTo(3);
  }

  @Test
  void get_throwsNotFound_whenTheUnitIsStillOpen() {
    when(unitClosureRepository.findByProductionUnitId(42L)).thenReturn(Optional.empty());

    assertThatThrownBy(() -> service.get(7L, 42L)).isInstanceOf(NotFoundException.class);
  }

  @Test
  void reopen_deletesTheFrozenReport() {
    when(unitClosureRepository.findByProductionUnitId(42L)).thenReturn(Optional.of(new UnitClosure()));

    service.reopen(7L, 42L);

    verify(unitClosureRepository).deleteByProductionUnitId(42L);
  }
}
```

> Montez le `@BeforeEach` sur le modèle de `LivestockServiceTest` : `Mockito.mock(...)` pour chaque collaborateur, valeurs par défaut en `lenient()` (recettes 1 800 000, `feedCost` 900 000/1/1, dépenses directes 90 000, effectif initial 1000, delta mortalité −20, performance avec `currentWeightG = 2000`), afin que chaque test ne redéfinisse que ce qu'il éprouve.

- [ ] **Step 2 : lancer le test, vérifier qu'il échoue**

```bash
cd backend && ./mvnw test -pl avicare-app -Dtest=UnitClosureServiceTest
```

- [ ] **Step 3 : écrire le service**

`close(...)` enchaîne : refuser si un bilan existe (`ConflictException("UNIT_ALREADY_CLOSED", "Unit is already closed")`) → charger l'unité (`NotFoundException` sinon) et vérifier `farmId` → `computePerformance` → assembler les champs selon les formules du §4.6 de la spec → `livestockService.closeUnit(unitId)` → `save`.

Arithmétique, exactement :

```java
    long initialCount = lifecycleEventRepository.sumInitialCountByUnit(unitId);
    long deaths = -lifecycleEventRepository.sumMortalityDelta(unitId);
    long liveBirds = initialCount - deaths;

    long revenue = commercialFacade.revenueByProductionUnit(farmId, unitId);
    UnitCostService.FeedCost feed = unitCostService.feedCost(unitId);
    long chickCost = chickCostXof != null ? chickCostXof : 0L;
    long otherExpense = financeFacade.directExpensesForUnit(farmId, unitId);
    long totalCost = feed.costXof() + chickCost + otherExpense;

    Integer costPerKg = null;
    BigDecimal exitWeightG = perf.getCurrentWeightG();
    if (exitWeightG != null && liveBirds > 0) {
      BigDecimal kg =
          exitWeightG
              .multiply(BigDecimal.valueOf(liveBirds))
              .divide(BigDecimal.valueOf(1000), 3, RoundingMode.HALF_UP);
      if (kg.signum() > 0) {
        costPerKg =
            BigDecimal.valueOf(totalCost).divide(kg, 0, RoundingMode.HALF_UP).intValueExact();
      }
    }
```

`mortalityPercent` = `deaths × 100 / initialCount`, arrondi à 2 décimales, **null** si `initialCount <= 0`. `durationDays` = jours entre `startDate` et `endDate` (aujourd'hui). `remainingCount` = `unit.getCurrentCount()`. `marginXof` = `revenue - totalCost`.

`get(farmId, unitId)` : `findByProductionUnitId` ou `NotFoundException.of("UnitClosure", unitId)`, avec vérification que `farmId` correspond (sinon `NotFoundException` — pas de fuite entre fermes).

`reopen(farmId, unitId)` : charger le bilan (404 sinon), vérifier la ferme, `deleteByProductionUnitId`, puis repasser l'unité en `ACTIVE` avec `endDate = null`.

`@Transactional` sur `close` et `reopen`, `@Transactional(readOnly = true)` sur `get`.

- [ ] **Step 4 : lancer le test, vérifier qu'il passe**

```bash
cd backend && ./mvnw test -pl avicare-app -Dtest=UnitClosureServiceTest
```

Attendu : 8 tests verts.

- [ ] **Step 5 : commiter**

```bash
cd backend && ./mvnw spotless:apply -pl avicare-app && ./mvnw spotless:check -pl avicare-app
cd .. && git add -A && git commit -m "feat(backend:livestock): compute and freeze the end-of-cycle report

close() gathers the four sources — sales, valued consumption, direct
expenses, growth snapshot — and writes one immutable row. A later expense no
longer rewrites a past result.

Cost per live kilo counts every bird produced alive, sold or still on hand:
feeding the unsold tail cost money too. It stays null rather than wrong when
the batch was never weighed."
```

---

## Task 6 : les trois endpoints

**Files:**
- Create: `.../closure/UnitClosureController.java`, `.../closure/dto/CloseUnitRequest.java`, `.../closure/dto/UnitClosureResponse.java`
- Test: `backend/avicare-app/src/test/java/com/avicare/livestock/closure/UnitClosureControllerTest.java` (créer)

**Interfaces:**
- Consumes: `UnitClosureService`
- Produces: `POST/GET/DELETE /api/v1/farms/{farmId}/production-units/{unitId}/close|closure`

- [ ] **Step 1 : écrire les DTOs**

```java
/** Corps de la clôture. Le coût des poussins est facultatif : tout le monde ne le connaît pas. */
public record CloseUnitRequest(@PositiveOrZero Long chickCostXof, @Size(max = 2000) String notes) {}
```

`UnitClosureResponse` : un record reprenant tous les champs de l'entité, plus un booléen dérivé `valuationIncomplete` = `valuedArticles < consumedArticles`.

- [ ] **Step 2 : écrire le contrôleur**

Gardes **recopiées** de `ProductionUnitController` :

```java
  private static final String READ = "@farmAccess.hasPermission(#farmId, 'poultry:read')";

  // Clôturer est structurant, comme créer une unité : OWNER/MANAGER, pas FARMER.
  private static final String CLOSE_ROLES =
      "@farmAccess.hasRole(#farmId, "
          + "T(com.avicare.common.security.principal.FarmRole).OWNER, "
          + "T(com.avicare.common.security.principal.FarmRole).MANAGER)";
```

`@RequestMapping("/api/v1/farms/{farmId}/production-units/{unitId}")`, trois méthodes : `@PostMapping("/close")` (`@ResponseStatus(HttpStatus.CREATED)`), `@GetMapping("/closure")`, `@DeleteMapping("/closure")` (`@ResponseStatus(HttpStatus.NO_CONTENT)`). Réponses enveloppées dans `ApiResponse.of(...)`. `TenancyContext.currentUserId()` pour l'auteur.

- [ ] **Step 3 : écrire le test de contrôleur**

Sur le modèle des tests `@WebMvcTest` existants du dépôt : 201 sur clôture, 409 sur seconde clôture, 404 sur unité ouverte, 403 pour un FARMER, 403 sans `poultry:read`.

- [ ] **Step 4 : lancer, vérifier, commiter**

```bash
cd backend && ./mvnw test -pl avicare-app -Dtest=UnitClosureControllerTest
cd backend && ./mvnw spotless:apply -pl avicare-app && ./mvnw spotless:check -pl avicare-app
cd .. && git add -A && git commit -m "feat(backend:livestock): expose close, read and reopen endpoints

Guards copied verbatim from ProductionUnitController rather than reinvented:
reading needs poultry:read, closing and reopening are OWNER/MANAGER. A
divergent guard on a transverse controller has already undercut a
per-species lock in this repo."
```

---

## Task 7 : l'IT du flux complet

**Files:**
- Create: `backend/avicare-app/src/test/java/com/avicare/livestock/closure/UnitClosureIT.java`

**Contexte.** Testcontainers ne démarre pas sur ce Mac (Docker 29 contre docker-java) : écrire l'IT, le pousser, **lire le résultat en CI**. Ne pas s'acharner localement.

- [ ] **Step 1 : écrire l'IT**

Sur le modèle de `LivestockFlowIT`. Scénario : créer une ferme et un lot de 1000 → enregistrer 20 morts → une pesée à 2000 g → entrer 200 kg d'aliment à 400 F puis le consommer sur le lot → vendre 800 sujets → clôturer avec 250 000 F de poussins → vérifier chaque champ figé → réenregistrer une dépense sur le lot → vérifier que **le bilan n'a pas bougé** → rouvrir → vérifier que le bilan a disparu et que l'unité est `ACTIVE`.

- [ ] **Step 2 : pousser et lire la CI**

```bash
git add -A && git commit -m "test(backend:livestock): end-to-end closure flow on Testcontainers"
git push -u origin feat/cloture-bande
gh pr checks --watch
```

---

## Task 8 : le web — clôturer

**Files:**
- Create: `web/src/store/api/closureApi.ts`, `web/src/components/poultry/CloseBatchDialog.tsx`
- Modify: `web/src/store/api/baseApi.ts` (ajouter `"UnitClosure"` à `tagTypes`), `web/src/types/index.ts`, `web/src/components/poultry/PoultryBatchDetailView.tsx`
- Test: `web/src/components/poultry/CloseBatchDialog.test.tsx`

**Contexte.** MUI est en **v9**, pas v7 : `slotProps`, pas `inputProps`. Le formulaire du dialogue doit se réinitialiser sur le **front montant** de `open`, jamais à chaque rendu. Toute route ajoutée à un composant testé exige son `jest.mock` dans le même commit, sinon les tests qui le rendent cassent.

- [ ] **Step 1 : écrire le slice**

Sur le modèle de `productionUnitsApi.ts` : `closeUnit` (mutation), `getUnitClosure` (query), `reopenUnit` (mutation). Les mutations invalident `{ type: "UnitClosure", id: unitId }`, `{ type: "ProductionUnit", id: unitId }` et `{ type: "PoultryBatch", id: "LIST" }` — sans quoi le filtre « Clôturés » ne se rafraîchit pas.

- [ ] **Step 2 : écrire le test du dialogue, puis le dialogue**

Le test vérifie : le champ coût des poussins est facultatif ; la soumission appelle la mutation avec `{ chickCostXof, notes }` ; le dialogue annonce que le bilan sera figé.

- [ ] **Step 3 : monter le bouton dans `PoultryBatchDetailView`**

Visible seulement si le lot est `ACTIVE` **et** que l'utilisateur est OWNER/MANAGER.

- [ ] **Step 4 : vérifier et commiter**

```bash
cd web && npx tsc --noEmit && npm test -- CloseBatchDialog
```

`tsc --noEmit` est obligatoire : vitest peut être vert alors que le build CI échoue sur un typage.

---

## Task 9 : le web — lire le bilan

**Files:**
- Create: `web/src/components/poultry/BatchClosureTab.tsx`
- Modify: `web/src/components/poultry/PoultryBatchDetailView.tsx`
- Test: `web/src/components/poultry/BatchClosureTab.test.tsx`

- [ ] **Step 1 : écrire le test**

Il vérifie trois choses : les chiffres techniques et financiers sont affichés ; **l'avertissement de couverture apparaît quand `valuationIncomplete` est vrai** et disparaît sinon ; l'action « Rouvrir » prévient que le bilan sera supprimé.

- [ ] **Step 2 : écrire le composant**

Deux blocs — technique et argent — et, quand la couverture est incomplète, une alerte nommant le manque : « 1 article consommé n'a pas de prix : le coût est sous-estimé. » Sur un lot `CLOSED`, cet onglet remplace la vue d'ensemble.

- [ ] **Step 3 : vérifier, commiter, ouvrir la PR**

```bash
cd web && npx tsc --noEmit && npm test
cd ../backend && ./mvnw clean verify
cd .. && git push && gh pr create --fill
gh pr checks --watch
```

---

## Vérification finale

- [ ] `cd backend && ./mvnw clean verify` vert
- [ ] `make backend-run` puis `curl http://localhost:8080/actuator/health` → `{"status":"UP"}`
- [ ] `cd web && npx tsc --noEmit && npm test` vert
- [ ] V52 a tourné sur une base propre en CI
- [ ] Les neuf critères d'acceptation du §8 de la spec sont cochés
- [ ] Aucun commit ne porte de signature Claude
- [ ] `gh pr checks` vert **avant** `gh pr merge --rebase --delete-branch`
