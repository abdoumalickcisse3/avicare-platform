# Coût d'achat des poussins à la réception — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a farmer record the chick purchase cost when a broiler batch is created (or later, via a dedicated correction action), instead of only as a lump sum entered at batch closure months later — while making that cost visible in the farm's overall P&L, without double-counting it in the batch closure bilan.

**Architecture:** The chick cost becomes a normal `Expense` (source `CHICK_PURCHASE`, category `chicks`), recorded through the existing `FinanceFacade` boundary (mirroring the already-proven `recordVetVisitExpense` idempotent-upsert pattern) — never a duplicated field on `PoultryBatch`. Batch closure reads this expense instead of asking for a manual value; a legacy fallback path covers batches that never got one.

**Tech Stack:** Spring Boot 3 / Java 21 / JPA / Flyway (backend), Next.js 16 / MUI v9 / RTK Query (web), Expo Router / React Native / RTK Query (mobile).

**Spec:** [docs/superpowers/specs/2026-09-24-chick-purchase-cost-design.md](../specs/2026-09-24-chick-purchase-cost-design.md)

## Global Constraints

- `PoultryBatch` never carries a price field — the cost lives only as an `Expense`, reached exclusively through `FinanceFacade` (ADR-008: no cross-context imports; `FinanceFacade` is the sanctioned exception for this purpose).
- The head count that drives the amount is always `initialCount` (poussins réellement achetés), never `currentCount` (which falls with mortality and has nothing to do with the purchase price).
- `ExpenseSource.CHICK_PURCHASE` is excluded from `ExpenseRepository.sumDirectForUnit` (same mechanism as the existing `STOCK_ENTRY` exclusion) so the batch-closure bilan never double-counts it.
- Correction after creation is a single dedicated action (`POST .../chick-cost`), never a generic `PoultryBatch` edit endpoint — refused (409) once the batch is closed.
- Parity web/mobile is mandatory for every user-facing piece, including the new mobile post-onboarding batch-creation screen (comblant un écart préexistant demandé dans le même mouvement).
- No Claude/AI signature or reference in any commit message (project-wide rule, `CLAUDE.md`).
- Flyway migration numbers are assigned at merge time, not at authoring time (documented project convention): before creating the migration file in Task 1, run `ls backend/avicare-app/src/main/resources/db/migration/ | sort -V | tail -3` against the current `main` and use the next free `V<n>`. This plan writes `V59` as a placeholder; renumber if `main` has moved.

---

### Task 1: Expense vocabulary — `CHICK_PURCHASE` source, `chicks` category, repository exclusion

**Files:**
- Create: `backend/avicare-app/src/main/resources/db/migration/V59__expenses_chick_purchase_source.sql` (verify the number per Global Constraints)
- Modify: `backend/avicare-app/src/main/java/com/avicare/finance/domain/ExpenseSource.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/finance/repository/ExpenseRepository.java`
- Test: `backend/avicare-app/src/test/java/com/avicare/finance/service/FinanceFacadeUnitExpensesTest.java`

**Interfaces:**
- Consumes: nothing new.
- Produces: `ExpenseSource.CHICK_PURCHASE` enum value; `ExpenseRepository.findByFarmIdAndProductionUnitIdAndSource(Long farmId, Long productionUnitId, ExpenseSource source)` — used by Task 2's facade implementation. `sumDirectForUnit` now excludes `CHICK_PURCHASE` too — used implicitly by every existing caller (`UnitClosureService`).

- [ ] **Step 1: Write the migration**

```sql
-- =====================================================================
-- V59 — Extend expense sources to cover chick purchases (recorded at
-- batch reception or corrected later), plus the matching catalog category.
-- =====================================================================

ALTER TABLE expenses DROP CONSTRAINT expenses_source_check;
ALTER TABLE expenses ADD CONSTRAINT expenses_source_check
    CHECK (source IN ('MANUAL', 'PURCHASE', 'STOCK_ENTRY', 'SALARY', 'VET_VISIT', 'CHICK_PURCHASE'));

INSERT INTO catalog_items (category, key, value, locale) VALUES
  ('expense_categories', 'chicks', '{"label":"Poussins"}'::jsonb, NULL);
```

- [ ] **Step 2: Add the enum value**

Edit `ExpenseSource.java`:

```java
package com.avicare.finance.domain;

/**
 * Source of an expense entry.
 *
 * <p>MANUAL = manual entry by user; PURCHASE = auto-recorded from purchase order receipt;
 * STOCK_ENTRY = auto-recorded from stock movement valuation; SALARY = auto-recorded from payroll
 * (Sprint B6 P2); VET_VISIT = auto-recorded from a vet visit cost; CHICK_PURCHASE = auto-recorded
 * chick purchase cost, from batch reception or a later correction.
 */
public enum ExpenseSource {
  MANUAL,
  PURCHASE,
  STOCK_ENTRY,
  SALARY,
  VET_VISIT,
  CHICK_PURCHASE
}
```

- [ ] **Step 3: Add the finder and update the exclusion query**

Edit `ExpenseRepository.java` — add the import and finder method, and widen the `sumDirectForUnit` exclusion:

```java
  /**
   * Σ of the expenses attributed to a production unit, sources {@code STOCK_ENTRY} and {@code
   * CHICK_PURCHASE} excluded: the first is already counted when the stock came in (V25
   * double-count guard), the second is surfaced as its own explicit line by the closure bilan
   * (`UnitClosureService`) rather than folded into "other expenses". Soft-deleted rows are
   * filtered by the entity's {@code @SQLRestriction}.
   */
  @Query(
      "SELECT COALESCE(SUM(e.amountXof), 0) FROM Expense e "
          + "WHERE e.farmId = :farmId AND e.productionUnitId = :unitId "
          + "AND e.source NOT IN (com.avicare.finance.domain.ExpenseSource.STOCK_ENTRY, "
          + "com.avicare.finance.domain.ExpenseSource.CHICK_PURCHASE)")
  long sumDirectForUnit(@Param("farmId") Long farmId, @Param("unitId") Long unitId);

  /**
   * Dépense d'achat des poussins d'une unité (idempotence de l'upsert, et lecture pour le bilan de
   * clôture).
   *
   * @param farmId the farm id
   * @param productionUnitId the production unit id
   * @param source the expense source to match
   * @return the matching expense, or empty if none exists
   */
  Optional<Expense> findByFarmIdAndProductionUnitIdAndSource(
      Long farmId, Long productionUnitId, ExpenseSource source);
```

(The existing `sumDirectForUnit` method and its old Javadoc are replaced by the block above — same method name and signature, just the query and comment change. `Optional` is already imported in this file.)

- [ ] **Step 4: Add a regression test for the widened exclusion**

Add to `FinanceFacadeUnitExpensesTest.java` (same file, same class — `expenseRepository`/`facade` already set up in `@BeforeEach`):

```java
  @Test
  void directExpensesForUnit_excludesChickPurchaseToo() {
    // sumDirectForUnit is the repository's job (excluded at the query level); this test only
    // pins that the facade keeps relaying whatever the repository returns, unchanged, so a
    // regression that stops excluding CHICK_PURCHASE at the query level is caught by a repository
    // slice test — this class only guards the facade's pass-through.
    when(expenseRepository.sumDirectForUnit(7L, 42L)).thenReturn(90_000L);

    assertThat(facade.directExpensesForUnit(7L, 42L)).isEqualTo(90_000L);
  }
```

- [ ] **Step 5: Run tests**

Run: `cd backend && ./mvnw -pl avicare-app -am clean compile test-compile` (never the incremental `compile` alone — it can report a misleading "Nothing to compile"), then `./mvnw -pl avicare-app test -Dtest=FinanceFacadeUnitExpensesTest`
Expected: BUILD SUCCESS, all tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/avicare-app/src/main/resources/db/migration/V59__expenses_chick_purchase_source.sql \
  backend/avicare-app/src/main/java/com/avicare/finance/domain/ExpenseSource.java \
  backend/avicare-app/src/main/java/com/avicare/finance/repository/ExpenseRepository.java \
  backend/avicare-app/src/test/java/com/avicare/finance/service/FinanceFacadeUnitExpensesTest.java
git commit -m "feat(finance): ajouter la source de dépense CHICK_PURCHASE"
```

---

### Task 2: `FinanceFacade` — record and read the chick-purchase expense

**Files:**
- Modify: `backend/avicare-app/src/main/java/com/avicare/finance/api/FinanceFacade.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/finance/service/FinanceFacadeImpl.java`
- Test: `backend/avicare-app/src/test/java/com/avicare/finance/service/FinanceFacadeChickPurchaseTest.java` (new)

**Interfaces:**
- Consumes: `ExpenseRepository.findByFarmIdAndProductionUnitIdAndSource(...)` from Task 1.
- Produces: `FinanceFacade.recordChickPurchaseExpense(Long farmId, Long productionUnitId, long amountXof, LocalDate date, Long userId)` and `FinanceFacade.chickPurchaseCostForUnit(Long farmId, Long productionUnitId)` returning `Optional<Long>` — used by Task 3 (creation), Task 4 (correction), Task 5 (closure).

- [ ] **Step 1: Write the failing tests**

Create `FinanceFacadeChickPurchaseTest.java`:

```java
package com.avicare.finance.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.finance.domain.Expense;
import com.avicare.finance.domain.ExpenseSource;
import com.avicare.finance.repository.ExpenseRepository;
import java.time.LocalDate;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;

/** Upsert semantics for the chick-purchase expense: one row per unit, created then corrected. */
class FinanceFacadeChickPurchaseTest {

  private ExpenseRepository expenseRepository;
  private FinanceFacadeImpl facade;

  @BeforeEach
  void setUp() {
    expenseRepository = Mockito.mock(ExpenseRepository.class);
    FinanceAnalyticsService analyticsService = Mockito.mock(FinanceAnalyticsService.class);
    facade = new FinanceFacadeImpl(expenseRepository, analyticsService);
  }

  @Test
  void recordChickPurchaseExpense_insertsANewExpense_whenNoneExistsYet() {
    when(expenseRepository.findByFarmIdAndProductionUnitIdAndSource(
            7L, 42L, ExpenseSource.CHICK_PURCHASE))
        .thenReturn(Optional.empty());

    facade.recordChickPurchaseExpense(7L, 42L, 500_000L, LocalDate.of(2026, 1, 10), 3L);

    ArgumentCaptor<Expense> captor = ArgumentCaptor.forClass(Expense.class);
    verify(expenseRepository).save(captor.capture());
    Expense saved = captor.getValue();
    assertThat(saved.getFarmId()).isEqualTo(7L);
    assertThat(saved.getProductionUnitId()).isEqualTo(42L);
    assertThat(saved.getCategoryKey()).isEqualTo("chicks");
    assertThat(saved.getAmountXof()).isEqualTo(500_000L);
    assertThat(saved.getExpenseDate()).isEqualTo(LocalDate.of(2026, 1, 10));
    assertThat(saved.getSource()).isEqualTo(ExpenseSource.CHICK_PURCHASE);
    assertThat(saved.getCreatedBy()).isEqualTo(3L);
  }

