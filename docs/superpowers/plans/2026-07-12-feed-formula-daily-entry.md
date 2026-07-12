# Formules à la saisie journalière + saisie pondeuses — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre les formules d'aliment consommables à la saisie journalière (décomposition en N mouvements OUT proportionnels) et ajouter une saisie journalière (aliment + eau) pour les lots de pondeuses.

**Architecture:** À la saisie journalière, la section aliment devient un choix à 3 états (aucun / article standard / formule). Une formule est décomposée côté backend en N `applyConsumption` (un par ingrédient, `totalKg × pct/100`), dans la transaction existante de `DailyRecordService.record`. Poulets et pondeuses partagent le même endpoint générique `daily-records` ; les pondeuses gagnent un onglet « Suivi journalier » (mortalité exclue — elle reste dans Attrition).

**Tech Stack:** Spring Boot 3.4 / Java 21 (backend, JUnit5 + Mockito + AssertJ) ; Next.js 16 / React / MUI v9 / RTK Query (frontend, Vitest + Testing Library).

## Global Constraints

- Aucune signature Claude/AI dans les commits ; Conventional Commits, scope bounded-context (`feat(livestock:poultry)`, `feat(web)`).
- Sémantique stock d'une formule = **décomposition** : chaque ingrédient décrémenté de `totalKg × percentage / 100` (percentage ∈ [0,100]). Révise D20 (assumé).
- `feedConsumption` et `feedFormula` sont **mutuellement exclusifs** (au plus un non-null) → sinon `BusinessRuleException` 422.
- Décomposition **atomique** dans la transaction `@Transactional` de `record` ; stock résultant négatif **toléré** (D19, non bloquant) — c'est `StockConsumptionService.applyConsumption` qui l'autorise déjà.
- Saisie pondeuses = **aliment + eau uniquement** ; `mortalityCount` forcé à `0` (la mortalité reste dans l'onglet Pondeuses → Attrition, les œufs dans Collectes).
- Périmètre formule = **aliment uniquement** ; supporte formules **plateforme** (par `key`) **et ferme** (par `id`).
- `applyConsumption(Long farmId, StockConsumption consumption, ConsumptionSource source, Long userId)` exige `quantity > 0` (sinon 422) et le module `inventory` actif (sinon 422) — chemin identique à `feedConsumption`.
- `BusinessRuleException(String code, String message)` → HTTP 422. `NotFoundException.of(String type, Object id)` → HTTP 404.
- Spotless Google Java Format avant commit backend : `cd backend && ./mvnw -q spotless:apply -pl avicare-app`.
- `*IT` Testcontainers = CI only (Docker local indisponible) — ne pas exécuter localement.
- MUI est **v9** dans ce repo. Web : « This is NOT the Next.js you know » — consulter `web/node_modules/next/dist/docs/` au besoin.
- Reset des dialogues **edge-triggered sur `open`** (leçon `member_access_customization`).

---

## File Structure

**Backend** (`backend/avicare-app/src/main/java/com/avicare/livestock/`)
- `inventory/FeedFormulaService.java` — **modifier** : nouvelle méthode `resolveIngredients`.
- `poultry/FormulaConsumption.java` — **créer** : record référence formule.
- `poultry/DailyRecordCommand.java` — **modifier** : champ `feedFormula`.
- `poultry/DailyRecordService.java` — **modifier** : garde xor + décomposition.
- `dto/request/FeedFormulaRequest.java` — **créer** : DTO REST miroir.
- `dto/request/DailyRecordRequest.java` — **modifier** : champ `feedFormula`.
- `controller/PoultryDailyRecordController.java` — **modifier** : mapping request→command.

**Backend tests** (`backend/avicare-app/src/test/java/com/avicare/livestock/`)
- `inventory/FeedFormulaServiceResolveTest.java` — **créer**.
- `poultry/DailyRecordServiceTest.java` — **créer**.

**Frontend** (`web/src/`)
- `types/index.ts` — **modifier** : `FeedFormulaRef`, `DailyRecordInput.feedFormula`.
- `components/inventory/FeedSourceSection.tsx` (+ `.test.tsx`) — **créer** : sélecteur 3 états partagé.
- `components/poultry/DailyRecordDialog.tsx` — **modifier** : bascule sur `FeedSourceSection`.
- `components/poultry-layer/LayerDailyEntryDialog.tsx` — **créer** : dialogue saisie pondeuse.
- `components/poultry-layer/LayerDailyRecordsTab.tsx` (+ `.test.tsx`) — **créer** : onglet + liste.
- `components/poultry-layer/LayerUnitDetailView.tsx` — **modifier** : nouvel onglet.

---

## Task 1: `FeedFormulaService.resolveIngredients`

**Files:**
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/inventory/FeedFormulaService.java`
- Test: `backend/avicare-app/src/test/java/com/avicare/livestock/inventory/FeedFormulaServiceResolveTest.java`

**Interfaces:**
- Consumes: `FeedFormulaRepository.findByFarmIdAndIdAndActiveTrue(Long, Long) : Optional<FeedFormula>` ; `getPlatformFormula(Long, String) : PlatformFormulaDto` (throws `NotFoundException` if missing) ; `PlatformFormulaDto.ingredients() : List<FormulaIngredient>` ; `FeedFormula.getIngredients() : List<FormulaIngredient>` ; `FormulaIngredient(String articleKey, ArticleSource articleSource, BigDecimal percentage)`.
- Produces: `FeedFormulaService.resolveIngredients(Long farmId, String formulaKey, Long formulaId) : List<FormulaIngredient>`.

- [ ] **Step 1: Write the failing test**

Create `backend/avicare-app/src/test/java/com/avicare/livestock/inventory/FeedFormulaServiceResolveTest.java`:

```java
package com.avicare.livestock.inventory;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.when;

import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.common.api.exception.NotFoundException;
import com.avicare.livestock.domain.ArticleSource;
import com.avicare.livestock.domain.FeedFormula;
import com.avicare.livestock.domain.FormulaIngredient;
import com.avicare.livestock.repository.FeedFormulaRepository;
import com.avicare.parameters.api.ParametersFacade;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/** Unit test for {@link FeedFormulaService#resolveIngredients}. */
@ExtendWith(MockitoExtension.class)
class FeedFormulaServiceResolveTest {

  @Mock FeedFormulaRepository feedFormulaRepository;
  @Mock ParametersFacade parametersFacade;
  @Mock InventoryCatalogService inventoryCatalogService;

  FeedFormulaService service;

  static final Long FARM = 1L;

  @BeforeEach
  void setUp() {
    service =
        new FeedFormulaService(feedFormulaRepository, parametersFacade, inventoryCatalogService);
  }

  private static FormulaIngredient ing(String key, int pct) {
    return new FormulaIngredient(key, ArticleSource.INVENTORY, new BigDecimal(pct));
  }

  @Test
  void resolvesFarmFormulaById() {
    FeedFormula f = new FeedFormula();
    f.setIngredients(List.of(ing("mais", 60), ing("soja", 40)));
    when(feedFormulaRepository.findByFarmIdAndIdAndActiveTrue(FARM, 7L)).thenReturn(Optional.of(f));

    List<FormulaIngredient> out = service.resolveIngredients(FARM, null, 7L);

    assertThat(out).extracting(FormulaIngredient::articleKey).containsExactly("mais", "soja");
  }

  @Test
  void resolvesPlatformFormulaByKey() {
    FeedFormulaService spy = spy(service);
    PlatformFormulaDto dto =
        new PlatformFormulaDto(
            "starter", "Démarrage", List.of(), null, null, null, List.of(ing("mais", 100)), null);
    doReturn(dto).when(spy).getPlatformFormula(FARM, "starter");

    assertThat(spy.resolveIngredients(FARM, "starter", null))
        .extracting(FormulaIngredient::articleKey)
        .containsExactly("mais");
  }

  @Test
  void missingFarmFormulaThrowsNotFound() {
    when(feedFormulaRepository.findByFarmIdAndIdAndActiveTrue(FARM, 7L)).thenReturn(Optional.empty());
    assertThatThrownBy(() -> service.resolveIngredients(FARM, null, 7L))
        .isInstanceOf(NotFoundException.class);
  }

  @Test
  void noReferenceThrowsBusinessRule() {
    assertThatThrownBy(() -> service.resolveIngredients(FARM, null, null))
        .isInstanceOf(BusinessRuleException.class);
  }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && ./mvnw -q -pl avicare-app test -Dtest=FeedFormulaServiceResolveTest`
Expected: FAIL — compile error / `resolveIngredients` method does not exist.

- [ ] **Step 3: Write minimal implementation**

In `FeedFormulaService.java`, add these imports if absent (`FormulaIngredient` is in `com.avicare.livestock.domain`, `NotFoundException`/`BusinessRuleException` in `com.avicare.common.api.exception`), then add the method (place it just after `getPlatformFormula`):

```java
  /**
   * Ingredients of a platform (by {@code formulaKey}) OR farm (by {@code formulaId}) formula.
   * Exactly one identifier must be non-null. Used at daily entry to decompose feed into per-
   * ingredient stock movements (Décision D20 révisée).
   */
  @Transactional(readOnly = true)
  public List<FormulaIngredient> resolveIngredients(Long farmId, String formulaKey, Long formulaId) {
    if (formulaKey != null) {
      return getPlatformFormula(farmId, formulaKey).ingredients();
    }
    if (formulaId != null) {
      return feedFormulaRepository
          .findByFarmIdAndIdAndActiveTrue(farmId, formulaId)
          .orElseThrow(() -> NotFoundException.of("FeedFormula", formulaId))
          .getIngredients();
    }
    throw new BusinessRuleException(
        "FEED_FORMULA_REFERENCE_REQUIRED", "Aucune formule référencée (ni clé ni identifiant).");
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && ./mvnw -q -pl avicare-app test -Dtest=FeedFormulaServiceResolveTest`
Expected: PASS (4 tests).

- [ ] **Step 5: Format + commit**

```bash
cd backend && ./mvnw -q spotless:apply -pl avicare-app
git add backend/avicare-app/src/main/java/com/avicare/livestock/inventory/FeedFormulaService.java \
        backend/avicare-app/src/test/java/com/avicare/livestock/inventory/FeedFormulaServiceResolveTest.java
git commit -m "feat(livestock:inventory): resolveIngredients for platform/farm formulas"
```

---

## Task 2: Formula decomposition at daily entry (command + service + REST)

**Files:**
- Create: `backend/avicare-app/src/main/java/com/avicare/livestock/poultry/FormulaConsumption.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/poultry/DailyRecordCommand.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/poultry/DailyRecordService.java`
- Create: `backend/avicare-app/src/main/java/com/avicare/livestock/dto/request/FeedFormulaRequest.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/dto/request/DailyRecordRequest.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/controller/PoultryDailyRecordController.java`
- Test: `backend/avicare-app/src/test/java/com/avicare/livestock/poultry/DailyRecordServiceTest.java`

**Interfaces:**
- Consumes: `FeedFormulaService.resolveIngredients(Long, String, Long) : List<FormulaIngredient>` (Task 1) ; `StockConsumptionService.applyConsumption(Long farmId, StockConsumption, ConsumptionSource, Long userId)` ; `ConsumptionSource.dailyRecord(Long unitId, Long recordId)` ; `new StockConsumption(String articleKey, ArticleSource, BigDecimal quantity, String notes)` ; `ProductionUnit.getFarmId()`.
- Produces: `FormulaConsumption(String formulaKey, Long formulaId, BigDecimal totalKg, String notes)` ; `DailyRecordCommand` gains trailing `FormulaConsumption feedFormula` ; `DailyRecordRequest` gains trailing `FeedFormulaRequest feedFormula` ; REST body accepts `feedFormula: {formulaKey?, formulaId?, totalKg, notes?}`.

- [ ] **Step 1: Write the failing test**

Create `backend/avicare-app/src/test/java/com/avicare/livestock/poultry/DailyRecordServiceTest.java`:

```java
package com.avicare.livestock.poultry;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.livestock.domain.ArticleSource;
import com.avicare.livestock.domain.DailyRecord;
import com.avicare.livestock.domain.FormulaIngredient;
import com.avicare.livestock.domain.ProductionUnit;
import com.avicare.livestock.inventory.ConsumptionSource;
import com.avicare.livestock.inventory.FeedFormulaService;
import com.avicare.livestock.inventory.StockConsumption;
import com.avicare.livestock.inventory.StockConsumptionService;
import com.avicare.livestock.repository.DailyRecordRepository;
import com.avicare.livestock.repository.LifecycleEventRepository;
import com.avicare.livestock.service.LivestockService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/** Unit test for the feed-formula decomposition in {@link DailyRecordService#record}. */
@ExtendWith(MockitoExtension.class)
class DailyRecordServiceTest {

  @Mock DailyRecordRepository dailyRecordRepository;
  @Mock LifecycleEventRepository lifecycleEventRepository;
  @Mock LivestockService livestockService;
  @Mock StockConsumptionService stockConsumptionService;
  @Mock FeedFormulaService feedFormulaService;

  DailyRecordService service;

  static final Long UNIT = 9L;
  static final Long FARM = 1L;
  static final Long USER = 42L;
  static final LocalDate DAY = LocalDate.of(2026, 7, 12);

  @BeforeEach
  void setUp() {
    service =
        new DailyRecordService(
            dailyRecordRepository,
            lifecycleEventRepository,
            livestockService,
            stockConsumptionService,
            feedFormulaService);

    ProductionUnit unit = new ProductionUnit();
    unit.setFarmId(FARM);
    unit.setCurrentCount(1000);
    when(livestockService.getUnit(UNIT)).thenReturn(unit);
    when(dailyRecordRepository.findByProductionUnitIdAndRecordDate(UNIT, DAY))
        .thenReturn(Optional.empty());
    when(dailyRecordRepository.save(any(DailyRecord.class)))
        .thenAnswer(inv -> inv.getArgument(0));
  }

  private static FormulaIngredient ing(String key, int pct) {
    return new FormulaIngredient(key, ArticleSource.INVENTORY, new BigDecimal(pct));
  }

  private static DailyRecordCommand cmd(StockConsumption fc, FormulaConsumption ff) {
    return new DailyRecordCommand(DAY, 0, new BigDecimal("100"), BigDecimal.ZERO, null, fc, ff);
  }

  @Test
  void formulaDecomposesIntoOneMovementPerIngredient() {
    when(feedFormulaService.resolveIngredients(FARM, null, 5L))
        .thenReturn(List.of(ing("mais", 50), ing("soja", 30), ing("son", 20)));

    service.record(UNIT, cmd(null, new FormulaConsumption(null, 5L, new BigDecimal("100"), null)), USER);

    ArgumentCaptor<StockConsumption> cap = ArgumentCaptor.forClass(StockConsumption.class);
    verify(stockConsumptionService, times(3))
        .applyConsumption(eq(FARM), cap.capture(), any(ConsumptionSource.class), eq(USER));
    assertThat(cap.getAllValues())
        .extracting(StockConsumption::articleKey, c -> c.quantity().stripTrailingZeros())
        .containsExactly(
            org.assertj.core.groups.Tuple.tuple("mais", new BigDecimal("50")),
            org.assertj.core.groups.Tuple.tuple("soja", new BigDecimal("30")),
            org.assertj.core.groups.Tuple.tuple("son", new BigDecimal("20")));
  }

  @Test
  void zeroPercentIngredientIsSkipped() {
    when(feedFormulaService.resolveIngredients(FARM, null, 5L))
        .thenReturn(List.of(ing("mais", 100), ing("additif", 0)));

    service.record(UNIT, cmd(null, new FormulaConsumption(null, 5L, new BigDecimal("100"), null)), USER);

    verify(stockConsumptionService, times(1))
        .applyConsumption(eq(FARM), any(), any(), eq(USER));
  }

  @Test
  void bothFeedSourcesRejected() {
    StockConsumption fc = new StockConsumption("mais", ArticleSource.INVENTORY, BigDecimal.ONE, null);
    FormulaConsumption ff = new FormulaConsumption(null, 5L, new BigDecimal("100"), null);
    assertThatThrownBy(() -> service.record(UNIT, cmd(fc, ff), USER))
        .isInstanceOf(BusinessRuleException.class);
  }

  @Test
  void nonPositiveTotalKgRejected() {
    FormulaConsumption ff = new FormulaConsumption(null, 5L, BigDecimal.ZERO, null);
    assertThatThrownBy(() -> service.record(UNIT, cmd(null, ff), USER))
        .isInstanceOf(BusinessRuleException.class);
    verify(stockConsumptionService, never()).applyConsumption(anyLong(), any(), any(), anyLong());
  }

  @Test
  void singleArticleStillWorks() {
    StockConsumption fc = new StockConsumption("mais", ArticleSource.INVENTORY, BigDecimal.TEN, null);
    service.record(UNIT, cmd(fc, null), USER);
    verify(stockConsumptionService, times(1)).applyConsumption(eq(FARM), eq(fc), any(), eq(USER));
  }

  @Test
  void neitherFeedSourceMovesNoStock() {
    service.record(UNIT, cmd(null, null), USER);
    verify(stockConsumptionService, never()).applyConsumption(anyLong(), any(), any(), anyLong());
  }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && ./mvnw -q -pl avicare-app test -Dtest=DailyRecordServiceTest`
Expected: FAIL — `FormulaConsumption` type does not exist, `DailyRecordCommand` constructor arity mismatch, `DailyRecordService` constructor arity mismatch.

- [ ] **Step 3a: Create `FormulaConsumption`**

Create `backend/avicare-app/src/main/java/com/avicare/livestock/poultry/FormulaConsumption.java`:

```java
package com.avicare.livestock.poultry;

import java.math.BigDecimal;

/**
 * Optional feed-formula reference at daily entry (Décision D20 révisée). When set on a {@link
 * DailyRecordCommand}, the formula's ingredients are each drawn from stock as an OUT movement
 * proportional to {@code totalKg}. Mutually exclusive with {@code DailyRecordCommand#feedConsumption}.
 * Exactly one of {@code formulaKey} (platform template) / {@code formulaId} (farm formula) is set.
 */
public record FormulaConsumption(
    String formulaKey, Long formulaId, BigDecimal totalKg, String notes) {}
```

- [ ] **Step 3b: Add `feedFormula` to `DailyRecordCommand`**

In `DailyRecordCommand.java`, add the trailing component:

```java
public record DailyRecordCommand(
    LocalDate recordDate,
    int mortalityCount,
    BigDecimal feedKg,
    BigDecimal waterL,
    String observations,
    StockConsumption feedConsumption,
    FormulaConsumption feedFormula) {}
```

- [ ] **Step 3c: Decomposition in `DailyRecordService`**

In `DailyRecordService.java`:

1. Add imports: `com.avicare.common.api.exception.BusinessRuleException`, `com.avicare.livestock.domain.FormulaIngredient`, `com.avicare.livestock.inventory.FeedFormulaService`, `com.avicare.livestock.inventory.StockConsumption`, `java.math.RoundingMode`.
2. Add the dependency field (order after `stockConsumptionService`): `private final FeedFormulaService feedFormulaService;`.
3. At the very top of `record(...)`, before `getUnit`, add the xor guard:

```java
    if (cmd.feedConsumption() != null && cmd.feedFormula() != null) {
      throw new BusinessRuleException(
          "DAILY_RECORD_FEED_SOURCE_CONFLICT",
          "Un seul mode d'aliment autorisé : article OU formule, pas les deux.");
    }
```

4. Replace the existing trailing block:

```java
    // D18 optional coupling: draw the feed from stock (same transaction).
    if (cmd.feedConsumption() != null) {
      stockConsumptionService.applyConsumption(
          unit.getFarmId(),
          cmd.feedConsumption(),
          ConsumptionSource.dailyRecord(unitId, saved.getId()),
          userId);
    }

    return saved;
```

with:

```java
    // D18 optional coupling: draw the feed from stock (same transaction).
    if (cmd.feedConsumption() != null) {
      stockConsumptionService.applyConsumption(
          unit.getFarmId(),
          cmd.feedConsumption(),
          ConsumptionSource.dailyRecord(unitId, saved.getId()),
          userId);
    } else if (cmd.feedFormula() != null) {
      applyFormula(unit.getFarmId(), unitId, saved.getId(), cmd.feedFormula(), userId);
    }

    return saved;
  }

  /**
   * Décision D20 révisée: decompose a feed formula into one OUT movement per ingredient, each
   * {@code totalKg × percentage / 100} kg. Runs inside {@link #record}'s transaction (atomic).
   */
  private void applyFormula(
      Long farmId, Long unitId, Long recordId, FormulaConsumption ff, Long userId) {
    if (ff.totalKg() == null || ff.totalKg().signum() <= 0) {
      throw new BusinessRuleException(
          "FEED_FORMULA_QUANTITY", "La quantité totale d'aliment doit être supérieure à 0.");
    }
    List<FormulaIngredient> ingredients =
        feedFormulaService.resolveIngredients(farmId, ff.formulaKey(), ff.formulaId());
    for (FormulaIngredient ing : ingredients) {
      BigDecimal qty =
          ff.totalKg()
              .multiply(ing.percentage())
              .divide(BigDecimal.valueOf(100), 3, RoundingMode.HALF_UP);
      if (qty.signum() > 0) {
        stockConsumptionService.applyConsumption(
            farmId,
            new StockConsumption(ing.articleKey(), ing.articleSource(), qty, ff.notes()),
            ConsumptionSource.dailyRecord(unitId, recordId),
            userId);
      }
    }
```

(The closing `}` of `applyFormula` is the last line above; the method sits between `record` and `listForUnit`.)

- [ ] **Step 4: Run the service test**

Run: `cd backend && ./mvnw -q -pl avicare-app test -Dtest=DailyRecordServiceTest`
Expected: PASS (6 tests).

- [ ] **Step 5: Wire the REST DTOs**

Create `backend/avicare-app/src/main/java/com/avicare/livestock/dto/request/FeedFormulaRequest.java`:

```java
package com.avicare.livestock.dto.request;

import com.avicare.livestock.poultry.FormulaConsumption;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

/**
 * Optional feed-formula reference on a daily-record request (Décision D20 révisée). Exactly one of
 * {@code formulaKey} (platform) / {@code formulaId} (farm) is expected; maps to {@link
 * FormulaConsumption}.
 */
public record FeedFormulaRequest(
    @Size(max = 80) String formulaKey,
    Long formulaId,
    @Positive BigDecimal totalKg,
    @Size(max = 500) String notes) {

  public FormulaConsumption toModel() {
    return new FormulaConsumption(formulaKey, formulaId, totalKg, notes);
  }
}
```

In `DailyRecordRequest.java`, add the trailing component (and the `@Valid` import is already present):

```java
public record DailyRecordRequest(
    @NotNull LocalDate recordDate,
    @PositiveOrZero int mortalityCount,
    @PositiveOrZero BigDecimal feedKg,
    @PositiveOrZero BigDecimal waterL,
    @Size(max = 2000) String observations,
    @Valid StockConsumptionRequest feedConsumption,
    @Valid FeedFormulaRequest feedFormula) {}
```

In `PoultryDailyRecordController.java`, extend the `new DailyRecordCommand(...)` construction to pass the mapped formula (after the `feedConsumption` argument):

```java
                request.feedConsumption() == null ? null : request.feedConsumption().toModel(),
                request.feedFormula() == null ? null : request.feedFormula().toModel()),
```

- [ ] **Step 6: Compile the module (no new unit test for the trivial REST mapping)**

Run: `cd backend && ./mvnw -q -pl avicare-app test-compile`
Expected: BUILD SUCCESS.

> The REST mapping mirrors the existing `feedConsumption` path (no branching logic) and is exercised end-to-end by `DailyRecordServiceIT` in CI. No extra unit test.

- [ ] **Step 7: Run the full module test suite (surefire only, no ITs)**

Run: `cd backend && ./mvnw -q -pl avicare-app test`
Expected: PASS (existing tests + the 2 new classes). If a DB-less `@SpringBootTest` (e.g. `SecurityE2ETest`, `SecurityIntegrationTest`) fails to boot, note that no **new** `@Service` or repository was introduced (only a method on the existing `FeedFormulaService` and a dep on it), so no new `@MockitoBean` is required — investigate any failure before proceeding.

- [ ] **Step 8: Format + commit**

```bash
cd backend && ./mvnw -q spotless:apply -pl avicare-app
git add backend/avicare-app/src/main/java/com/avicare/livestock/poultry/FormulaConsumption.java \
        backend/avicare-app/src/main/java/com/avicare/livestock/poultry/DailyRecordCommand.java \
        backend/avicare-app/src/main/java/com/avicare/livestock/poultry/DailyRecordService.java \
        backend/avicare-app/src/main/java/com/avicare/livestock/dto/request/FeedFormulaRequest.java \
        backend/avicare-app/src/main/java/com/avicare/livestock/dto/request/DailyRecordRequest.java \
        backend/avicare-app/src/main/java/com/avicare/livestock/controller/PoultryDailyRecordController.java \
        backend/avicare-app/src/test/java/com/avicare/livestock/poultry/DailyRecordServiceTest.java
git commit -m "feat(livestock:poultry): decompose feed formula into per-ingredient stock movements at daily entry"
```

---

## Task 3: `FeedSourceSection` shared component (+ types)

**Files:**
- Modify: `web/src/types/index.ts`
- Create: `web/src/components/inventory/FeedSourceSection.tsx`
- Test: `web/src/components/inventory/FeedSourceSection.test.tsx`

**Interfaces:**
- Consumes: `useGetAvailableFormulasQuery({farmId}) → {data: AvailableFeedFormulas}` from `@/store/api/feedFormulasApi` ; `useGetAllArticlesQuery({farmId})` + `useGetStockItemsQuery({farmId})` ; `findStockByArticle`, `formatQty` from `@/lib/inventory` ; types `StockConsumption`, `InventoryCatalogItem`, `AvailableFeedFormulas`, `FormulaIngredient`.
- Produces: `FeedFormulaRef = {formulaKey?: string; formulaId?: number; totalKg: number}` (exported from `@/types`) ; `DailyRecordInput.feedFormula?: FeedFormulaRef & {notes?: string}` ; component `FeedSourceSection` with prop `onChange(feedConsumption: StockConsumption | null, feedFormula: FeedFormulaRef | null)`.

- [ ] **Step 1: Add the types**

In `web/src/types/index.ts`, add near `StockConsumption` (after its `}`):

```ts
/** Reference to a feed formula at daily entry — exactly one of key (platform) / id (farm). */
export interface FeedFormulaRef {
  formulaKey?: string;
  formulaId?: number;
  totalKg: number;
  notes?: string;
}
```

And extend `DailyRecordInput` (add the trailing field):

```ts
export interface DailyRecordInput {
  recordDate: string;
  mortalityCount: number;
  feedKg?: number;
  waterL?: number;
  observations?: string;
  /** Optional D18 stock coupling — draws feed from stock as an OUT movement. */
  feedConsumption?: StockConsumption;
  /** Optional D20-révisée coupling — decomposes a formula into per-ingredient OUT movements. */
  feedFormula?: FeedFormulaRef;
}
```

- [ ] **Step 2: Write the failing test**

Create `web/src/components/inventory/FeedSourceSection.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { FeedSourceSection } from "./FeedSourceSection";

const ARTICLES = [
  { articleKey: "mais", articleSource: "INVENTORY", label: "Maïs", subcategory: "FEED", unit: "kg", typicalUnitPriceXof: 300, custom: false },
  { articleKey: "soja", articleSource: "INVENTORY", label: "Soja", subcategory: "FEED", unit: "kg", typicalUnitPriceXof: 500, custom: false },
];
const FORMULAS = {
  platformFormulas: [
    { key: "starter", label: "Démarrage", targetBreedKeys: [], targetPhase: "STARTER", targetAgeDaysMin: null, targetAgeDaysMax: null, ingredients: [{ articleKey: "mais", articleSource: "INVENTORY", percentage: 70 }, { articleKey: "soja", articleSource: "INVENTORY", percentage: 30 }], estimatedCostPer100kgXof: null },
  ],
  farmFormulas: [],
};

function respond(data: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify({ data }), { status: 200, headers: { "Content-Type": "application/json" } }),
  );
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("/feed-formulas")) return respond(FORMULAS);
      if (url.includes("/articles")) return respond(ARTICLES);
      if (url.includes("/stock-items")) return respond([]);
      return respond([]);
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("FeedSourceSection", () => {
  it("defaults to 'Aucun' and emits null/null", () => {
    const onChange = vi.fn();
    renderWithProviders(<FeedSourceSection farmId={1} open onChange={onChange} />);
    expect(onChange).toHaveBeenCalledWith(null, null);
    expect(screen.getByRole("radio", { name: /aucun/i })).toBeChecked();
  });

  it("emits a feedFormula when a formula is chosen with a total kg", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(<FeedSourceSection farmId={1} open onChange={onChange} />);

    await user.click(screen.getByRole("radio", { name: /formule/i }));
    await user.click(await screen.findByRole("combobox", { name: /formule/i }));
    await user.click(await screen.findByText("Démarrage"));
    await user.type(screen.getByLabelText(/total.*kg/i), "100");

    expect(onChange).toHaveBeenLastCalledWith(null, { formulaKey: "starter", totalKg: 100 });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd web && npx vitest run src/components/inventory/FeedSourceSection.test.tsx`
Expected: FAIL — module `./FeedSourceSection` not found.

- [ ] **Step 4: Implement the component**

Create `web/src/components/inventory/FeedSourceSection.tsx`:

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Autocomplete,
  Box,
  FormControl,
  FormControlLabel,
  InputAdornment,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useGetAllArticlesQuery } from "@/store/api/inventoryCatalogApi";
import { useGetAvailableFormulasQuery } from "@/store/api/feedFormulasApi";
import { useGetStockItemsQuery } from "@/store/api/inventoryStockApi";
import { findStockByArticle, formatQty } from "@/lib/inventory";
import { colors } from "@/theme/tokens";
import type {
  FeedFormulaRef,
  InventoryCatalogItem,
  StockConsumption,
} from "@/types";

type Mode = "none" | "article" | "formula";

interface FormulaOption {
  label: string;
  kind: "Plateforme" | "Ferme";
  formulaKey?: string;
  formulaId?: number;
  ingredients: { articleKey: string; percentage: number }[];
}

interface Props {
  farmId: number;
  /** Whether the host dialog is open (gates the queries). */
  open: boolean;
  onChange: (
    feedConsumption: StockConsumption | null,
    feedFormula: FeedFormulaRef | null,
  ) => void;
}

/**
 * Feed-source selector for the daily-record dialogs (broiler + layer). Three exclusive modes:
 * no coupling, a single standard article (D18), or a feed formula decomposed into per-ingredient
 * OUT movements (D20 révisée). Emits at most one of the two payloads. Shows the resulting stock
 * (orange when negative — non-blocking, D19). The host renders this only when module.inventory is
 * active (useInventoryGating).
 */
export function FeedSourceSection({ farmId, open, onChange }: Props) {
  const [mode, setMode] = useState<Mode>("none");
  const [article, setArticle] = useState<InventoryCatalogItem | null>(null);
  const [qty, setQty] = useState("");
  const [formula, setFormula] = useState<FormulaOption | null>(null);
  const [totalKg, setTotalKg] = useState("");

  const { data: articles = [] } = useGetAllArticlesQuery({ farmId }, { skip: !open });
  const { data: stockItems = [] } = useGetStockItemsQuery({ farmId }, { skip: !open });
  const { data: available } = useGetAvailableFormulasQuery({ farmId }, { skip: !open });

  const feedArticles = useMemo(
    () => articles.filter((a) => a.articleSource === "INVENTORY"),
    [articles],
  );

  const formulaOptions = useMemo<FormulaOption[]>(() => {
    const platform = (available?.platformFormulas ?? []).map((p) => ({
      label: p.label,
      kind: "Plateforme" as const,
      formulaKey: p.key,
      ingredients: p.ingredients,
    }));
    const farm = (available?.farmFormulas ?? []).map((f) => ({
      label: f.name,
      kind: "Ferme" as const,
      formulaId: f.id,
      ingredients: f.ingredients,
    }));
    return [...farm, ...platform];
  }, [available]);

  const emit = (
    m: Mode,
    a: InventoryCatalogItem | null,
    q: string,
    f: FormulaOption | null,
    kg: string,
  ) => {
    if (m === "article") {
      const n = q ? Number(q.replace(",", ".")) : NaN;
      if (a && Number.isFinite(n) && n > 0) {
        onChange({ articleKey: a.articleKey, articleSource: a.articleSource, quantity: n }, null);
        return;
      }
    } else if (m === "formula") {
      const n = kg ? Number(kg.replace(",", ".")) : NaN;
      if (f && Number.isFinite(n) && n > 0) {
        onChange(null, {
          ...(f.formulaKey ? { formulaKey: f.formulaKey } : { formulaId: f.formulaId }),
          totalKg: n,
        });
        return;
      }
    }
    onChange(null, null);
  };

  // Reset to a clean state on each open (mount) and clear the parent's held value.
  useEffect(() => {
    setMode("none");
    setArticle(null);
    setQty("");
    setFormula(null);
    setTotalKg("");
    onChange(null, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const totalKgNum = totalKg ? Number(totalKg.replace(",", ".")) : NaN;
  const current = article
    ? (findStockByArticle(stockItems, article.articleKey)?.currentQuantity ?? 0)
    : null;
  const after = current != null && Number.isFinite(Number(qty.replace(",", ".")))
    ? current - Number(qty.replace(",", "."))
    : null;

  return (
    <Box sx={{ border: `1px solid ${colors.neutral[200]}`, borderRadius: 2, p: 2 }}>
      <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
        Aliment distribué
      </Typography>
      <FormControl>
        <RadioGroup
          row
          value={mode}
          onChange={(e) => {
            const m = e.target.value as Mode;
            setMode(m);
            emit(m, article, qty, formula, totalKg);
          }}
        >
          <FormControlLabel value="none" control={<Radio size="small" />} label="Aucun" />
          <FormControlLabel value="article" control={<Radio size="small" />} label="Article" />
          <FormControlLabel value="formula" control={<Radio size="small" />} label="Formule" />
        </RadioGroup>
      </FormControl>

      {mode === "article" && (
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Autocomplete
            options={feedArticles}
            getOptionLabel={(o) => o.label}
            value={article}
            onChange={(_e, v) => {
              setArticle(v);
              emit("article", v, qty, formula, totalKg);
            }}
            isOptionEqualToValue={(o, v) => o.articleKey === v.articleKey}
            renderInput={(params) => (
              <TextField {...params} label="Article à décompter" size="small" />
            )}
          />
          <TextField
            label="Quantité consommée"
            value={qty}
            onChange={(e) => {
              setQty(e.target.value);
              emit("article", article, e.target.value, formula, totalKg);
            }}
            type="number"
            size="small"
            slotProps={{
              htmlInput: { inputMode: "decimal", min: 0, step: "0.01" },
              input: article?.unit
                ? { endAdornment: <InputAdornment position="end">{article.unit}</InputAdornment> }
                : undefined,
            }}
          />
          {after != null && (
            <Typography
              variant="caption"
              sx={{
                fontFamily: "var(--font-mono)",
                color: after < 0 ? colors.warning.dark : colors.neutral[500],
                fontWeight: after < 0 ? 700 : 500,
              }}
            >
              Stock après : {formatQty(after, article?.unit)}
              {after < 0 ? " — stock négatif (autorisé)" : ""}
            </Typography>
          )}
        </Stack>
      )}

      {mode === "formula" && (
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Autocomplete
            options={formulaOptions}
            groupBy={(o) => o.kind}
            getOptionLabel={(o) => o.label}
            value={formula}
            onChange={(_e, v) => {
              setFormula(v);
              emit("formula", article, qty, v, totalKg);
            }}
            isOptionEqualToValue={(o, v) =>
              o.formulaKey === v.formulaKey && o.formulaId === v.formulaId
            }
            renderInput={(params) => <TextField {...params} label="Formule" size="small" />}
          />
          <TextField
            label="Total aliment (kg)"
            value={totalKg}
            onChange={(e) => {
              setTotalKg(e.target.value);
              emit("formula", article, qty, formula, e.target.value);
            }}
            type="number"
            size="small"
            slotProps={{ htmlInput: { inputMode: "decimal", min: 0, step: "0.1" } }}
          />
          {formula && Number.isFinite(totalKgNum) && totalKgNum > 0 && (
            <Stack spacing={0.5} sx={{ pl: 1 }}>
              {formula.ingredients.map((ing) => {
                const kg = (totalKgNum * ing.percentage) / 100;
                const stock =
                  findStockByArticle(stockItems, ing.articleKey)?.currentQuantity ?? 0;
                const lbl =
                  feedArticles.find((a) => a.articleKey === ing.articleKey)?.label ??
                  ing.articleKey;
                const rest = stock - kg;
                return (
                  <Typography
                    key={ing.articleKey}
                    variant="caption"
                    sx={{
                      fontFamily: "var(--font-mono)",
                      color: rest < 0 ? colors.warning.dark : colors.neutral[600],
                    }}
                  >
                    {lbl} — {formatQty(kg, "kg")} ({formatQty(stock, "kg")} →{" "}
                    {formatQty(rest, "kg")})
                  </Typography>
                );
              })}
            </Stack>
          )}
        </Stack>
      )}
    </Box>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd web && npx vitest run src/components/inventory/FeedSourceSection.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Lint + commit**

```bash
cd web && npm run lint
git add web/src/types/index.ts web/src/components/inventory/FeedSourceSection.tsx \
        web/src/components/inventory/FeedSourceSection.test.tsx
git commit -m "feat(web): FeedSourceSection — choose none/standard article/formula for feed"
```

---

## Task 4: Broiler `DailyRecordDialog` uses `FeedSourceSection`

**Files:**
- Modify: `web/src/components/poultry/DailyRecordDialog.tsx`
- Test: `web/src/components/poultry/DailyRecordDialog.test.tsx`

**Interfaces:**
- Consumes: `FeedSourceSection` (Task 3) ; `FeedFormulaRef`, `StockConsumption` from `@/types`.
- Produces: submit body now carries `feedConsumption?` **or** `feedFormula?` (one, the other `undefined`).

- [ ] **Step 1: Write the failing test**

Append to `web/src/components/poultry/DailyRecordDialog.test.tsx` a case asserting the formula path submits `feedFormula`. Replace the file's top imports and add a fetch stub + a new test:

Add at the top (after existing imports):

```tsx
import { afterEach, beforeEach } from "vitest";

const ARTICLES = [
  { articleKey: "mais", articleSource: "INVENTORY", label: "Maïs", subcategory: "FEED", unit: "kg", typicalUnitPriceXof: 300, custom: false },
];
const FORMULAS = {
  platformFormulas: [
    { key: "starter", label: "Démarrage", targetBreedKeys: [], targetPhase: "STARTER", targetAgeDaysMin: null, targetAgeDaysMax: null, ingredients: [{ articleKey: "mais", articleSource: "INVENTORY", percentage: 100 }], estimatedCostPer100kgXof: null },
  ],
  farmFormulas: [],
};
let lastBody: Record<string, unknown> | null = null;
function ok(data: unknown) {
  return Promise.resolve(new Response(JSON.stringify({ data }), { status: 201, headers: { "Content-Type": "application/json" } }));
}
beforeEach(() => {
  lastBody = null;
  vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.includes("/daily-records") && init?.method === "POST") {
      lastBody = JSON.parse(init.body as string);
      return ok({ id: 1, productionUnitId: 9, recordDate: "2026-07-12", mortalityCount: 0, feedKg: 0, waterL: 0, observations: null });
    }
    if (url.includes("/feed-formulas")) return ok(FORMULAS);
    if (url.includes("/articles")) return ok(ARTICLES);
    if (url.includes("/subscription/modules") || url.includes("/modules")) return ok(["module.inventory"]);
    return ok([]);
  }));
});
afterEach(() => vi.unstubAllGlobals());
```

Then add the test inside the `describe`:

```tsx
  it("submits a feedFormula when a formula and total kg are chosen", async () => {
    const user = userEvent.setup();
    setup();
    await user.type(screen.getByLabelText(/mortalité du jour/i), "0");
    // Feed source → Formule
    await user.click(await screen.findByRole("radio", { name: /formule/i }));
    await user.click(await screen.findByRole("combobox", { name: /formule/i }));
    await user.click(await screen.findByText("Démarrage"));
    await user.type(screen.getByLabelText(/total.*kg/i), "100");
    await user.click(screen.getByRole("button", { name: /enregistrer/i }));

    await vi.waitFor(() => expect(lastBody).not.toBeNull());
    expect(lastBody).toMatchObject({ feedFormula: { formulaKey: "starter", totalKg: 100 } });
    expect(lastBody).not.toHaveProperty("feedConsumption", expect.anything());
  });