  @Test
  void recordChickPurchaseExpense_updatesTheExistingExpense_ratherThanDuplicating() {
    Expense existing = new Expense();
    existing.setId(99L);
    existing.setFarmId(7L);
    existing.setProductionUnitId(42L);
    existing.setSource(ExpenseSource.CHICK_PURCHASE);
    existing.setAmountXof(400_000L);
    when(expenseRepository.findByFarmIdAndProductionUnitIdAndSource(
            7L, 42L, ExpenseSource.CHICK_PURCHASE))
        .thenReturn(Optional.of(existing));

    facade.recordChickPurchaseExpense(7L, 42L, 550_000L, LocalDate.of(2026, 1, 10), 3L);

    verify(expenseRepository, times(1)).save(any(Expense.class));
    ArgumentCaptor<Expense> captor = ArgumentCaptor.forClass(Expense.class);
    verify(expenseRepository).save(captor.capture());
    assertThat(captor.getValue().getId()).isEqualTo(99L); // same row, not a new one
    assertThat(captor.getValue().getAmountXof()).isEqualTo(550_000L);
  }

  @Test
  void recordChickPurchaseExpense_doesNothing_whenAmountIsNotPositive() {
    facade.recordChickPurchaseExpense(7L, 42L, 0L, LocalDate.now(), 3L);

    verify(expenseRepository, never()).save(any());
  }

  @Test
  void chickPurchaseCostForUnit_returnsTheAmount_whenAnExpenseExists() {
    Expense existing = new Expense();
    existing.setAmountXof(500_000L);
    when(expenseRepository.findByFarmIdAndProductionUnitIdAndSource(
            7L, 42L, ExpenseSource.CHICK_PURCHASE))
        .thenReturn(Optional.of(existing));

    assertThat(facade.chickPurchaseCostForUnit(7L, 42L)).contains(500_000L);
  }

  @Test
  void chickPurchaseCostForUnit_isEmpty_whenNoneRecorded() {
    when(expenseRepository.findByFarmIdAndProductionUnitIdAndSource(
            7L, 42L, ExpenseSource.CHICK_PURCHASE))
        .thenReturn(Optional.empty());

    assertThat(facade.chickPurchaseCostForUnit(7L, 42L)).isEmpty();
  }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && ./mvnw -pl avicare-app -am test-compile`
Expected: compile failure — `recordChickPurchaseExpense`/`chickPurchaseCostForUnit` do not exist yet on `FinanceFacade`/`FinanceFacadeImpl`.

- [ ] **Step 3: Add the methods to the interface**

Edit `FinanceFacade.java` — add after `reverseVetVisitExpense`:

```java
  /**
   * Enregistre (ou corrige) la dépense d'achat des poussins d'une unité, catégorie {@code chicks},
   * source {@code CHICK_PURCHASE}. Upsert idempotent : une seule ligne par unité de production —
   * une correction met à jour la ligne existante plutôt que d'en créer une seconde. No-op si
   * {@code amountXof <= 0}.
   */
  void recordChickPurchaseExpense(
      Long farmId, Long productionUnitId, long amountXof, LocalDate date, Long userId);

  /**
   * Montant de la dépense d'achat des poussins déjà enregistrée pour cette unité, ou vide si
   * aucune n'existe encore.
   */
  java.util.Optional<Long> chickPurchaseCostForUnit(Long farmId, Long productionUnitId);
```

- [ ] **Step 4: Implement in `FinanceFacadeImpl`**

Edit `FinanceFacadeImpl.java` — add the import `java.util.Optional` (add to existing imports), and add after `reverseVetVisitExpense`:

```java
  @Override
  @Transactional
  public void recordChickPurchaseExpense(
      Long farmId, Long productionUnitId, long amountXof, LocalDate date, Long userId) {
    if (amountXof <= 0) return;

    Expense expense =
        expenseRepository
            .findByFarmIdAndProductionUnitIdAndSource(
                farmId, productionUnitId, ExpenseSource.CHICK_PURCHASE)
            .orElseGet(Expense::new);
    expense.setFarmId(farmId);
    expense.setCategoryKey("chicks");
    expense.setAmountXof(amountXof);
    expense.setExpenseDate(date);
    expense.setLabel("Achat de poussins");
    expense.setSource(ExpenseSource.CHICK_PURCHASE);
    expense.setProductionUnitId(productionUnitId);
    expense.setCreatedBy(userId);
    expenseRepository.save(expense);
  }

  @Override
  @Transactional(readOnly = true)
  public Optional<Long> chickPurchaseCostForUnit(Long farmId, Long productionUnitId) {
    return expenseRepository
        .findByFarmIdAndProductionUnitIdAndSource(
            farmId, productionUnitId, ExpenseSource.CHICK_PURCHASE)
        .map(Expense::getAmountXof);
  }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && ./mvnw -pl avicare-app -am clean test-compile && ./mvnw -pl avicare-app test -Dtest=FinanceFacadeChickPurchaseTest,FinanceFacadeUnitExpensesTest`
Expected: BUILD SUCCESS, all tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/avicare-app/src/main/java/com/avicare/finance/api/FinanceFacade.java \
  backend/avicare-app/src/main/java/com/avicare/finance/service/FinanceFacadeImpl.java \
  backend/avicare-app/src/test/java/com/avicare/finance/service/FinanceFacadeChickPurchaseTest.java
git commit -m "feat(finance): enregistrer et lire le coût d'achat des poussins d'une unité"
```

---

### Task 3: Enregistrer le coût à la création d'une bande (backend)

**Files:**
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/poultry/PoultryBatchCreate.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/dto/request/CreatePoultryBatchRequest.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/dto/response/PoultryBatchResponse.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/poultry/PoultryBatchService.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/controller/PoultryBatchController.java`
- Test: `backend/avicare-app/src/test/java/com/avicare/livestock/poultry/PoultryBatchServiceIT.java`

**Interfaces:**
- Consumes: `FinanceFacade.recordChickPurchaseExpense(...)` / `chickPurchaseCostForUnit(...)` from Task 2.
- Produces: `PoultryBatchCreate.chickUnitPriceXof()` (nullable, 8th component); `PoultryBatchResponse.chickPurchaseCostXof` (nullable) — consumed by Task 4's controller wiring and by the web/mobile create dialogs (Tasks 6, 8).

- [ ] **Step 1: Write the failing test**

Add to `PoultryBatchServiceIT.java` (same file — it already autowires `poultryBatchService`, `em`, `userId` via `seedFarm()`; add `@Autowired private FinanceFacade financeFacade;` to the field list and `import com.avicare.finance.api.FinanceFacade;` to the imports):

```java
  @Test
  void create_withChickUnitPrice_recordsTheChickPurchaseExpense() {
    long farmId = seedFarm();

    PoultryBatch batch =
        poultryBatchService.create(
            new PoultryBatchCreate(
                farmId, cobbBreedId(), "Lot C", LocalDate.now(), 2200, 42, 500, 300L),
            userId);
    em.flush();

    // 500 head x 300 XOF/head = 150 000 XOF.
    assertThat(financeFacade.chickPurchaseCostForUnit(farmId, batch.getId()))
        .contains(150_000L);
  }

  @Test
  void create_withoutChickUnitPrice_recordsNoExpense() {
    long farmId = seedFarm();

    PoultryBatch batch =
        poultryBatchService.create(
            new PoultryBatchCreate(farmId, cobbBreedId(), "Lot D", LocalDate.now(), null, null, 500),
            userId);
    em.flush();

    assertThat(financeFacade.chickPurchaseCostForUnit(farmId, batch.getId())).isEmpty();
  }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && ./mvnw -pl avicare-app -am test-compile`
Expected: compile failure — the 8-arg `PoultryBatchCreate(...)` constructor does not exist yet.

- [ ] **Step 3: Widen `PoultryBatchCreate` (backward-compatible — 9 existing call sites stay untouched)**

Replace the whole file `PoultryBatchCreate.java`:

```java
package com.avicare.livestock.poultry;

import java.time.LocalDate;

/**
 * Command to create a {@link com.avicare.livestock.domain.PoultryBatch broiler batch}.
 *
 * <p>{@code chickUnitPriceXof} is optional (nullable) — the price paid per chick, used to record a
 * {@code CHICK_PURCHASE} expense at creation time. The secondary 7-arg constructor exists purely
 * to keep the 9 pre-existing positional call sites compiling; new callers should use the canonical
 * 8-arg constructor.
 */
public record PoultryBatchCreate(
    Long farmId,
    Long breedId,
    String name,
    LocalDate startDate,
    Integer targetWeightG,
    Integer targetAgeDays,
    int initialCount,
    Long chickUnitPriceXof) {

  public PoultryBatchCreate(
      Long farmId,
      Long breedId,
      String name,
      LocalDate startDate,
      Integer targetWeightG,
      Integer targetAgeDays,
      int initialCount) {
    this(farmId, breedId, name, startDate, targetWeightG, targetAgeDays, initialCount, null);
  }
}
```

- [ ] **Step 4: Add the field to the request DTO**

Edit `CreatePoultryBatchRequest.java`:

```java
package com.avicare.livestock.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

/**
 * Create a broiler batch on a farm.
 *
 * <p>{@code chickUnitPriceXof} is optional — the price paid per chick. When present, the service
 * records a {@code CHICK_PURCHASE} expense of {@code chickUnitPriceXof * initialCount}. {@code
 * @Positive} on a nullable field only validates when a value is actually supplied.
 */
public record CreatePoultryBatchRequest(
    @NotNull Long breedId,
    @Size(max = 200) String name,
    LocalDate startDate,
    Integer targetWeightG,
    Integer targetAgeDays,
    @Positive int initialCount,
    @Positive Long chickUnitPriceXof) {}
```

- [ ] **Step 5: Add the derived field to the response DTO**

Edit `PoultryBatchResponse.java`:

```java
package com.avicare.livestock.dto.response;

import com.avicare.livestock.domain.UnitStatus;
import java.time.LocalDate;

/**
 * HTTP view of a broiler batch.
 *
 * <p>{@code deaths} is served rather than left to the client: computing it as {@code initialCount -
 * currentCount} counts every sold bird as a dead one, and both mobile screens did exactly that.
 *
 * <p>{@code chickPurchaseCostXof} is resolved from the farm's expense ledger (not stored on the
 * batch itself) — {@code null} means no chick-purchase cost has been recorded yet. Resolved only on
 * single-batch reads ({@code get}/{@code create}/the new correction endpoint), never on the list
 * endpoint, to avoid an N+1 lookup the list screen does not need.
 */
public record PoultryBatchResponse(
    Long id,
    Long farmId,
    Long breedId,
    String name,
    LocalDate startDate,
    UnitStatus status,
    int currentCount,
    int initialCount,
    int deaths,
    Integer targetWeightG,
    Integer targetAgeDays,
    Long chickPurchaseCostXof) {}
```

- [ ] **Step 6: Wire the service**

Edit `PoultryBatchService.java` — add the import `com.avicare.finance.api.FinanceFacade`, add the field, and record the expense at the end of `create()`:

```java
  private final PoultryBatchRepository poultryBatchRepository;
  private final BreedRepository breedRepository;
  private final LifecycleEventRepository lifecycleEventRepository;
  private final FinanceFacade financeFacade;
```

```java
    created.setCreatedBy(currentUserId);
    lifecycleEventRepository.save(created);

    if (cmd.chickUnitPriceXof() != null && cmd.chickUnitPriceXof() > 0) {
      long amountXof = cmd.chickUnitPriceXof() * cmd.initialCount();
      financeFacade.recordChickPurchaseExpense(
          cmd.farmId(), saved.getId(), amountXof, batch.getStartDate(), currentUserId);
    }

    return saved;
  }
```

(This replaces the existing `lifecycleEventRepository.save(created); return saved; }` tail of the method — everything before `if` is unchanged.)

- [ ] **Step 7: Wire the controller**

Edit `PoultryBatchController.java` — add the import `com.avicare.finance.api.FinanceFacade`, add the field, resolve `chickPurchaseCostXof` in `create()` and `get()`, and update `toResponse()`'s signature (used by all three callers):

```java
  private final PoultryBatchService poultryBatchService;
  private final LifecycleEventRepository lifecycleEventRepository;
  private final FinanceFacade financeFacade;
```

```java
  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize(WRITE)
  public ApiResponse<PoultryBatchResponse> create(
      @PathVariable Long farmId, @RequestBody @Valid CreatePoultryBatchRequest request) {
    PoultryBatch batch =
        poultryBatchService.create(
            new PoultryBatchCreate(
                farmId,
                request.breedId(),
                request.name(),
                request.startDate(),
                request.targetWeightG(),
                request.targetAgeDays(),
                request.initialCount(),
                request.chickUnitPriceXof()),
            TenancyContext.currentUserId());
    Long chickCost = financeFacade.chickPurchaseCostForUnit(farmId, batch.getId()).orElse(null);
    return ApiResponse.of(toResponse(batch, 0L, chickCost)); // a batch is born with no losses
  }

  @GetMapping("/{batchId}")
  @PreAuthorize(READ)
  public ApiResponse<PoultryBatchResponse> get(
      @PathVariable Long farmId, @PathVariable Long batchId) {
    PoultryBatch batch = poultryBatchService.get(batchId);
    Long chickCost = financeFacade.chickPurchaseCostForUnit(farmId, batchId).orElse(null);
    return ApiResponse.of(
        toResponse(batch, -lifecycleEventRepository.sumMortalityDelta(batchId), chickCost));
  }
```

```java
  static PoultryBatchResponse toResponse(PoultryBatch b, long deaths, Long chickPurchaseCostXof) {
    return new PoultryBatchResponse(
        b.getId(),
        b.getFarmId(),
        b.getBreedId(),
        b.getName(),
        b.getStartDate(),
        b.getStatus(),
        b.getCurrentCount(),
        b.getInitialCount(),
        (int) deaths,
        b.getTargetWeightG(),
        b.getTargetAgeDays(),
        chickPurchaseCostXof);
  }