```

> Note: `useInventoryGating` reads active modules via the store; the stub returns `["module.inventory"]` for the modules query so `hasInventory` is true and `FeedSourceSection` renders. If the modules endpoint path differs, adjust the `url.includes(...)` guard to match `useActiveModules`'s query (inspect `web/src/hooks/useActiveModules.ts`).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/components/poultry/DailyRecordDialog.test.tsx`
Expected: FAIL — no `radio` named "Formule" (still the old `StockConsumptionSection`).

- [ ] **Step 3: Swap the component**

In `web/src/components/poultry/DailyRecordDialog.tsx`:

1. Replace the import `import { StockConsumptionSection } from "@/components/inventory/StockConsumptionSection";` with `import { FeedSourceSection } from "@/components/inventory/FeedSourceSection";`.
2. Replace the state and type import:
   - change `import type { StockConsumption } from "@/types";` → `import type { FeedFormulaRef, StockConsumption } from "@/types";`
   - replace `const [consumption, setConsumption] = useState<StockConsumption | null>(null);` with:
     ```tsx
     const [consumption, setConsumption] = useState<StockConsumption | null>(null);
     const [formula, setFormula] = useState<FeedFormulaRef | null>(null);
     ```
3. In `onSubmit`, replace the `feedConsumption: consumption ?? undefined,` line with:
   ```tsx
             feedConsumption: consumption ?? undefined,
             feedFormula: formula ?? undefined,
   ```