```

And update the `list()` method's single call site to pass `null` (list rows never resolve it, per the response DTO's Javadoc):

```java
    return ApiResponse.of(
        batches.stream()
            .map(b -> toResponse(b, deathsByUnit.getOrDefault(b.getId(), 0L), null))
            .toList());
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `cd backend && ./mvnw -pl avicare-app -am clean compile test-compile`
Expected: BUILD SUCCESS (Testcontainers-based `PoultryBatchServiceIT` cannot run locally without Docker — verify compile only, per this codebase's documented Testcontainers limitation; CI runs it for real).

- [ ] **Step 9: Commit**

```bash
git add backend/avicare-app/src/main/java/com/avicare/livestock/poultry/PoultryBatchCreate.java \
  backend/avicare-app/src/main/java/com/avicare/livestock/dto/request/CreatePoultryBatchRequest.java \
  backend/avicare-app/src/main/java/com/avicare/livestock/dto/response/PoultryBatchResponse.java \
  backend/avicare-app/src/main/java/com/avicare/livestock/poultry/PoultryBatchService.java \
  backend/avicare-app/src/main/java/com/avicare/livestock/controller/PoultryBatchController.java \
  backend/avicare-app/src/test/java/com/avicare/livestock/poultry/PoultryBatchServiceIT.java
git commit -m "feat(livestock): enregistrer le coût des poussins à la création d'une bande"
```

---

### Task 4: Action dédiée « renseigner/corriger le coût » (backend)

**Files:**
- Create: `backend/avicare-app/src/main/java/com/avicare/livestock/dto/request/SetChickCostRequest.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/poultry/PoultryBatchService.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/controller/PoultryBatchController.java`
- Test: `backend/avicare-app/src/test/java/com/avicare/livestock/poultry/PoultryBatchServiceIT.java`

**Interfaces:**
- Consumes: `FinanceFacade.recordChickPurchaseExpense(...)` (Task 2), `PoultryBatchController.toResponse(...)` (Task 3, now 3-arg).
- Produces: `PoultryBatchService.setChickCost(Long farmId, Long batchId, long chickUnitPriceXof, Long userId)`; `POST /api/v1/farms/{farmId}/poultry-batches/{batchId}/chick-cost` — consumed by web Task 7 and mobile Task 10.

- [ ] **Step 1: Write the failing tests**

Add to `PoultryBatchServiceIT.java`:

```java
  @Test
  void setChickCost_recordsTheExpense_andIsCallableAgainToCorrectIt() {
    long farmId = seedFarm();
    PoultryBatch batch =
        poultryBatchService.create(
            new PoultryBatchCreate(farmId, cobbBreedId(), "Lot E", LocalDate.now(), null, null, 200),
            userId);
    em.flush();

    poultryBatchService.setChickCost(farmId, batch.getId(), 250L, userId);
    assertThat(financeFacade.chickPurchaseCostForUnit(farmId, batch.getId())).contains(50_000L);

    // Correction: same unit, different price — replaces, does not add a second expense.
    poultryBatchService.setChickCost(farmId, batch.getId(), 300L, userId);
    assertThat(financeFacade.chickPurchaseCostForUnit(farmId, batch.getId())).contains(60_000L);
  }

  @Test
  void setChickCost_refusesAUnitOfAnotherFarm() {
    long farmId = seedFarm();
    PoultryBatch batch =
        poultryBatchService.create(
            new PoultryBatchCreate(farmId, cobbBreedId(), "Lot F", LocalDate.now(), null, null, 100),
            userId);
    em.flush();

    assertThatThrownBy(() -> poultryBatchService.setChickCost(999_999L, batch.getId(), 250L, userId))
        .isInstanceOf(NotFoundException.class);
  }
```

(`assertThatThrownBy` is already statically imported in this file.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && ./mvnw -pl avicare-app -am test-compile`
Expected: compile failure — `PoultryBatchService.setChickCost` does not exist yet.

- [ ] **Step 3: Create the request DTO**

```java
package com.avicare.livestock.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

/** Body of the dedicated "record/correct the chick purchase cost" action. */
public record SetChickCostRequest(@NotNull @Positive Long chickUnitPriceXof) {}
```

- [ ] **Step 4: Add the service method**

Edit `PoultryBatchService.java` — add the import `com.avicare.common.api.exception.ConflictException`, and add after `create()`:

```java
  @Transactional
  public PoultryBatch setChickCost(Long farmId, Long batchId, long chickUnitPriceXof, Long userId) {
    PoultryBatch batch = get(batchId);
    if (!batch.getFarmId().equals(farmId)) {
      throw NotFoundException.of("PoultryBatch", batchId);
    }
    if (batch.getStatus() == UnitStatus.CLOSED) {
      throw new ConflictException(
          "BATCH_ALREADY_CLOSED", "Batch " + batchId + " is already closed");
    }
    long amountXof = chickUnitPriceXof * batch.getInitialCount();
    financeFacade.recordChickPurchaseExpense(
        farmId, batchId, amountXof, batch.getStartDate(), userId);
    return batch;
  }
```

- [ ] **Step 5: Add the endpoint**

Edit `PoultryBatchController.java` — add imports `com.avicare.livestock.dto.request.SetChickCostRequest`, and add after `get()`:

```java
  @PostMapping("/{batchId}/chick-cost")
  @PreAuthorize(WRITE)
  public ApiResponse<PoultryBatchResponse> setChickCost(
      @PathVariable Long farmId,
      @PathVariable Long batchId,
      @RequestBody @Valid SetChickCostRequest request) {
    PoultryBatch batch =
        poultryBatchService.setChickCost(
            farmId, batchId, request.chickUnitPriceXof(), TenancyContext.currentUserId());
    Long chickCost = financeFacade.chickPurchaseCostForUnit(farmId, batchId).orElse(null);
    return ApiResponse.of(
        toResponse(batch, -lifecycleEventRepository.sumMortalityDelta(batchId), chickCost));
  }
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd backend && ./mvnw -pl avicare-app -am clean compile test-compile`
Expected: BUILD SUCCESS (compile-verify only, per Testcontainers limitation — CI runs it for real).

- [ ] **Step 7: Commit**

```bash
git add backend/avicare-app/src/main/java/com/avicare/livestock/dto/request/SetChickCostRequest.java \
  backend/avicare-app/src/main/java/com/avicare/livestock/poultry/PoultryBatchService.java \
  backend/avicare-app/src/main/java/com/avicare/livestock/controller/PoultryBatchController.java \
  backend/avicare-app/src/test/java/com/avicare/livestock/poultry/PoultryBatchServiceIT.java
git commit -m "feat(livestock): action dédiée pour renseigner ou corriger le coût des poussins"
```

---

### Task 5: Intégration à la clôture — suppression du double comptage

**Files:**
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/closure/UnitClosureService.java`
- Test: `backend/avicare-app/src/test/java/com/avicare/livestock/closure/UnitClosureServiceTest.java`

**Interfaces:**
- Consumes: `FinanceFacade.chickPurchaseCostForUnit(...)` / `recordChickPurchaseExpense(...)` from Task 2.
- Produces: no new public interface — `UnitClosureService.close(...)` keeps its existing 5-arg signature; only its internal chick-cost resolution changes.

- [ ] **Step 1: Update the test setup and write the failing tests**

Edit `UnitClosureServiceTest.java` — add the import `java.util.Optional` (already imported for `Optional.empty()`/`Optional.of` usage), and in `@BeforeEach` add a default stub right after the existing `financeFacade` mock creation line:

```java
    lenient()
        .when(financeFacade.chickPurchaseCostForUnit(7L, 42L))
        .thenReturn(Optional.empty());
```

Then update the existing `close_freezesRevenueMinusCosts` test to also assert the fallback now records the expense (replace the whole method):

```java
  @Test
  void close_freezesRevenueMinusCosts() {
    // 1 800 000 in, 900 000 feed + 250 000 chicks + 90 000 other = 1 240 000 out.
    // 980 birds produced at 2000 g = 1960 kg -> 1 240 000 / 1960 = 633 XOF per kg.
    UnitClosure closure = service.close(7L, 42L, 250_000L, null, 3L);

    assertThat(closure.getRevenueXof()).isEqualTo(1_800_000L);
    assertThat(closure.getTotalCostXof()).isEqualTo(1_240_000L);
    assertThat(closure.getMarginXof()).isEqualTo(560_000L);
    assertThat(closure.getDeaths()).isEqualTo(20);
    assertThat(closure.getInitialCount()).isEqualTo(1000);
    assertThat(closure.getRemainingCount()).isEqualTo(180);
    assertThat(closure.getMortalityPercent()).isEqualByComparingTo("2.00");
    assertThat(closure.getCostPerKgXof()).isEqualTo(633);
    // Fallback path (no CHICK_PURCHASE expense recorded yet): the manual value is recorded via
    // the facade too, so it becomes visible in the farm-wide P&L, not just this frozen bilan.
    verify(financeFacade)
        .recordChickPurchaseExpense(7L, 42L, 250_000L, LocalDate.now(), 3L);
  }
```

And add two new tests after `close_withoutChickCost_countsItAsZero`:

```java
  @Test
  void close_usesTheRecordedChickPurchaseExpense_ignoringTheManualFallback() {
    when(financeFacade.chickPurchaseCostForUnit(7L, 42L)).thenReturn(Optional.of(300_000L));

    // A manual value is still passed (as if the farmer typed one out of habit) — it must be
    // ignored: the already-recorded expense wins, and it must not be recorded a second time.
    UnitClosure closure = service.close(7L, 42L, 999_999L, null, 3L);

    assertThat(closure.getChickCostXof()).isEqualTo(300_000L);
    // 900 000 feed + 300 000 chicks + 90 000 other = 1 290 000.
    assertThat(closure.getTotalCostXof()).isEqualTo(1_290_000L);
    verify(financeFacade, never())
        .recordChickPurchaseExpense(anyLong(), anyLong(), anyLong(), any(), anyLong());
  }

  @Test
  void close_withoutChickCostAndNoManualFallback_recordsNothing() {
    UnitClosure closure = service.close(7L, 42L, null, null, 3L);

    assertThat(closure.getChickCostXof()).isZero();
    verify(financeFacade, never())
        .recordChickPurchaseExpense(anyLong(), anyLong(), anyLong(), any(), anyLong());
  }
```

(`anyLong()` is already statically imported; this file needs one more static import added: `import static org.mockito.ArgumentMatchers.anyLong;` is already present — verify `any()` for the generic-typed `LocalDate` argument matches the existing `any()` import, already present too.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && ./mvnw -pl avicare-app -am test-compile`
Expected: `close_usesTheRecordedChickPurchaseExpense...` fails — `close()` does not yet call `chickPurchaseCostForUnit`, so the mocked `Optional.of(300_000L)` is never consulted and the manual `999_999L` is used verbatim instead.

- [ ] **Step 3: Change the resolution logic in `close()`**

Edit `UnitClosureService.java` — add the import `java.util.Optional` (already imported? check: not currently imported — add it), and replace this block:

```java
    long revenueXof = commercialFacade.revenueByProductionUnit(farmId, unitId);
    UnitCostService.FeedCost feed = unitCostService.feedCost(unitId);
    long chickCost = chickCostXof != null ? chickCostXof : 0L;
    long otherExpenseXof = financeFacade.directExpensesForUnit(farmId, unitId);
    long totalCostXof = feed.costXof() + chickCost + otherExpenseXof;
```

with:

```java
    long revenueXof = commercialFacade.revenueByProductionUnit(farmId, unitId);
    UnitCostService.FeedCost feed = unitCostService.feedCost(unitId);
    long chickCost = resolveChickCost(farmId, unitId, chickCostXof, today, userId);
    long otherExpenseXof = financeFacade.directExpensesForUnit(farmId, unitId);
    long totalCostXof = feed.costXof() + chickCost + otherExpenseXof;
```

Then add this private method (e.g. right after `close()`):

```java
  /**
   * Resolves the chick-purchase cost for the closure bilan: a {@code CHICK_PURCHASE} expense
   * already recorded (at reception or corrected since) always wins. Only when none exists does the
   * manual closure-form fallback apply — and when it does, it is itself recorded as a real expense
   * via the facade, so it stops being invisible outside this one frozen bilan.
   */
  private long resolveChickCost(
      Long farmId, Long unitId, Long manualChickCostXof, LocalDate today, Long userId) {
    Optional<Long> recorded = financeFacade.chickPurchaseCostForUnit(farmId, unitId);
    if (recorded.isPresent()) {
      return recorded.get();
    }
    long fallback = manualChickCostXof != null ? manualChickCostXof : 0L;
    if (fallback > 0) {
      financeFacade.recordChickPurchaseExpense(farmId, unitId, fallback, today, userId);
    }
    return fallback;
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && ./mvnw -pl avicare-app -am clean compile test-compile && ./mvnw -pl avicare-app test -Dtest=UnitClosureServiceTest`
Expected: BUILD SUCCESS, all tests pass (including the pre-existing ones, unaffected by this change in every case where no `CHICK_PURCHASE` expense is mocked as present).

- [ ] **Step 5: Commit**

```bash
git add backend/avicare-app/src/main/java/com/avicare/livestock/closure/UnitClosureService.java \
  backend/avicare-app/src/test/java/com/avicare/livestock/closure/UnitClosureServiceTest.java
git commit -m "fix(livestock): la clôture lit le coût des poussins déjà enregistré, sans le recompter"
```

---

### Task 6: Web — saisie du coût à la création d'une bande

**Files:**
- Modify: `web/src/types/index.ts`
- Modify: `web/src/store/api/poultryBatchesApi.ts`
- Modify: `web/src/components/poultry/CreateBatchDialog.tsx`
- Test: `web/src/components/poultry/CreateBatchDialog.test.tsx` (create if it does not exist yet — check first)

**Interfaces:**
- Consumes: `POST /api/v1/farms/{farmId}/poultry-batches` now accepting `chickUnitPriceXof` (Task 3).
- Produces: `PoultryBatch.chickPurchaseCostXof: number | null`; `CreateBatchInput.chickUnitPriceXof?: number` — consumed by Task 7's display/correction dialog.

- [ ] **Step 1: Check for an existing test file**

Run: `ls web/src/components/poultry/CreateBatchDialog.test.tsx 2>/dev/null || echo "none"`

If it exists, read it fully before editing — match its existing setup/mock conventions rather than the sketch below. If it prints `none`, create it fresh using the sketch in Step 4.

- [ ] **Step 2: Update the types**

Edit `web/src/types/index.ts` — in the `PoultryBatch` interface, add after `targetAgeDays: number | null;`:

```typescript
  /**
   * Resolved from the farm's expense ledger, not stored on the batch. `null` = no chick-purchase
   * cost recorded yet.
   */
  chickPurchaseCostXof: number | null;
```

And in `CreateBatchInput`, add after `initialCount: number;`:

```typescript
  chickUnitPriceXof?: number;
```

- [ ] **Step 3: Wire the create-batch dialog**

Edit `CreateBatchDialog.tsx`:

```typescript
const schema = z.object({
  name: z.string().max(200, "200 caractères maximum").optional().or(z.literal("")),
  breedId: z.string().refine((v) => Number(v) > 0, "Souche requise"),
  startDate: z.string().min(1, "Date requise"),
  initialCount: z
    .string()
    .regex(/^\d+$/, "Effectif requis")
    .refine((v) => Number(v) > 0, "Effectif requis"),
  targetWeightG: z.string().regex(/^\d+$/, "Nombre invalide"),
  targetAgeDays: z.string().regex(/^\d+$/, "Nombre invalide"),
  chickUnitPriceXof: z.string().regex(/^\d*$/, "Nombre entier requis").optional().or(z.literal("")),
});

type BatchForm = z.infer<typeof schema>;

const DEFAULTS: BatchForm = {
  name: "",
  breedId: "",
  startDate: today(),
  initialCount: "",
  targetWeightG: "2000",
  targetAgeDays: "42",
  chickUnitPriceXof: "",
};
```

In `onSubmit`, add the field to the payload (spread conditionally, matching the pattern used elsewhere in this codebase for optional numeric fields):

```typescript
  const onSubmit = async (values: BatchForm) => {
    try {
      await createBatch({
        farmId,
        body: {
          breedId: Number(values.breedId),
          name: values.name || undefined,
          startDate: values.startDate,
          initialCount: Number(values.initialCount),
          targetWeightG: Number(values.targetWeightG),
          targetAgeDays: Number(values.targetAgeDays),
          ...(values.chickUnitPriceXof
            ? { chickUnitPriceXof: Number(values.chickUnitPriceXof) }
            : {}),
        },
      }).unwrap();
      showToast("Lot créé avec succès.", "success");
      onClose();
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };
```

Add the field to the form, in the "Démarrage" section, right after the `initialCount`/`startDate` `Box` (a new `Controller` block using `useWatch` to compute the live total — import `useWatch` from `react-hook-form` alongside the existing `Controller, useForm`):

```typescript
import { Controller, useForm, useWatch } from "react-hook-form";
```

```typescript
  const chickUnitPriceXof = useWatch({ control, name: "chickUnitPriceXof" });
  const initialCountWatched = useWatch({ control, name: "initialCount" });
  const chickTotal =
    chickUnitPriceXof && initialCountWatched
      ? Number(chickUnitPriceXof) * Number(initialCountWatched)
      : null;
```

```typescript
            <Controller
              name="chickUnitPriceXof"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Prix par poussin (FCFA)"
                  placeholder="Optionnel"
                  fullWidth
                  slotProps={{ htmlInput: { inputMode: "numeric" } }}
                  error={!!fieldState.error}
                  helperText={
                    fieldState.error?.message ??
                    (chickTotal != null
                      ? `Total : ${chickTotal.toLocaleString("fr-FR")} FCFA`
                      : "Optionnel — modifiable plus tard depuis la fiche du lot.")
                  }
                />
              )}
            />
```

(Place this `Controller` right after the closing `</Box>` of the "Démarrage" section's `startDate`/`initialCount` row, before the "Objectifs de sortie" `SectionLabel`.)

- [ ] **Step 4: Add tests**

If Step 1 found no existing test file, create `CreateBatchDialog.test.tsx` following this codebase's established RTL/vitest conventions for a MUI dialog wired to RTK Query (mirror `QuickSaleDialog.test.tsx`'s `setupFetch`/`respond` helper pattern: stub `fetch`, capture the POST body). At minimum, cover:

```typescript
it("envoie chickUnitPriceXof quand un prix est saisi", async () => {
  // render the dialog, fill breed/effectif/date as required, type "300" into
  // "Prix par poussin (FCFA)", submit, and assert the captured POST body
  // contains chickUnitPriceXof: 300.
});

it("n'envoie pas chickUnitPriceXof quand le champ est laissé vide", async () => {
  // same flow, leave the price field empty, assert the captured POST body has
  // no chickUnitPriceXof key at all.
});
```

Write the actual test bodies against this codebase's real breed-catalog and farm-fixture mocks (read `QuickSaleDialog.test.tsx` and any existing `CreateBatchDialog` fixtures first for the exact shape).

- [ ] **Step 5: Run tests**

Run: `cd web && npx tsc --noEmit && npx vitest run src/components/poultry/CreateBatchDialog.test.tsx`
Expected: clean tsc, all tests pass.

- [ ] **Step 6: Commit**

```bash
git add web/src/types/index.ts web/src/store/api/poultryBatchesApi.ts \
  web/src/components/poultry/CreateBatchDialog.tsx \
  web/src/components/poultry/CreateBatchDialog.test.tsx
git commit -m "feat(web): saisir le prix des poussins à la création d'une bande"
```

---

### Task 7: Web — affichage, correction, et clôture sans ressaisie

**Files:**
- Create: `web/src/components/poultry/ChickCostDialog.tsx`
- Modify: `web/src/store/api/poultryBatchesApi.ts`
- Modify: `web/src/components/poultry/BatchOverviewTab.tsx`
- Modify: `web/src/components/poultry/PoultryBatchDetailView.tsx`
- Modify: `web/src/components/poultry/CloseBatchDialog.tsx`
- Test: `web/src/components/poultry/ChickCostDialog.test.tsx` (new)
- Test: `web/src/components/poultry/CloseBatchDialog.test.tsx` (check first; extend or create)

**Interfaces:**
- Consumes: `POST /api/v1/farms/{farmId}/poultry-batches/{batchId}/chick-cost` (Task 4); `PoultryBatch.chickPurchaseCostXof` (Task 6).
- Produces: `useSetChickCostMutation` (RTK Query hook) — used only within this task's own new dialog.

- [ ] **Step 1: Add the mutation to the API slice**

Edit `poultryBatchesApi.ts` — add after `createBatch`:

```typescript
    setChickCost: build.mutation<
      PoultryBatch,
      { farmId: number; batchId: number; body: { chickUnitPriceXof: number } }
    >({
      query: ({ farmId, batchId, body }) => ({
        url: `${base(farmId)}/${batchId}/chick-cost`,
        method: "POST",
        body,
      }),
      transformResponse: (r: ApiEnvelope<PoultryBatch>) => r.data,
      invalidatesTags: (_r, _e, { batchId }) => [{ type: "PoultryBatch", id: batchId }],
    }),
```

And export `useSetChickCostMutation` alongside the existing exports at the bottom of the file.

- [ ] **Step 2: Write the failing test for the new dialog**

Create `ChickCostDialog.test.tsx`:

```typescript
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { ChickCostDialog } from "./ChickCostDialog";

let lastBody: Record<string, unknown> | null = null;
let lastMethod = "";
let lastUrl = "";

function respond(data: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify({ data }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function setupFetch() {
  lastBody = null;
  lastMethod = "";
  lastUrl = "";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      lastUrl = url;
      lastMethod = input instanceof Request ? input.method : (init?.method ?? "GET");
      if (input instanceof Request) {
        try {
          lastBody = await input.clone().json();
        } catch {
          /* no body */
        }
      } else if (init?.body) {
        lastBody = JSON.parse(init.body as string);
      }
      return respond({ id: 42, chickPurchaseCostXof: 90_000 });
    }),
  );
}

describe("ChickCostDialog", () => {
  beforeEach(() => setupFetch());
  afterEach(() => vi.unstubAllGlobals());

  it("envoie chickUnitPriceXof et ferme le dialogue", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(
      <ChickCostDialog
        open
        onClose={onClose}
        farmId={1}
        batchId={42}
        initialCount={500}
        currentValueXof={null}
      />,
    );

    await user.type(screen.getByLabelText("Prix par poussin (FCFA)"), "300");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => expect(lastMethod).toBe("POST"));
    expect(lastUrl).toContain("/poultry-batches/42/chick-cost");
    expect(lastBody).toEqual({ chickUnitPriceXof: 300 });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("pré-remplit le prix unitaire déjà enregistré pour permettre une correction", async () => {
    renderWithProviders(
      <ChickCostDialog
        open
        onClose={vi.fn()}
        farmId={1}
        batchId={42}
        initialCount={500}
        currentValueXof={150_000}
      />,
    );

    expect(screen.getByLabelText("Prix par poussin (FCFA)")).toHaveValue("300");
    expect(screen.getByText("Modifier le coût des poussins")).toBeInTheDocument();
  });
});
```

(`renderWithProviders` is the same test helper `QuickSaleDialog.test.tsx` uses — read `web/src/test/render.tsx` if its exact export shape differs from this usage.)

- [ ] **Step 3: Run test to verify it fails**

Run: `cd web && npx vitest run src/components/poultry/ChickCostDialog.test.tsx`
Expected: fails — `ChickCostDialog` does not exist yet.

- [ ] **Step 4: Create the dialog**

```typescript
"use client";

import { useEffect, useState } from "react";
import {
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
import { useSetChickCostMutation } from "@/store/api/poultryBatchesApi";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";

/**
 * Renseigner ou corriger le prix par poussin d'une bande — action dédiée, jamais un formulaire
 * d'édition générique de la bande. Le prix unitaire déjà enregistré (dérivé du montant total et de
 * l'effectif initial) est pré-rempli pour permettre une correction.
 */
export function ChickCostDialog({
  open,
  onClose,
  farmId,
  batchId,
  initialCount,
  currentValueXof,
}: {
  open: boolean;
  onClose: () => void;
  farmId: number;
  batchId: number;
  initialCount: number;
  currentValueXof: number | null;
}) {
  const { showToast } = useToast();
  const [setChickCost, { isLoading }] = useSetChickCostMutation();
  const [unitPrice, setUnitPrice] = useState("");

  useEffect(() => {
    if (open) {
      setUnitPrice(
        currentValueXof != null && initialCount > 0
          ? String(Math.round(currentValueXof / initialCount))
          : "",
      );
    }
  }, [open, currentValueXof, initialCount]);

  const valid = /^\d+$/.test(unitPrice) && Number(unitPrice) > 0;
  const total = valid ? Number(unitPrice) * initialCount : null;

  const submit = async () => {
    if (!valid) return;
    try {
      await setChickCost({
        farmId,
        batchId,
        body: { chickUnitPriceXof: Number(unitPrice) },
      }).unwrap();
      showToast("Coût des poussins enregistré.", "success");
      onClose();
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle component="div" sx={{ pr: 6 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {currentValueXof != null ? "Modifier le coût des poussins" : "Renseigner le coût des poussins"}
        </Typography>
        <IconButton
          onClick={onClose}
          aria-label="Fermer"
          sx={{ position: "absolute", top: 12, right: 12 }}
        >
          <X size={18} />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <TextField
            label="Prix par poussin (FCFA)"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value.replace(/[^0-9]/g, ""))}
            fullWidth
            autoFocus
            slotProps={{ htmlInput: { inputMode: "numeric" } }}
            helperText={total != null ? `Total : ${total.toLocaleString("fr-FR")} FCFA` : undefined}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} color="inherit">
          Annuler
        </Button>
        <Button
          onClick={submit}
          variant="contained"
          color="primary"
          disabled={!valid || isLoading}
          startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : null}
        >
          Enregistrer
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

- [ ] **Step 5: Wire the display + action into the batch overview**

Edit `BatchOverviewTab.tsx` — add a card showing the recorded cost (or a call to action) right after the KPI row's closing `</Box>` (before the "Growth + maturity" `Box`). Import `ChickCostDialog` and `useState`:

```typescript
import { useState } from "react";
```

```typescript
import { ChickCostDialog } from "./ChickCostDialog";
```

```typescript
export function BatchOverviewTab({
  farmId,
  batch,
}: {
  farmId: number;
  batch: PoultryBatch;
}) {
  const [chickCostOpen, setChickCostOpen] = useState(false);
  const { data: perf } = useGetPerformanceQuery(
```

(the rest of the existing hook calls stay unchanged), then after the KPI-row `Box` closes:

```typescript
      {/* Chick purchase cost — recorded at reception, or here if not yet known. */}
      <Card>
        <CardContent>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}
          >
            <Box>
              <Typography variant="body2" color="text.secondary">
                Coût des poussins
              </Typography>
              {batch.chickPurchaseCostXof != null ? (
                <Typography sx={{ ...monoSx, fontSize: "1.25rem" }}>
                  {batch.chickPurchaseCostXof.toLocaleString("fr-FR")} FCFA
                  <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                    ({Math.round(batch.chickPurchaseCostXof / batch.initialCount).toLocaleString("fr-FR")} FCFA/poussin)
                  </Typography>
                </Typography>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Non renseigné
                </Typography>
              )}
            </Box>
            <Button variant="outlined" size="small" onClick={() => setChickCostOpen(true)}>
              {batch.chickPurchaseCostXof != null ? "Modifier" : "Renseigner"}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <ChickCostDialog
        open={chickCostOpen}
        onClose={() => setChickCostOpen(false)}
        farmId={farmId}
        batchId={batch.id}
        initialCount={batch.initialCount}
        currentValueXof={batch.chickPurchaseCostXof}
      />
```

Add `Button` to the existing MUI import list at the top of the file.

`PoultryBatchDetailView.tsx` needs no change — `BatchOverviewTab` already receives the full `batch` object.

- [ ] **Step 6: Make the closure dialog read-only when a cost is already recorded**

Edit `CloseBatchDialog.tsx` — add a `chickPurchaseCostXof: number | null` prop, and branch the chick-cost field:

```typescript
export function CloseBatchDialog({
  open,
  onClose,
  farmId,
  unitId,
  batchName,
  remainingCount,
  chickPurchaseCostXof,
}: {
  open: boolean;
  onClose: () => void;
  farmId: number;
  unitId: number;
  batchName: string;
  remainingCount: number;
  chickPurchaseCostXof: number | null;
}) {
```

Replace the `Controller name="chickCostXof"` block's rendering: when `chickPurchaseCostXof != null`, show a read-only summary instead of the editable field, and drop `chickCostXof` from the submit payload in that case:

```typescript
            {chickPurchaseCostXof != null ? (
              <Box
                sx={{
                  p: 2,
                  borderRadius: 1,
                  bgcolor: (t) => t.palette.action.hover,
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  Coût des poussins (déjà enregistré)
                </Typography>
                <Typography sx={{ fontWeight: 700 }}>
                  {chickPurchaseCostXof.toLocaleString("fr-FR")} FCFA
                </Typography>
              </Box>
            ) : (
              <Controller
                name="chickCostXof"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="Coût des poussins"
                    placeholder="Optionnel"
                    fullWidth
                    error={!!fieldState.error}
                    helperText={
                      fieldState.error?.message ??
                      "Non enregistré ailleurs dans l'application. Sans lui, le coût est sous-estimé."
                    }
                    slotProps={{
                      input: {
                        endAdornment: <InputAdornment position="end">F CFA</InputAdornment>,
                      },
                    }}
                  />
                )}
              />
            )}
```

And in `onSubmit`, only send `chickCostXof` when there is no already-recorded cost:

```typescript
  const onSubmit = async (values: CloseForm) => {
    try {
      await closeUnit({
        farmId,
        unitId,
        body: {
          ...(chickPurchaseCostXof == null
            ? { chickCostXof: values.chickCostXof ? Number(values.chickCostXof) : undefined }
            : {}),
          notes: values.notes || undefined,
        },
      }).unwrap();
      showToast("Bande clôturée. Le bilan est figé.", "success");
      onClose();
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };
```

Then update `PoultryBatchDetailView.tsx`'s `<CloseBatchDialog .../>` call site to pass the new prop:

```typescript
      <CloseBatchDialog
        open={closeOpen}
        onClose={() => setCloseOpen(false)}
        farmId={farmId as number}
        unitId={batch.id}
        batchName={title}
        remainingCount={batch.currentCount}
        chickPurchaseCostXof={batch.chickPurchaseCostXof}
      />
```

- [ ] **Step 7: Extend/add the closure dialog test**

Run `ls web/src/components/poultry/CloseBatchDialog.test.tsx 2>/dev/null || echo none` first. If it exists, read it and add two cases (mirroring its existing setup): one asserting the manual field is hidden and no `chickCostXof` key is sent when `chickPurchaseCostXof` is non-null, one asserting the existing editable-field behavior is unchanged when it's `null`. If it doesn't exist, write a minimal one covering exactly those two cases using this codebase's established RTL/vitest dialog-test conventions.

- [ ] **Step 8: Run tests**

Run: `cd web && npx tsc --noEmit && npx vitest run src/components/poultry/`
Expected: clean tsc, all tests in the `poultry` directory pass, no regressions.

- [ ] **Step 9: Commit**

```bash
git add web/src/components/poultry/ChickCostDialog.tsx web/src/components/poultry/ChickCostDialog.test.tsx \
  web/src/store/api/poultryBatchesApi.ts web/src/components/poultry/BatchOverviewTab.tsx \
  web/src/components/poultry/PoultryBatchDetailView.tsx web/src/components/poultry/CloseBatchDialog.tsx \
  web/src/components/poultry/CloseBatchDialog.test.tsx
git commit -m "feat(web): afficher, corriger et clôturer sans ressaisir le coût des poussins"
```

---

### Task 8: Mobile — saisie du coût aux écrans de création existants

**Files:**
- Modify: `mobile/src/types/index.ts`
- Modify: `mobile/src/store/api/poultryBatchesApi.ts`
- Modify: `mobile/src/components/onboarding/CreateLotSheet.tsx`
- Test: `mobile/src/components/onboarding/__tests__/CreateLotSheet.test.tsx` (check first)

**Interfaces:**
- Consumes: `POST /api/v1/farms/{farmId}/poultry-batches` now accepting `chickUnitPriceXof` (Task 3, same endpoint as web).
- Produces: `PoultryBatch.chickPurchaseCostXof: number | null`; `CreateBatchInput.chickUnitPriceXof?: number` on mobile — consumed by Task 9 (new screen) and Task 10 (lot detail).

- [ ] **Step 1: Check for an existing test file**

Run: `find mobile/src/components/onboarding -iname "*CreateLotSheet*"`. Read whatever test file exists in full before editing.

- [ ] **Step 2: Update the types**

Edit `mobile/src/types/index.ts` — in `PoultryBatch`, add after `targetAgeDays: number | null;`:

```typescript
  /** Resolved from the farm's expense ledger, not stored on the batch. `null` = not recorded yet. */
  chickPurchaseCostXof: number | null;
```

- [ ] **Step 3: Update the mobile API slice's input type**

Edit `mobile/src/store/api/poultryBatchesApi.ts`:

```typescript
export interface CreateBatchInput {
  breedId: number;
  name?: string;
  startDate?: string;
  initialCount: number;
  chickUnitPriceXof?: number;
}
```

- [ ] **Step 4: Add the field to the onboarding sheet, broiler-only**

Edit `CreateLotSheet.tsx` — add state and a conditional field (only for `kind === 'broiler'`, since chick-purchase cost is a broiler-batch concept per this feature's scope; layer flocks go through a different creation path untouched by this plan):

```typescript
  const [breedId, setBreedId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [count, setCount] = useState('');
  const [date, setDate] = useState(today());
  const [chickUnitPrice, setChickUnitPrice] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setBreedId(null);
      setName('');
      setCount('');
      setDate(today());
      setChickUnitPrice('');
      setError(null);
    }
  }, [visible]);
```

```typescript
  async function submit() {
    if (!valid || breedId == null) return;
    setError(null);
    const body = {
      breedId,
      name: name.trim() || undefined,
      startDate: date,
      initialCount: Number(count),
      ...(kind === 'broiler' && chickUnitPrice ? { chickUnitPriceXof: Number(chickUnitPrice) } : {}),
    };
```

Add the field in the JSX, right after the `initialCount` `FormField` and before the `startDate` `FormField`, gated on `kind === 'broiler'`:

```typescript
          {kind === 'broiler' && (
            <FormField
              label="Prix par poussin (FCFA, optionnel)"
              value={chickUnitPrice}
              onChangeText={(t) => setChickUnitPrice(t.replace(/[^0-9]/g, ''))}
              placeholder="Ex. 300"
              keyboardType="number-pad"
            />
          )}
```

- [ ] **Step 5: Add/extend the test**

If a test file exists, add two cases mirroring its existing render/fill/submit helpers: one asserting `chickUnitPriceXof` is sent when typed (broiler kind only), one asserting it's absent when left blank. If none exists, write a minimal one following this codebase's `renderHook`/`render` (always `await`ed, per `rntl14_async_render_gotcha`) conventions used by the other mobile onboarding tests.

- [ ] **Step 6: Run tests**

Run: `cd mobile && npx tsc --noEmit && npx jest --testPathPattern="onboarding.*CreateLotSheet"`
Expected: clean tsc, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add mobile/src/types/index.ts mobile/src/store/api/poultryBatchesApi.ts \
  mobile/src/components/onboarding/CreateLotSheet.tsx
# add the test file path here too if one was created or modified
git commit -m "feat(mobile): saisir le prix des poussins à la création d'un lot (onboarding)"
```

---

### Task 9: Mobile — nouvel écran de création de bande post-onboarding

**Files:**
- Create: `mobile/app/(field)/lots/nouveau.tsx`
- Modify: `mobile/app/(field)/lots/index.tsx`
- Test: `mobile/app/(field)/lots/__tests__/nouveau.test.tsx` (new)

**Interfaces:**
- Consumes: `useCreateBatchMutation`, `CreateBatchInput` (Task 8); `useListBreedsQuery` (already used by `CreateLotSheet.tsx`).
- Produces: route `/(field)/lots/nouveau` — comble l'écart de parité (create-batch existed on web outside onboarding, not on mobile).

**Scope note:** broiler batches only (mirrors `CreateLotSheet`'s `kind='broiler'` shape) — this plan's chick-cost feature and its spec are scoped to `PoultryBatch`; layer-flock creation (`useCreateProductionUnitMutation`) is untouched and out of scope.

- [ ] **Step 1: Write the failing test**

Create `nouveau.test.tsx` mirroring `mobile/app/(field)/commerce/__tests__/vente.test.tsx`'s conventions (RTL `render`/`fireEvent` always `await`ed; mock `useCreateBatchMutation` and `useListBreedsQuery` per this codebase's per-module RTK Query mocking convention). Cover:

```typescript
it('crée une bande avec le prix des poussins renseigné', async () => {
  // render <CreerBandeScreen />, select a breed, fill effectif "500" and
  // prix par poussin "300", submit, and assert mockCreateBatch was called
  // with body containing { initialCount: 500, chickUnitPriceXof: 300 }.
});

it('crée une bande sans prix des poussins (facultatif)', async () => {
  // same flow, leave the price field empty, assert the body has no
  // chickUnitPriceXof key.
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mobile && npx jest --testPathPattern="lots/__tests__/nouveau\.test\.tsx"` (escaped parens/dots — the plain path form silently returns "No tests found" on this route-group structure, per this codebase's documented Jest footgun)
Expected: fails — the screen file does not exist yet.

- [ ] **Step 3: Create the screen**

Mirror `CreateLotSheet.tsx`'s form logic and `mobile/app/(field)/lots/[unitId]/cloture.tsx`'s screen chrome (header with back button, `ScrollView` body, `ActionBar` submit) — this is a full-page screen, not a bottom sheet, since it's reached from the lot list rather than onboarding:

```typescript
/**
 * Nouvelle bande de chair, atteignable depuis la liste des lots (pas seulement
 * l'onboarding) — comble un écart de parité avec le web (`CreateBatchDialog`).
 * Poulets de chair uniquement : les lots de ponte se créent ailleurs, hors
 * périmètre de ce coût.
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { ArrowLeft } from 'lucide-react-native';
import { tokens } from '@/theme';
import { FormField } from '@/components/field/FormField';
import { ActionBar } from '@/components/field/ActionBar';
import { useListBreedsQuery } from '@/store/api/breedsApi';
import { useCreateBatchMutation } from '@/store/api/poultryBatchesApi';
import { selectSelectedFarmId } from '@/store/slices/selectionSlice';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function CreerBandeScreen() {
  const router = useRouter();
  const selectedFarmId = useSelector(selectSelectedFarmId);
  // Breeds are not farm-scoped (same query CreateLotSheet.tsx uses, unconditionally).
  const { data: breeds } = useListBreedsQuery('POULTRY');
  const [createBatch, { isLoading }] = useCreateBatchMutation();

  const broilerBreeds = (breeds ?? []).filter((b) => b.type === 'broiler');

  const [breedId, setBreedId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [count, setCount] = useState('');
  const [date, setDate] = useState(today());
  const [chickUnitPrice, setChickUnitPrice] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (broilerBreeds.length > 0 && breedId == null) {
      setBreedId(broilerBreeds[0]!.id);
    }
  }, [broilerBreeds, breedId]);

  if (selectedFarmId === null) {
    return <Redirect href="/(field)" />;
  }

  const valid = breedId != null && Number(count) > 0;

  async function submit() {
    if (!valid || breedId == null || selectedFarmId === null) return;
    setError(null);
    try {
      await createBatch({
        farmId: selectedFarmId,
        body: {
          breedId,
          name: name.trim() || undefined,
          startDate: date,
          initialCount: Number(count),
          ...(chickUnitPrice ? { chickUnitPriceXof: Number(chickUnitPrice) } : {}),
        },
      }).unwrap();
      router.back();
    } catch {
      setError('Création impossible. Vérifiez votre connexion et réessayez.');
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Retour">
          <ArrowLeft size={22} color={tokens.colors.field.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Nouveau lot de chair</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.groupLabel}>Souche</Text>
        <View style={styles.breeds}>
          {broilerBreeds.length === 0 ? (
            <Text style={styles.empty}>Aucune souche disponible.</Text>
          ) : (
            broilerBreeds.map((b) => {
              const on = breedId === b.id;
              return (
                <TouchableOpacity
                  key={b.id}
                  onPress={() => setBreedId(b.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={b.name}
                  style={[styles.chip, on && styles.chipOn]}
                >
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{b.name}</Text>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        <FormField label="Nom du lot (optionnel)" value={name} onChangeText={setName} placeholder="Ex. Lot 1" />
        <FormField
          label="Effectif"
          required
          value={count}
          onChangeText={(t) => setCount(t.replace(/[^0-9]/g, ''))}
          placeholder="Ex. 500"
          keyboardType="number-pad"
        />
        <FormField label="Date d'arrivée" value={date} onChangeText={setDate} placeholder="AAAA-MM-JJ" />
        <FormField
          label="Prix par poussin (FCFA, optionnel)"
          value={chickUnitPrice}
          onChangeText={(t) => setChickUnitPrice(t.replace(/[^0-9]/g, ''))}
          placeholder="Ex. 300"
          keyboardType="number-pad"
          helperText="Modifiable plus tard depuis la fiche du lot."
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <ActionBar>
        <TouchableOpacity
          style={[styles.cta, (!valid || isLoading) && styles.ctaDisabled]}
          onPress={submit}
          disabled={!valid || isLoading}
          accessibilityRole="button"
          accessibilityLabel="Créer le lot"
        >
          {isLoading ? (
            <ActivityIndicator color={tokens.colors.action.commit.fg} />
          ) : (
            <Text style={styles.ctaText}>Créer le lot</Text>
          )}
        </TouchableOpacity>
      </ActionBar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.field.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: tokens.layout.screenPadding, paddingVertical: tokens.spacing[3] },
  title: { ...tokens.typography.headingLg, color: tokens.colors.field.text },
  content: { paddingHorizontal: tokens.layout.screenPadding, paddingTop: tokens.spacing[2], paddingBottom: tokens.spacing[8], gap: tokens.spacing[4] },
  groupLabel: { ...tokens.typography.label, color: tokens.colors.neutral[700] },
  breeds: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing[2] },
  chip: { paddingHorizontal: tokens.spacing[4], paddingVertical: tokens.spacing[2], borderRadius: tokens.radii.full, borderWidth: 1.5, borderColor: tokens.colors.neutral[200], backgroundColor: tokens.colors.neutral[0] },
  chipOn: { borderColor: tokens.colors.primary[500], backgroundColor: tokens.colors.primary[50] },
  chipText: { ...tokens.typography.bodyMd, color: tokens.colors.neutral[700] },
  chipTextOn: { color: tokens.colors.primary[700], fontFamily: tokens.typography.headingMd.fontFamily },
  empty: { ...tokens.typography.bodySm, color: tokens.colors.neutral[500] },
  error: { ...tokens.typography.bodySm, color: tokens.colors.error },
  cta: { minHeight: tokens.touch.primaryButton, borderRadius: tokens.radii.lg, backgroundColor: tokens.colors.action.commit.bg, alignItems: 'center', justifyContent: 'center' },
  ctaDisabled: { opacity: 0.4 },
  ctaText: { ...tokens.typography.button, color: tokens.colors.action.commit.fg },
});
```

(`FormField`'s `helperText` prop already exists — used by `cloture.tsx` above.)

- [ ] **Step 4: Add the entry point on the lot list screen**

Edit `mobile/app/(field)/lots/index.tsx` — add a "+" button in the header, gated on write access (mirrors `LotDetailScreen`'s `canWrite` check):

```typescript
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { skipToken } from '@reduxjs/toolkit/query/react';
import { Plus } from 'lucide-react-native';
import { tokens } from '@/theme';
import { useListProductionUnitsQuery, type ProductionUnit } from '@/store/api/productionUnitsApi';
import { selectSelectedFarmId } from '@/store/slices/selectionSlice';
import { useFarmAccess } from '@/auth/useSession';
```

```typescript
export default function BatchListScreen() {
  const router = useRouter();
  const selectedFarmId = useSelector(selectSelectedFarmId);
  const { can } = useFarmAccess();
  const canWrite = can('poultry:write');
  const {
    data: units,
    isLoading,
    isError,
  } = useListProductionUnitsQuery(selectedFarmId ?? skipToken);
```

Replace the header `View`:

```typescript
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Lots</Text>
          {stale ? <Text style={styles.staleHint}>Hors ligne — données en cache</Text> : null}
        </View>
        {canWrite && (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => router.push('/(field)/lots/nouveau')}
            accessibilityRole="button"
            accessibilityLabel="Nouveau lot"
          >
            <Plus size={22} color={tokens.colors.primary[700]} />
          </TouchableOpacity>
        )}
      </View>
```

(Move the `header` `View`'s `flexDirection: 'row'` etc. into its style — add to the `styles` object: `header: { ...existing, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }` and a new `addButton: { width: 40, height: 40, borderRadius: tokens.radii.full, alignItems: 'center', justifyContent: 'center', backgroundColor: tokens.colors.neutral[0], borderWidth: 1, borderColor: tokens.colors.neutral[200] }`.)

- [ ] **Step 5: Run tests**

Run: `cd mobile && npx tsc --noEmit && npx jest --testPathPattern="lots/__tests__/nouveau\.test\.tsx"`
Expected: clean tsc, all tests pass.

- [ ] **Step 6: Commit**

```bash
git add "mobile/app/(field)/lots/nouveau.tsx" "mobile/app/(field)/lots/index.tsx" \
  "mobile/app/(field)/lots/__tests__/nouveau.test.tsx"
git commit -m "feat(mobile): écran de création de bande post-onboarding (parité web)"
```

---

### Task 10: Mobile — affichage, correction sur la fiche du lot, et clôture sans ressaisie

**Files:**
- Create: `mobile/src/components/poultry/ChickCostSheet.tsx`
- Modify: `mobile/src/store/api/poultryBatchesApi.ts`
- Modify: `mobile/app/(field)/lots/[unitId]/index.tsx`
- Modify: `mobile/app/(field)/lots/[unitId]/cloture.tsx`
- Test: `mobile/src/components/poultry/__tests__/ChickCostSheet.test.tsx` (new)
- Test: `mobile/app/(field)/lots/[unitId]/__tests__/cloture.test.tsx` (check first)

**Interfaces:**
- Consumes: `POST /api/v1/farms/{farmId}/poultry-batches/{batchId}/chick-cost` (Task 4); `PoultryBatch.chickPurchaseCostXof` (Task 8).
- Produces: `useSetChickCostMutation` (mobile RTK Query hook) — used only within this task.

- [ ] **Step 1: Add the mutation**

Edit `mobile/src/store/api/poultryBatchesApi.ts` — add after `createBatch`:

```typescript
    setChickCost: build.mutation<
      PoultryBatch,
      { farmId: number; batchId: number; body: { chickUnitPriceXof: number } }
    >({
      query: ({ farmId, batchId, body }) => ({
        url: `${base(farmId)}/${batchId}/chick-cost`,
        method: 'POST',
        body,
      }),
      transformResponse: (r: ApiEnvelope<PoultryBatch>) => r.data,
      invalidatesTags: (_r, _e, { batchId }) => [{ type: 'PoultryBatch', id: batchId }],
    }),
```

Export `useSetChickCostMutation` alongside the existing exports.

- [ ] **Step 2: Write the failing test for the sheet**

Create `ChickCostSheet.test.tsx`:

```typescript
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ChickCostSheet } from '../ChickCostSheet';

const mockSetChickCost = jest.fn(() => ({ unwrap: () => Promise.resolve({}) }));

jest.mock('@/store/api/poultryBatchesApi', () => ({
  useSetChickCostMutation: () => [mockSetChickCost, { isLoading: false }],
}));

describe('ChickCostSheet', () => {
  beforeEach(() => {
    mockSetChickCost.mockClear();
  });

  it('envoie chickUnitPriceXof et ferme la feuille', async () => {
    const onClose = jest.fn();
    await render(
      <ChickCostSheet
        visible
        onClose={onClose}
        farmId={1}
        batchId={42}
        initialCount={500}
        currentValueXof={null}
      />,
    );

    await act(async () =>
      fireEvent.changeText(screen.getByLabelText('Prix par poussin (FCFA)'), '300'),
    );
    await act(async () => fireEvent.press(screen.getByLabelText('Enregistrer')));

    expect(mockSetChickCost).toHaveBeenCalledWith({
      farmId: 1,
      batchId: 42,
      body: { chickUnitPriceXof: 300 },
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('pré-remplit le prix unitaire déjà enregistré pour permettre une correction', async () => {
    await render(
      <ChickCostSheet
        visible
        onClose={jest.fn()}
        farmId={1}
        batchId={42}
        initialCount={500}
        currentValueXof={150_000}
      />,
    );

    expect(screen.getByLabelText('Prix par poussin (FCFA)').props.value).toBe('300');
    expect(screen.getByText('Modifier le coût des poussins')).toBeTruthy();
  });
});
```

(Mirrors `mobile/app/(field)/commerce/__tests__/vente.test.tsx`'s conventions: `render`/`fireEvent` always `await`ed, per-module RTK Query hook mocked directly — see `rntl14_async_render_gotcha`. `FormField` must expose its label via `accessibilityLabel`/`getByLabelText`; if it instead only sets a visible `<Text>` label, use `screen.getByPlaceholderText('Ex. 300')` instead — check `FormField.tsx`'s actual label wiring before assuming which query works.)

- [ ] **Step 3: Run test to verify it fails**

Run: `cd mobile && npx jest --testPathPattern="poultry/__tests__/ChickCostSheet\.test\.tsx"`
Expected: fails — the component does not exist yet.

- [ ] **Step 4: Create the sheet**

Mirror `CreateLotSheet.tsx`'s `Modal`/`Pressable` bottom-sheet chrome exactly (backdrop, sheet, header with close button), with a single price `FormField` and a submit CTA:

```typescript
/**
 * Renseigner ou corriger le prix par poussin d'une bande — action dédiée, jamais
 * un formulaire d'édition générique de la bande. Mirrors the web `ChickCostDialog`.
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View, StyleSheet } from 'react-native';
import { X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { tokens } from '@/theme';
import { FormField } from '@/components/field/FormField';
import { useSetChickCostMutation } from '@/store/api/poultryBatchesApi';

export function ChickCostSheet({
  visible,
  onClose,
  farmId,
  batchId,
  initialCount,
  currentValueXof,
}: {
  visible: boolean;
  onClose: () => void;
  farmId: number;
  batchId: number;
  initialCount: number;
  currentValueXof: number | null;
}) {
  const [setChickCost, { isLoading }] = useSetChickCostMutation();
  const [unitPrice, setUnitPrice] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setUnitPrice(
        currentValueXof != null && initialCount > 0
          ? String(Math.round(currentValueXof / initialCount))
          : '',
      );
      setError(null);
    }
  }, [visible, currentValueXof, initialCount]);

  const valid = /^\d+$/.test(unitPrice) && Number(unitPrice) > 0;

  async function submit() {
    if (!valid) return;
    setError(null);
    try {
      await setChickCost({
        farmId,
        batchId,
        body: { chickUnitPriceXof: Number(unitPrice) },
      }).unwrap();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } catch {
      setError('Enregistrement impossible. Vérifiez votre connexion et réessayez.');
    }
  }

  const title = currentValueXof != null ? 'Modifier le coût des poussins' : 'Renseigner le coût des poussins';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fermer" />
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Fermer">
            <X size={22} color={tokens.colors.neutral[500]} />
          </Pressable>
        </View>

        <FormField
          label="Prix par poussin (FCFA)"
          value={unitPrice}
          onChangeText={(t) => setUnitPrice(t.replace(/[^0-9]/g, ''))}
          placeholder="Ex. 300"
          keyboardType="number-pad"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          onPress={submit}
          disabled={!valid || isLoading}
          accessibilityRole="button"
          accessibilityLabel="Enregistrer"
          style={[styles.cta, (!valid || isLoading) && styles.ctaDisabled]}
        >
          {isLoading ? (
            <ActivityIndicator color={tokens.colors.action.commit.fg} />
          ) : (
            <Text style={styles.ctaText}>Enregistrer</Text>
          )}
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(18,43,18,0.4)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: tokens.colors.neutral[0],
    borderTopLeftRadius: tokens.radii.xl,
    borderTopRightRadius: tokens.radii.xl,
    paddingHorizontal: tokens.spacing[5],
    paddingTop: tokens.spacing[4],
    paddingBottom: tokens.spacing[8],
    gap: tokens.spacing[3],
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: tokens.spacing[2] },
  title: { ...tokens.typography.headingLg, color: tokens.colors.neutral[900] },
  error: { ...tokens.typography.bodySm, color: tokens.colors.error },
  cta: { minHeight: tokens.touch.primaryButton, borderRadius: tokens.radii.lg, backgroundColor: tokens.colors.action.commit.bg, alignItems: 'center', justifyContent: 'center', marginTop: tokens.spacing[2] },
  ctaDisabled: { backgroundColor: tokens.colors.neutral[300] },
  ctaText: { ...tokens.typography.button, color: tokens.colors.action.commit.fg },
});
```

- [ ] **Step 5: Wire it into the lot detail screen's overview tab**

Edit `mobile/app/(field)/lots/[unitId]/index.tsx` — import the sheet, add open state, and render a card + action right after the KPI grid `View` closes (before the `Tabs` `View`):

```typescript
import { ChickCostSheet } from '@/components/poultry/ChickCostSheet';
```

```typescript
  const [tab, setTab] = useState<Tab>('overview');
  const [chickCostOpen, setChickCostOpen] = useState(false);
```

```typescript
        {/* Chick purchase cost — recorded at reception, or here if not yet known. */}
        {batch && (
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={styles.cardSub}>Coût des poussins</Text>
                <Text style={styles.cardTitle}>
                  {batch.chickPurchaseCostXof != null
                    ? `${formatNumber(batch.chickPurchaseCostXof)} FCFA`
                    : 'Non renseigné'}
                </Text>
              </View>
              {canWrite && (
                <Pressable
                  onPress={() => setChickCostOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel={batch.chickPurchaseCostXof != null ? 'Modifier le coût des poussins' : 'Renseigner le coût des poussins'}
                  style={styles.actionBtn}
                >
                  <Text style={styles.actionBtnText}>
                    {batch.chickPurchaseCostXof != null ? 'Modifier' : 'Renseigner'}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        )}
```

And right before the closing `</SafeAreaView>`, alongside the existing `<MicButton .../>`:

```typescript
      {batch && (
        <ChickCostSheet
          visible={chickCostOpen}
          onClose={() => setChickCostOpen(false)}
          farmId={selectedFarmId as number}
          batchId={batchId}
          initialCount={batch.initialCount}
          currentValueXof={batch.chickPurchaseCostXof}
        />
      )}
```

- [ ] **Step 6: Make the closure screen read-only when a cost is already recorded**

Edit `mobile/app/(field)/lots/[unitId]/cloture.tsx` — the screen already loads `unit` via `useListProductionUnitsQuery`, which does not carry `chickPurchaseCostXof` (that's on `PoultryBatch`, not the generic `ProductionUnit`). Add a batch-specific lookup:

```typescript
import { useGetBatchQuery } from '@/store/api/poultryBatchesApi';
```

```typescript
  const { data: units } = useListProductionUnitsQuery(selectedFarmId ?? skipToken);
  const unit = units?.find((u) => u.id === unitId);
  const { data: batch } = useGetBatchQuery(
    selectedFarmId === null || Number.isNaN(unitId) ? skipToken : { farmId: selectedFarmId, batchId: unitId },
  );
  const chickPurchaseCostXof = batch?.chickPurchaseCostXof ?? null;
```

Replace the `canSubmit` computation and the submit body to skip the manual field when a cost is already recorded:

```typescript
  const digitsOnly = /^\d*$/.test(chickCost);
  const canSubmit = !Number.isNaN(unitId) && canClose && digitsOnly && !isLoading;

  async function handleSubmit(): Promise<void> {
    if (selectedFarmId === null || !canSubmit) return;
    try {
      await closeUnit({
        farmId: selectedFarmId,
        unitId,
        body: {
          ...(chickPurchaseCostXof == null
            ? { chickCostXof: chickCost ? Number(chickCost) : undefined }
            : {}),
          notes: notes.trim() || undefined,
        },
      }).unwrap();
```

Replace the `FormField label="Coût des poussins (facultatif)"` block with a conditional: read-only summary when `chickPurchaseCostXof != null`, the existing editable field otherwise:

```typescript
        {chickPurchaseCostXof != null ? (
          <View style={[styles.notice]}>
            <Text style={styles.noticeText}>
              Coût des poussins (déjà enregistré) :{' '}
              <Text style={styles.noticeStrong}>{formatNumber(chickPurchaseCostXof)} FCFA</Text>
            </Text>
          </View>
        ) : (
          <FormField
            label="Coût des poussins (facultatif)"
            value={chickCost}
            onChangeText={setChickCost}
            placeholder="0"
            keyboardType="number-pad"
            maxLength={12}
            error={digitsOnly ? undefined : 'Nombre entier requis'}
            helperText="Non enregistré ailleurs. Sans lui, le coût du lot est sous-estimé."
          />
        )}
```

- [ ] **Step 7: Extend/add the closure screen test**

Run `find "mobile/app/(field)/lots/[unitId]/__tests__" -iname "cloture*"` first. If a test file exists, read it and add the two cases (read-only summary shown + `chickCostXof` omitted when recorded; existing editable behavior unchanged when not). If none exists, this step is a pre-existing gap — note it as a deferred-minor rather than writing a whole new test scaffold from scratch for a screen this plan did not otherwise touch structurally (only its rendering branch changed).

- [ ] **Step 8: Run tests**

Run: `cd mobile && npx tsc --noEmit && npx jest --testPathPattern="poultry/__tests__/ChickCostSheet\.test\.tsx|lots/\[unitId\]/__tests__/cloture"`
Expected: clean tsc, all tests pass.

- [ ] **Step 9: Commit**

```bash
git add mobile/src/components/poultry/ChickCostSheet.tsx \
  mobile/src/components/poultry/__tests__/ChickCostSheet.test.tsx \
  mobile/src/store/api/poultryBatchesApi.ts \
  "mobile/app/(field)/lots/[unitId]/index.tsx" \
  "mobile/app/(field)/lots/[unitId]/cloture.tsx"
git commit -m "feat(mobile): afficher, corriger et clôturer sans ressaisir le coût des poussins"
```

---

## Final check (whole-branch, before the final review)

After Task 10, run the complete gate the project's `finishing-a-development-branch` flow expects:

```bash
cd backend && ./mvnw -pl avicare-app -am clean compile test-compile && ./mvnw -pl avicare-app test
cd web && npx tsc --noEmit && npx vitest run
cd mobile && npx tsc --noEmit && npx jest
```

Backend Testcontainers-based ITs (`PoultryBatchServiceIT`, `UnitClosureServiceTest` is a plain unit test and *does* run locally) cannot execute on this dev machine (documented Docker-socket limitation) — compile-verify locally, real pass/fail is CI-only, exactly as sub-project 1 (`2026-09-23-broiler-sale-by-weight`) was handled.