4. Replace the rendered section:
   ```tsx
             {hasInventory && (
               <StockConsumptionSection
                 farmId={farmId}
                 open={open}
                 onChange={setConsumption}
                 sourceFilter="INVENTORY"
                 label="Décrémenter l'aliment du stock"
               />
             )}
   ```
   with:
   ```tsx
             {hasInventory && (
               <FeedSourceSection
                 farmId={farmId}
                 open={open}
                 onChange={(fc, ff) => {
                   setConsumption(fc);
                   setFormula(ff);
                 }}
               />
             )}
   ```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run src/components/poultry/DailyRecordDialog.test.tsx`
Expected: PASS (existing 3 tests + new formula test).

- [ ] **Step 5: Lint + commit**

```bash
cd web && npm run lint
git add web/src/components/poultry/DailyRecordDialog.tsx web/src/components/poultry/DailyRecordDialog.test.tsx
git commit -m "feat(web): broiler daily entry can decrement a feed formula from stock"
```

---

## Task 5: Layer daily entry (tab + dialog)

**Files:**
- Create: `web/src/components/poultry-layer/LayerDailyEntryDialog.tsx`
- Create: `web/src/components/poultry-layer/LayerDailyRecordsTab.tsx`
- Modify: `web/src/components/poultry-layer/LayerUnitDetailView.tsx`
- Test: `web/src/components/poultry-layer/LayerDailyRecordsTab.test.tsx`

**Interfaces:**
- Consumes: `useGetDailyRecordsQuery`, `useCreateDailyRecordMutation` from `@/store/api/poultryBatchesApi` (generic on `batchId`) ; `FeedSourceSection` (Task 3) ; `ProductionUnit`, `FeedFormulaRef`, `StockConsumption`, `PoultryDailyRecord` types ; `useInventoryGating`, `useToast`, `apiErrorMessage`, `formatDate`.
- Produces: onglet « Suivi journalier » on `LayerUnitDetailView`; a layer daily record always POSTs `mortalityCount: 0`.

- [ ] **Step 1: Write the failing test**

Create `web/src/components/poultry-layer/LayerDailyRecordsTab.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { LayerDailyRecordsTab } from "./LayerDailyRecordsTab";
import type { ProductionUnit } from "@/types";

const UNIT: ProductionUnit = {
  id: 3,
  farmId: 1,
  species: "POULTRY",
  unitKind: "BATCH",
  breedId: 5,
  name: "Lot Pondeuse",
  startDate: "2026-03-01",
  endDate: null,
  currentCount: 980,
  status: "ACTIVE",
};

const RECORDS = [
  { id: 1, productionUnitId: 3, recordDate: "2026-07-11", mortalityCount: 0, feedKg: 110, waterL: 200, observations: null },
];

function ok(data: unknown) {
  return Promise.resolve(new Response(JSON.stringify({ data }), { status: 200, headers: { "Content-Type": "application/json" } }));
}
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.includes("/daily-records")) return ok(RECORDS);
    return ok([]);
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe("LayerDailyRecordsTab", () => {
  it("lists the daily records of the flock", async () => {
    renderWithProviders(<LayerDailyRecordsTab farmId={1} unit={UNIT} />);
    expect(await screen.findByText("110")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /saisir/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/components/poultry-layer/LayerDailyRecordsTab.test.tsx`
Expected: FAIL — module `./LayerDailyRecordsTab` not found.

- [ ] **Step 3: Implement `LayerDailyEntryDialog`**

Create `web/src/components/poultry-layer/LayerDailyEntryDialog.tsx`:

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { X } from "lucide-react";
import { useCreateDailyRecordMutation } from "@/store/api/poultryBatchesApi";
import { useToast } from "@/components/feedback/ToastProvider";
import { useInventoryGating } from "@/hooks/useInventoryGating";
import { FeedSourceSection } from "@/components/inventory/FeedSourceSection";
import { apiErrorMessage } from "@/lib/apiError";
import type { FeedFormulaRef, StockConsumption } from "@/types";

const today = () => new Date().toISOString().slice(0, 10);

const schema = z.object({
  recordDate: z.string().min(1, "Date requise"),
  feedKg: z.string().regex(/^\d*([.,]\d+)?$/, "Nombre invalide").optional().or(z.literal("")),
  waterL: z.string().regex(/^\d*([.,]\d+)?$/, "Nombre invalide").optional().or(z.literal("")),
  observations: z.string().max(1000, "1000 caractères maximum").optional().or(z.literal("")),
});
type Form = z.infer<typeof schema>;
const DEFAULTS: Form = { recordDate: today(), feedKg: "", waterL: "", observations: "" };
const numField = (v?: string) => {
  const n = v ? Number(v.replace(",", ".")) : NaN;
  return Number.isFinite(n) ? n : undefined;
};

export function LayerDailyEntryDialog({
  open,
  onClose,
  farmId,
  unitId,
  existingDates,
}: {
  open: boolean;
  onClose: () => void;
  farmId: number;
  unitId: number;
  existingDates: string[];
}) {
  const { showToast } = useToast();
  const { hasInventory } = useInventoryGating();
  const [createRecord, { isLoading }] = useCreateDailyRecordMutation();
  const [consumption, setConsumption] = useState<StockConsumption | null>(null);
  const [formula, setFormula] = useState<FeedFormulaRef | null>(null);

  const { control, handleSubmit, reset } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULTS,
  });

  useEffect(() => {
    if (open) reset(DEFAULTS);
  }, [open, reset]);

  const dateSet = useMemo(() => new Set(existingDates), [existingDates]);
  const watchedDate = useWatch({ control, name: "recordDate" });
  const isUpdate = !!watchedDate && dateSet.has(watchedDate);

  const onSubmit = async (values: Form) => {
    try {
      await createRecord({
        farmId,
        batchId: unitId,
        body: {
          recordDate: values.recordDate,
          mortalityCount: 0, // la mortalité pondeuse passe par l'onglet Pondeuses → Attrition
          feedKg: numField(values.feedKg),
          waterL: numField(values.waterL),
          observations: values.observations || undefined,
          feedConsumption: consumption ?? undefined,
          feedFormula: formula ?? undefined,
        },
      }).unwrap();
      showToast(isUpdate ? "Suivi mis à jour." : "Suivi enregistré.", "success");
      onClose();
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <DialogTitle component="div" sx={{ pr: 6 }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Suivi journalier
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Aliment et eau distribués (la mortalité se saisit dans l'onglet Pondeuses).
          </Typography>
          <IconButton onClick={onClose} aria-label="Fermer" sx={{ position: "absolute", top: 12, right: 12 }}>
            <X size={20} />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <Controller
              name="recordDate"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  type="date"
                  label="Date de la saisie"
                  fullWidth
                  slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: today() } }}
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
            {isUpdate && (
              <Alert severity="info" sx={{ py: 0.5 }}>
                Un suivi existe déjà pour cette date — il sera mis à jour.
              </Alert>
            )}
            <Box sx={{ display: "flex", gap: 2, flexDirection: { xs: "column", sm: "row" } }}>
              <Controller
                name="feedKg"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    type="number"
                    label="Aliment (kg)"
                    fullWidth
                    slotProps={{ htmlInput: { inputMode: "decimal", min: 0, step: "0.1" } }}
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  />
                )}
              />
              <Controller
                name="waterL"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    type="number"
                    label="Eau (L)"
                    fullWidth
                    slotProps={{ htmlInput: { inputMode: "decimal", min: 0, step: "0.1" } }}
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  />
                )}
              />
            </Box>
            <Controller
              name="observations"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Observations"
                  fullWidth
                  multiline
                  minRows={2}
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
            {hasInventory && (
              <FeedSourceSection
                farmId={farmId}
                open={open}
                onChange={(fc, ff) => {
                  setConsumption(fc);
                  setFormula(ff);
                }}
              />
            )}
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={onClose} color="inherit">
            Annuler
          </Button>
          <Button
            type="submit"
            variant="contained"
            color="primary"
            disabled={isLoading}
            startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {isUpdate ? "Mettre à jour" : "Enregistrer"}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
```

- [ ] **Step 4: Implement `LayerDailyRecordsTab`**

Create `web/src/components/poultry-layer/LayerDailyRecordsTab.tsx`:

```tsx
"use client";

import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { ClipboardList, Plus } from "lucide-react";
import { useGetDailyRecordsQuery } from "@/store/api/poultryBatchesApi";
import { apiErrorMessage } from "@/lib/apiError";
import { formatDate } from "@/lib/format";
import { colors } from "@/theme/tokens";
import { LayerDailyEntryDialog } from "./LayerDailyEntryDialog";
import type { ProductionUnit } from "@/types";

const monoCell = { fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" } as const;
const DASH = "—";

export function LayerDailyRecordsTab({
  farmId,
  unit,
}: {
  farmId: number;
  unit: ProductionUnit;
}) {
  const [open, setOpen] = useState(false);
  const { data: records, isLoading, error } = useGetDailyRecordsQuery({
    farmId,
    batchId: unit.id,
  });

  const sorted = [...(records ?? [])].sort((a, b) => b.recordDate.localeCompare(a.recordDate));
  const existingDates = (records ?? []).map((r) => r.recordDate);

  return (
    <Stack spacing={2}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Suivi journalier
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Aliment et eau distribués (mortalité dans l'onglet Pondeuses).
          </Typography>
        </Box>
        {unit.status === "ACTIVE" && (
          <Button variant="contained" startIcon={<Plus size={18} />} onClick={() => setOpen(true)}>
            Saisir
          </Button>
        )}
      </Stack>

      {error && <Alert severity="error">{apiErrorMessage(error)}</Alert>}
      {isLoading && <Skeleton variant="rectangular" height={160} />}

      {!isLoading && sorted.length === 0 && (
        <Card sx={{ p: 4, textAlign: "center", color: colors.neutral[500] }}>
          <ClipboardList size={32} />
          <Typography sx={{ mt: 1 }}>Aucune saisie pour le moment.</Typography>
        </Card>
      )}

      {sorted.length > 0 && (
        <TableContainer component={Card}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell align="right">Aliment (kg)</TableCell>
                <TableCell align="right">Eau (L)</TableCell>
                <TableCell>Observations</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sorted.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell sx={monoCell}>{formatDate(r.recordDate)}</TableCell>
                  <TableCell align="right" sx={monoCell}>
                    {r.feedKg ?? DASH}
                  </TableCell>
                  <TableCell align="right" sx={monoCell}>
                    {r.waterL ?? DASH}
                  </TableCell>
                  <TableCell>{r.observations ?? DASH}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <LayerDailyEntryDialog
        open={open}
        onClose={() => setOpen(false)}
        farmId={farmId}
        unitId={unit.id}
        existingDates={existingDates}
      />
    </Stack>
  );
}
```

- [ ] **Step 5: Wire the tab into `LayerUnitDetailView`**

In `web/src/components/poultry-layer/LayerUnitDetailView.tsx`:

1. Add the import (next to the other tab imports): `import { LayerDailyRecordsTab } from "./LayerDailyRecordsTab";`
2. Extend the `TabKey` union: `type TabKey = "overview" | "collections" | "records" | "layers" | "health";`
3. Add the tab to the `TABS` array (between Collectes and Pondeuses):
   ```tsx
     { key: "collections", label: "Collectes" },
     { key: "records", label: "Suivi journalier" },
     { key: "layers", label: "Pondeuses" },
   ```
4. Add the render branch (after the `collections` branch):
   ```tsx
       {tab === "records" && <LayerDailyRecordsTab farmId={farmId as number} unit={unit} />}
   ```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd web && npx vitest run src/components/poultry-layer/LayerDailyRecordsTab.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 7: Lint + commit**

```bash
cd web && npm run lint
git add web/src/components/poultry-layer/LayerDailyEntryDialog.tsx \
        web/src/components/poultry-layer/LayerDailyRecordsTab.tsx \
        web/src/components/poultry-layer/LayerUnitDetailView.tsx \
        web/src/components/poultry-layer/LayerDailyRecordsTab.test.tsx
git commit -m "feat(web): layer flocks get a daily feed/water entry tab"
```

---

## Task 6: Full suites green

**Files:** none (verification only).

- [ ] **Step 1: Backend module tests (surefire, no ITs)**

Run: `cd backend && ./mvnw -q -pl avicare-app test`
Expected: BUILD SUCCESS. (ITs run in CI only.)

- [ ] **Step 2: Frontend suite + lint**

Run: `cd web && npx vitest run && npm run lint`
Expected: all tests pass, no lint errors.

- [ ] **Step 3: Commit any incidental fixes (if a shared snapshot/count changed)**

```bash
git add -A && git commit -m "test(web): reconcile suites after feed-source daily entry"
```

(Skip if nothing changed.)

---

## Self-Review notes

- **Spec coverage:** décomposition backend (T1 resolveIngredients + T2 service/REST) ; `FeedSourceSection` 3 états (T3) ; dialogue poulet (T4) ; onglet + dialogue pondeuse avec `mortalityCount:0` (T5) ; xor + totalKg guards (T2 tests) ; formules ferme **et** plateforme (T1 tests, T3 options). ✔
- **Type consistency:** `FormulaConsumption(formulaKey, formulaId, totalKg, notes)` identique backend/REST ; `FeedFormulaRef{formulaKey?, formulaId?, totalKg, notes?}` frontend ; `resolveIngredients(farmId, formulaKey, formulaId)` cohérent T1↔T2 ; `onChange(feedConsumption, feedFormula)` cohérent T3↔T4↔T5. ✔
- **No placeholders:** tout code fourni intégralement ; seuls points à vérifier par l'implémenteur signalés explicitement (chemin exact de la query modules dans le test T4 ; ordre des args du constructeur `FeedFormulaService`). ✔
