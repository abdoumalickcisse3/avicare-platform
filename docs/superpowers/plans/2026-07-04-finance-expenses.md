# Finance P1 — Dépenses + analytique par lot — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the expense ledger (manual + auto from purchases and valued stock entries) and the per-lot cost/revenue/margin analytics — phase P1 of the finance module (spec `docs/superpowers/specs/2026-07-04-finance-module-design.md`).

**Architecture:** New root bounded context `com.avicare.finance` (packages `api/domain/repository/service/controller/dto`, like `reporting`). Migration **V25** creates `expenses`. `livestock.inventory` calls `FinanceFacade` at PO reception and on valued manual stock entries (same transaction). Analytics consumes `CommercialFacade` (new `revenueByProductionUnit`) and `LivestockFacade` (new `initialCountOf`). Frontend: `financeApi` slice + pages Dépenses/Analytique + Sidebar group.

**Tech Stack:** Spring Boot 3.4 / Java 21 / Flyway / JPA (Hibernate 6.4) / Mockito · Next.js 16 / TS / MUI v9 / RTK Query / react-hook-form + zod / Vitest.

## Global Constraints

- Migration **V25** immuable une fois mergée ; conventions doc 04 (tables `snake_case` pluriel, `BIGSERIAL`, `TIMESTAMP`, enums `VARCHAR + CHECK`, trigger `trg_<table>_updated_at` via la fonction existante `update_updated_at_column()`).
- Aucun cross-import entre bounded contexts : `finance` n'importe **rien** de `com.avicare.livestock.*` (ses méthodes de facade prennent des `String articleSource/subcategory`) ; `livestock.inventory` importe uniquement `com.avicare.finance.api.FinanceFacade`.
- RBAC : lectures `@farmAccess.hasPermission(#farmId,'finance:read') and @features.isEnabled(#farmId,'module.finance')` ; écritures `hasRole(OWNER, MANAGER) and FEATURE`. Codes erreur : dépense auto non éditable → 422 `EXPENSE_NOT_EDITABLE` (`BusinessRuleException`).
- Dépenses auto : `PURCHASE` à la réception d'un bon (groupées par catégorie de dépense, Σ `lineTotalXof` des lignes reçues) ; `STOCK_ENTRY` quand un mouvement **manuel** (aucun backref command) IN ou ajustement à delta positif est **valorisé** (`totalValueXof > 0`), catégorie via mapping, lot hérité du `productionUnitId` du mouvement.
- Mapping catégorie (règle finance) : `articleSource == "TREATMENT"` → `veterinary` ; sinon subcategory `FEED`→`feed`, `MEDICATION`→`veterinary`, `EQUIPMENT`→`equipment`, autre/null→`other`.
- Commits : Conventional Commits (scopes `finance`, `livestock`, `web`), **AUCUNE signature IA/Claude**, pas de Co-Authored-By, pas d'emoji robot.
- Backend : `./mvnw -q spotless:apply -pl avicare-app` avant chaque commit ; gate local = `./mvnw -q -pl avicare-app -am test-compile` exit 0 (Maven fait foi, pas l'IDE) ; les `*IT` Testcontainers s'exécutent **en CI uniquement**.
- FOOTGUN récurrent : tout nouveau `@Service` dépendant d'un repo JPA → ajouter le repo en `@MockitoBean` dans `SecurityE2ETest` **et** `SecurityIntegrationTest` (profil DB-less), sinon leur contexte ne boote plus.
- Frontend : pas de hex en dur (tokens `@/theme/tokens`), copie FR, pas de nouvelle dépendance ; `AuthTokens` exige `expiresIn` dans les tests ; reset de dialog **edge-triggered** sur `open` (ref `wasOpen`) ; la dernière tâche front exige tsc 0 / lint 0 err / vitest vert / next build OK.

---

## File Structure

**Backend (create):** `com/avicare/finance/domain/{Expense,ExpenseSource}.java`, `finance/repository/ExpenseRepository.java`, `finance/service/{ExpenseCategoryMapper,ExpenseService,FinanceAnalyticsService}.java`, `finance/api/FinanceFacade.java`, `finance/service/FinanceFacadeImpl.java`, `finance/controller/{FinanceAccess,ExpenseController}.java`, `finance/dto/...`, migration `V25__finance_expenses.sql`.
**Backend (modify):** `livestock/inventory/PurchaseOrderService.java` (hook réception), `livestock/inventory/StockMovementService.java` (hook STOCK_ENTRY), `livestock/commercial/CommercialFacade.java` + son impl + `SaleItemRepository` (revenu par lot), `livestock/api/LivestockFacade.java` + impl + `LifecycleEventRepository` (initialCountOf), tests DB-less (@MockitoBean).
**Frontend (create):** `web/src/store/api/financeApi.ts`, `web/src/app/(dashboard)/finance/depenses/page.tsx`, `web/src/app/(dashboard)/finance/analytique/page.tsx`, `web/src/components/finance/{ExpenseDialog,ExpensesView,UnitAnalyticsView}.tsx`.
**Frontend (modify):** `baseApi.ts` (tag `Expense`), `Sidebar.tsx` (groupe Finance), `components/inventory/StockMovementDialog.tsx` (champ prix optionnel), `types` finance.

---

### Task B1 : migration V25 + entité `Expense` + repository

**Files:**
- Create: `backend/avicare-app/src/main/resources/db/migration/V25__finance_expenses.sql`
- Create: `backend/avicare-app/src/main/java/com/avicare/finance/domain/ExpenseSource.java`, `.../finance/domain/Expense.java`, `.../finance/repository/ExpenseRepository.java`
- Modify: `backend/avicare-app/src/test/java/com/avicare/security/SecurityE2ETest.java` et `SecurityIntegrationTest.java` (+`@MockitoBean ExpenseRepository`) — **au moment de la Task B2** si le service n'existe pas encore ici, le contexte boote sans ; ajouter le @MockitoBean DANS CETTE TÂCHE par anticipation ne casse rien : fais-le ici.

**Interfaces (Produces):**
- `enum ExpenseSource { MANUAL, PURCHASE, STOCK_ENTRY, SALARY }`
- Entité `Expense` (getters/setters Lombok, mêmes annotations d'en-tête que `com.avicare.livestock.domain.Client` — lis-le pour le style) : `id, farmId, categoryKey, amountXof (Long), expenseDate (LocalDate), label, notes, productionUnitId (Long nullable), source (@Enumerated(STRING)), purchaseOrderId, stockMovementId, salaryId (nullables), createdBy`, audit `createdAt/updatedAt (insertable=false, updatable=false)`, soft delete `@SQLDelete(sql = "UPDATE expenses SET deleted_at = NOW() WHERE id = ?")` + `@SQLRestriction("deleted_at IS NULL")`.
- `interface ExpenseRepository extends JpaRepository<Expense, Long>` avec :
```java
List<Expense> findByFarmIdOrderByExpenseDateDesc(Long farmId);

@Query("SELECT e FROM Expense e WHERE e.farmId = :farmId "
    + "AND (:from IS NULL OR e.expenseDate >= :from) "
    + "AND (:to IS NULL OR e.expenseDate <= :to) "
    + "AND (:categoryKey IS NULL OR e.categoryKey = :categoryKey) "
    + "AND (:unitId IS NULL OR e.productionUnitId = :unitId) "
    + "ORDER BY e.expenseDate DESC, e.id DESC")
List<Expense> search(Long farmId, LocalDate from, LocalDate to, String categoryKey, Long unitId);

/** Somme par catégorie des dépenses taguées sur un lot. */
@Query("SELECT e.categoryKey, SUM(e.amountXof) FROM Expense e "
    + "WHERE e.farmId = :farmId AND e.productionUnitId = :unitId GROUP BY e.categoryKey")
List<Object[]> sumByCategoryForUnit(Long farmId, Long unitId);

/** Somme par catégorie sur une période (page Dépenses). */
@Query("SELECT e.categoryKey, SUM(e.amountXof) FROM Expense e "
    + "WHERE e.farmId = :farmId "
    + "AND (:from IS NULL OR e.expenseDate >= :from) "
    + "AND (:to IS NULL OR e.expenseDate <= :to) GROUP BY e.categoryKey")
List<Object[]> sumByCategory(Long farmId, LocalDate from, LocalDate to);
```

- [ ] **Step 1 : migration** `V25__finance_expenses.sql` :

```sql
-- V25 — Finance P1 (Sprint B6) : registre des dépenses.
-- expenses.salary_id reste sans FK ici : la table salaries arrive en V26 (P2),
-- qui ajoutera la contrainte. Sources: MANUAL (saisie), PURCHASE (réception bon),
-- STOCK_ENTRY (entrée de stock valorisée), SALARY (paie, P2).

CREATE TABLE expenses (
    id                  BIGSERIAL PRIMARY KEY,
    farm_id             BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    category_key        VARCHAR(100) NOT NULL,
    amount_xof          BIGINT NOT NULL CHECK (amount_xof > 0),
    expense_date        DATE NOT NULL,
    label               VARCHAR(200) NOT NULL,
    notes               TEXT,
    production_unit_id  BIGINT REFERENCES production_units(id),
    source              VARCHAR(20) NOT NULL CHECK (source IN ('MANUAL','PURCHASE','STOCK_ENTRY','SALARY')),
    purchase_order_id   BIGINT REFERENCES purchase_orders(id),
    stock_movement_id   BIGINT REFERENCES stock_movements(id),
    salary_id           BIGINT,
    created_by          BIGINT NOT NULL REFERENCES users(id),
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMP
);

CREATE INDEX idx_expenses_farm_date ON expenses(farm_id, expense_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_expenses_unit ON expenses(production_unit_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_expenses_po ON expenses(purchase_order_id);
CREATE INDEX idx_expenses_movement ON expenses(stock_movement_id);

CREATE TRIGGER trg_expenses_updated_at
    BEFORE UPDATE ON expenses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

- [ ] **Step 2 : enum + entité + repository** (code des Interfaces ci-dessus ; en-tête d'entité calqué sur `livestock/domain/Client.java` : `@Entity @Table(name = "expenses") @Getter @Setter` + soft delete comme indiqué ; `@Enumerated(EnumType.STRING)` sur `source`).

- [ ] **Step 3 : DB-less tests** — ajouter `@MockitoBean ExpenseRepository expenseRepository;` dans `SecurityE2ETest` et `SecurityIntegrationTest` (imports à l'identique des autres @MockitoBean du fichier).

- [ ] **Step 4 : vérifier** — `cd backend && ./mvnw -q -pl avicare-app -am test-compile` → exit 0 ; `./mvnw -q spotless:apply -pl avicare-app`. (La migration tourne sous Testcontainers en CI ; localement test-compile suffit.)

- [ ] **Step 5 : commit**
```bash
git add backend/avicare-app/src/main/resources/db/migration/V25__finance_expenses.sql backend/avicare-app/src/main/java/com/avicare/finance backend/avicare-app/src/test/java/com/avicare/security
git commit -m "feat(finance): V25 expenses table, entity and repository"
```

---

### Task B2 : mapper de catégories + `ExpenseService` + `FinanceFacade` (TDD)

**Files:**
- Create: `.../finance/service/ExpenseCategoryMapper.java`, `.../finance/service/ExpenseService.java`, `.../finance/api/FinanceFacade.java`, `.../finance/service/FinanceFacadeImpl.java`, `.../finance/dto/request/ExpenseRequest.java`, `.../finance/dto/response/ExpenseResponse.java`
- Test: `backend/avicare-app/src/test/java/com/avicare/finance/service/ExpenseCategoryMapperTest.java`, `.../finance/service/ExpenseServiceTest.java`

**Interfaces:**
- Consumes : `Expense`, `ExpenseSource`, `ExpenseRepository` (B1).
- Produces :
```java
// finance/service/ExpenseCategoryMapper.java — pur, statique
public final class ExpenseCategoryMapper {
  private ExpenseCategoryMapper() {}
  /** Maps an article (source + subcategory, raw strings) to an expense category key. */
  public static String expenseCategoryFor(String articleSource, String subcategory) {
    if ("TREATMENT".equals(articleSource)) return "veterinary";
    if (subcategory == null) return "other";
    return switch (subcategory) {
      case "FEED" -> "feed";
      case "MEDICATION" -> "veterinary";
      case "EQUIPMENT" -> "equipment";
      default -> "other";
    };
  }
}

// finance/api/FinanceFacade.java — AUCUN import livestock
public interface FinanceFacade {
  /** One received PO line, pre-resolved by the caller (inventory owns the catalog). */
  record PurchaseExpenseLine(String articleSource, String subcategory, long lineTotalXof) {}

  /** Records PURCHASE expenses for a received purchase order, grouped by expense category. */
  void recordPurchaseExpenses(
      Long farmId, Long purchaseOrderId, String orderNumber, java.time.LocalDate date,
      java.util.List<PurchaseExpenseLine> lines, Long userId);

  /** Records a STOCK_ENTRY expense for a valued manual IN/positive-adjustment movement. */
  void recordStockEntryExpense(
      Long farmId, Long stockMovementId, String articleSource, String subcategory,
      String articleLabel, long totalValueXof, java.time.LocalDate date,
      Long productionUnitId, Long userId);
}

// dto
public record ExpenseRequest(
    @NotBlank @Size(max = 100) String categoryKey,
    @NotNull @Positive Long amountXof,
    @NotNull LocalDate expenseDate,
    @NotBlank @Size(max = 200) String label,
    @Size(max = 2000) String notes,
    Long productionUnitId) {}

public record ExpenseResponse(
    Long id, String categoryKey, Long amountXof, LocalDate expenseDate, String label,
    String notes, Long productionUnitId, String source, Long purchaseOrderId,
    Long stockMovementId) {}
```
- `ExpenseService` (`@Service @RequiredArgsConstructor`, dépend de `ExpenseRepository`) :
  - `create(farmId, ExpenseRequest, userId)` → Expense `MANUAL` ;
  - `update(farmId, id, ExpenseRequest)` → charge (404 `NotFoundException.of("Expense", id)` si absent ou autre ferme), **422 `BusinessRuleException("EXPENSE_NOT_EDITABLE", ...)` si `source != MANUAL`**, met à jour les champs du request ;
  - `delete(farmId, id)` → mêmes gardes, soft delete (`repository.delete`) ;
  - `list(farmId, from, to, categoryKey, unitId)` → `repository.search(...)` mappé en responses ;
  - `summary(farmId, from, to)` → `sumByCategory` → `List<CategoryTotal(categoryKey, amountXof)>` (record interne public) + total.
- `FinanceFacadeImpl` (`@Service`, implémente la facade, dépend de `ExpenseRepository`) :
  - `recordPurchaseExpenses` : groupe les lignes par `expenseCategoryFor(...)`, ignore les groupes à total ≤ 0, crée une `Expense` par groupe (`source=PURCHASE`, `label = "Achat " + orderNumber`, `purchaseOrderId`, pas de lot, `expenseDate=date`, `createdBy=userId`) ;
  - `recordStockEntryExpense` : crée une `Expense` (`source=STOCK_ENTRY`, `label = "Entrée stock — " + articleLabel`, catégorie mappée, `stockMovementId`, `productionUnitId` hérité, montant = totalValueXof) ; no-op si `totalValueXof <= 0`.

- [ ] **Step 1 : test du mapper (échec d'abord)** — `ExpenseCategoryMapperTest` :

```java
@Test void treatmentSource_mapsToVeterinary() {
  assertThat(ExpenseCategoryMapper.expenseCategoryFor("TREATMENT", null)).isEqualTo("veterinary");
  assertThat(ExpenseCategoryMapper.expenseCategoryFor("TREATMENT", "FEED")).isEqualTo("veterinary");
}
@Test void inventorySubcategories_map() {
  assertThat(ExpenseCategoryMapper.expenseCategoryFor("INVENTORY", "FEED")).isEqualTo("feed");
  assertThat(ExpenseCategoryMapper.expenseCategoryFor("INVENTORY", "MEDICATION")).isEqualTo("veterinary");
  assertThat(ExpenseCategoryMapper.expenseCategoryFor("INVENTORY", "EQUIPMENT")).isEqualTo("equipment");
  assertThat(ExpenseCategoryMapper.expenseCategoryFor("INVENTORY", "CONSUMABLE")).isEqualTo("other");
  assertThat(ExpenseCategoryMapper.expenseCategoryFor("INVENTORY", null)).isEqualTo("other");
}
```

- [ ] **Step 2 : `ExpenseServiceTest`** (Mockito, calqué sur `MembershipServiceTest` : `Mockito.mock(ExpenseRepository.class)`) — cas : `create` persiste une MANUAL avec les champs du request ; `update` d'une dépense `PURCHASE` → `BusinessRuleException` (code `EXPENSE_NOT_EDITABLE`), repo jamais sauvé ; `delete` d'une `STOCK_ENTRY` → même exception ; `update` d'une MANUAL d'une autre ferme (farmId mismatch) → `NotFoundException` ; `recordPurchaseExpenses` (via `FinanceFacadeImpl`) avec lignes `[("INVENTORY","FEED",30000), ("INVENTORY","FEED",20000), ("TREATMENT",null,5000)]` → **2** saves : `feed` 50000 et `veterinary` 5000, source PURCHASE ; `recordStockEntryExpense` totalValue 0 → aucun save.

- [ ] **Step 3 : run rouge → implémenter → run vert** :
`cd backend && ./mvnw -pl avicare-app test -Dtest='ExpenseCategoryMapperTest,ExpenseServiceTest'` → BUILD SUCCESS après implémentation.

- [ ] **Step 4 : test-compile + spotless + commit**
```bash
cd backend && ./mvnw -q -pl avicare-app -am test-compile && ./mvnw -q spotless:apply -pl avicare-app
git add backend/avicare-app/src/main/java/com/avicare/finance backend/avicare-app/src/test/java/com/avicare/finance
git commit -m "feat(finance): expense service, category mapper and finance facade"
```

---

### Task B3 : accroches inventory → finance (réception PO + entrée valorisée)

**Files:**
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/inventory/PurchaseOrderService.java`, `.../livestock/inventory/StockMovementService.java`
- Test: étendre `backend/avicare-app/src/test/java/com/avicare/livestock/inventory/...` — les tests unitaires existants de ces services (les trouver par `find . -name "PurchaseOrderServiceTest.java" -o -name "StockMovementServiceTest.java"`) : ajouter le mock `FinanceFacade` et les cas ci-dessous. S'il n'existe pas de test unitaire pour l'un d'eux, créer le test ciblé du hook uniquement.

**Interfaces:**
- Consumes : `FinanceFacade` + `PurchaseExpenseLine` (B2) ; `InventoryCatalogService.listAllAvailableArticles()` → `InventoryCatalogItemDto(articleKey, articleSource, label, subcategory, unit, typicalUnitPriceXof)`.

- [ ] **Step 1 : hook réception** — dans `PurchaseOrderService` : injecter `FinanceFacade financeFacade` et `InventoryCatalogService inventoryCatalogService` (champs `private final`). À la fin de `receive(...)`, juste avant `return po;` :

```java
    // Finance P1 : la réception valorisée alimente le registre des dépenses (spec B6 §4).
    Map<String, InventoryCatalogItemDto> catalog =
        inventoryCatalogService.listAllAvailableArticles().stream()
            .collect(Collectors.toMap(InventoryCatalogItemDto::articleKey, a -> a, (a, b) -> a));
    List<FinanceFacade.PurchaseExpenseLine> expenseLines = new ArrayList<>();
    for (PurchaseOrderItem item : po.getItems()) {
      BigDecimal received = receipts.getOrDefault(item.getId(), BigDecimal.ZERO);
      if (received.signum() > 0 && item.getUnitPriceXof() != null) {
        long lineTotal =
            received.multiply(BigDecimal.valueOf(item.getUnitPriceXof())).longValue();
        InventoryCatalogItemDto article = catalog.get(item.getArticleKey());
        expenseLines.add(
            new FinanceFacade.PurchaseExpenseLine(
                item.getArticleSource().name(),
                article != null ? article.subcategory() : null,
                lineTotal));
      }
    }
    if (!expenseLines.isEmpty()) {
      financeFacade.recordPurchaseExpenses(
          farmId, po.getId(), po.getOrderNumber(), deliveryDate, expenseLines, userId);
    }
```
(NB : le montant utilise la **quantité reçue** × prix unitaire — pas `lineTotalXof` qui reflète la quantité commandée.)

- [ ] **Step 2 : hook STOCK_ENTRY** — dans `StockMovementService.recordMovement`, après la persistance du mouvement (lis la méthode ; le mouvement expose `getId()`, `getTotalValueXof()`, `getQuantityBefore()/getQuantityAfter()`), injecter `FinanceFacade` + `InventoryCatalogService` et ajouter :

```java
    // Finance P1 : une entrée MANUELLE valorisée est une dépense (spec B6 §4, source STOCK_ENTRY).
    boolean manual =
        cmd.purchaseOrderId() == null && cmd.dailyRecordId() == null
            && cmd.vaccinationId() == null && cmd.treatmentExecutedId() == null;
    boolean inflow =
        cmd.movementType() == MovementType.IN
            || (cmd.movementType() == MovementType.ADJUSTMENT
                && movement.getQuantityAfter().compareTo(movement.getQuantityBefore()) > 0);
    if (manual && inflow && movement.getTotalValueXof() != null && movement.getTotalValueXof() > 0) {
      InventoryCatalogItemDto article =
          inventoryCatalogService.listAllAvailableArticles().stream()
              .filter(a -> a.articleKey().equals(stockItem.getArticleKey()))
              .findFirst()
              .orElse(null);
      financeFacade.recordStockEntryExpense(
          farmId,
          movement.getId(),
          stockItem.getArticleSource().name(),
          article != null ? article.subcategory() : null,
          article != null ? article.label() : stockItem.getArticleKey(),
          movement.getTotalValueXof(),
          movement.getMovementDate(),
          cmd.productionUnitId(),
          userId);
    }
```
(Adapter les noms de variables locales à la méthode réelle — `stockItem` / `movement` ; le sens du code est contractuel, pas les identifiants.)

- [ ] **Step 3 : tests unitaires** — avec `FinanceFacade` mocké : réception d'un PO à 2 lignes FEED (reçues partiellement) + 1 ligne TREATMENT → `verify(financeFacade).recordPurchaseExpenses(...)` avec 3 `PurchaseExpenseLine` aux montants = reçu×prix ; mouvement OUT valorisé → `verify(financeFacade, never())` ; mouvement IN manuel valorisé → `verify(financeFacade).recordStockEntryExpense(...)` avec le lot hérité ; mouvement IN avec `purchaseOrderId != null` → `never()`.

- [ ] **Step 4 : gates + commit**
```bash
cd backend && ./mvnw -pl avicare-app test -Dtest='PurchaseOrderServiceTest,StockMovementServiceTest' ; ./mvnw -q -pl avicare-app -am test-compile && ./mvnw -q spotless:apply -pl avicare-app
git add -A backend/avicare-app/src
git commit -m "feat(livestock): feed finance expenses from PO receptions and valued stock entries"
```

---

### Task B4 : analytique par lot (revenu, coût, marge)

**Files:**
- Modify: `.../livestock/commercial/CommercialFacade.java` + son implémentation (la trouver : `grep -rln "implements CommercialFacade"`), `.../livestock/repository/SaleItemRepository.java` (le trouver ; sinon la requête va dans le repo existant des ventes), `.../livestock/api/LivestockFacade.java` + son implémentation, `.../livestock/repository/LifecycleEventRepository.java`
- Create: `.../finance/service/FinanceAnalyticsService.java`, `.../finance/dto/response/UnitAnalyticsResponse.java`
- Test: `backend/avicare-app/src/test/java/com/avicare/finance/service/FinanceAnalyticsServiceTest.java`

**Interfaces:**
- Produces :
```java
// CommercialFacade — méthode ajoutée
/** Total revenue (COMPLETED sales) attributed to a production unit. */
long revenueByProductionUnit(Long farmId, Long productionUnitId);
// backing query (repo des sale items) :
@Query("SELECT COALESCE(SUM(si.lineTotalXof), 0) FROM SaleItem si "
    + "WHERE si.sale.farmId = :farmId AND si.productionUnitId = :unitId "
    + "AND si.sale.status = com.avicare.livestock.domain.SaleStatus.COMPLETED")
long sumRevenueForUnit(Long farmId, Long unitId);

// LivestockFacade — méthode ajoutée
/** Initial headcount of a unit = sum of CREATED lifecycle event deltas (0 if none). */
long initialCountOf(Long unitId);
// backing query : calquer la requête SUM(quantity_delta) CREATED existante de
// LifecycleEventRepository (ligne ~26) en la scoping par production_unit_id.

// finance/dto/response/UnitAnalyticsResponse.java
public record UnitAnalyticsResponse(
    Long unitId,
    List<CategoryCost> costs,
    long totalCostXof,
    Long costPerHeadXof,       // null si effectif initial 0
    long revenueXof,
    long marginXof) {
  public record CategoryCost(String categoryKey, String label, long amountXof) {}
}
```
- `FinanceAnalyticsService` (`@Service @RequiredArgsConstructor`) — dépend de `ExpenseRepository`, `LivestockFacade`, `CommercialFacade`, `ParametersFacade` :
  - vérifie le lot : `livestockFacade.findUnit(unitId)` présent **et** `farmId` égal, sinon `NotFoundException.of("ProductionUnit", unitId)` ;
  - coûts : `expenseRepository.sumByCategoryForUnit(farmId, unitId)` → libellés via `parametersFacade.listForFarm(farmId, "expense_categories")` (map key→`value.get("label")`, fallback = key) ;
  - `revenue = commercialFacade.revenueByProductionUnit(farmId, unitId)` ; `initial = livestockFacade.initialCountOf(unitId)` ; `costPerHead = initial > 0 ? Math.round((double) totalCost / initial) : null` ; `margin = revenue − totalCost`.

- [ ] **Step 1 : test (échec d'abord)** — `FinanceAnalyticsServiceTest` (Mockito) : mocks retournent coûts `[("feed",50000),("veterinary",5000)]`, labels catalogue `feed→"Aliment"`, revenu 120000, initial 100 → assert `totalCostXof=55000`, `costPerHeadXof=550`, `marginXof=65000`, label `"Aliment"` et fallback `"veterinary"` (clé absente du catalogue mocké). + cas lot d'une autre ferme → `NotFoundException`. + cas initial 0 → `costPerHeadXof` null.
- [ ] **Step 2 : implémenter** (facades + requêtes + service) ; **Step 3 :** `./mvnw -pl avicare-app test -Dtest=FinanceAnalyticsServiceTest` vert + test-compile + spotless.
- [ ] **Step 4 : commit**
```bash
git add -A backend/avicare-app/src
git commit -m "feat(finance): per-unit analytics (costs by category, revenue, margin)"
```

---

### Task B5 : REST + `FinanceModuleIT`

**Files:**
- Create: `.../finance/controller/FinanceAccess.java`, `.../finance/controller/ExpenseController.java`, `.../finance/dto/response/ExpenseSummaryResponse.java`
- Test: `backend/avicare-app/src/test/java/com/avicare/finance/FinanceModuleIT.java`

**Interfaces:**
- `FinanceAccess` (package-private, calqué sur `livestock/controller/InventoryAccess.java`) :
```java
static final String FEATURE = "@features.isEnabled(#farmId, 'module.finance')";
static final String READ = "@farmAccess.hasPermission(#farmId, 'finance:read') and " + FEATURE;
static final String WRITE_MANAGER = "@farmAccess.hasRole(#farmId, "
    + "T(com.avicare.common.security.principal.FarmRole).OWNER, "
    + "T(com.avicare.common.security.principal.FarmRole).MANAGER) and " + FEATURE;
```
- `ExpenseController` (`@RestController @RequestMapping("/api/v1/farms/{farmId}/finance")`) :
  - `GET /expenses?from&to&category&unitId` (`READ`) → `ApiResponse<List<ExpenseResponse>>`
  - `POST /expenses` (`WRITE_MANAGER`, 201), `PUT /expenses/{id}` (`WRITE_MANAGER`), `DELETE /expenses/{id}` (`WRITE_MANAGER`, 204)
  - `GET /summary?from&to` (`READ`) → `ApiResponse<ExpenseSummaryResponse>` avec `record ExpenseSummaryResponse(List<CategoryTotal> categories, long totalXof)` (+ record interne `CategoryTotal(String categoryKey, long amountXof)`)
  - `GET /units/{unitId}/analytics` (`READ`) → `ApiResponse<UnitAnalyticsResponse>`
  - `created_by` = `TenancyContext.currentUserId()` (pattern des autres contrôleurs).

- [ ] **Step 1 : IT** `FinanceModuleIT` (calquer bootstrap + helpers verbatim sur `com.avicare.tenancy.ModulePermissionIT` : Testcontainers, `onboardOwner/relogin/createFarm/enableModule/addMember/loginWith`) — cas :
  1. **Manuelle + analytics** : owner, ferme, `enableModule(module.finance)` + `enableModule(module.poultry.broiler)` ; créer un lot via `POST /production-units` (breedId depuis `GET /api/v1/breeds`, `unitKind:"BATCH"`, `initialCount:100`, name, startDate) — **vérifier d'abord dans `LivestockService.createUnit` que la création journalise un LifecycleEvent CREATED avec delta=initialCount** (c'est le socle A5/B5 ; si oui `initialCountOf`=100) ; `POST /finance/expenses {categoryKey:"feed", amountXof:50000, label:"Aliment", expenseDate:..., productionUnitId:<lot>}` → 201 ; `GET /finance/units/<lot>/analytics` → `totalCostXof=50000`, `costPerHeadXof=500`, `marginXof=-50000`.
  2. **PURCHASE auto** : `enableModule(module.inventory)` ; créer un fournisseur + PO draft 2 lignes valorisées (calquer le flux sur un IT inventory existant : `InventoryApiIT` a le parcours PO) ; send → receive intégral → `GET /finance/expenses` contient ≥1 dépense `source:"PURCHASE"` au bon montant.
  3. **STOCK_ENTRY auto** : mouvement IN manuel valorisé (`unitPriceXof` non nul) via `POST .../inventory/stock-movements` → `GET /finance/expenses` contient une `STOCK_ENTRY` du bon montant.
  4. **Guard édition** : `PUT /finance/expenses/{id}` sur la dépense PURCHASE → **422**.
  5. **RBAC** : provisionner un FARMER réel → `GET /finance/expenses` → **403** ; owner sans `module.finance` (nouvelle ferme sans enable) → **403**.
- [ ] **Step 2 : contrôleur + access + summary DTO** (code ci-dessus).
- [ ] **Step 3 : gates** — test-compile exit 0 + spotless (IT s'exécute en CI).
- [ ] **Step 4 : commit**
```bash
git add backend/avicare-app/src/main/java/com/avicare/finance backend/avicare-app/src/test/java/com/avicare/finance
git commit -m "feat(finance): expense and analytics REST endpoints with module gating"
```

---

### Task F6 : `financeApi` + page Dépenses + `ExpenseDialog`

**Files:**
- Create: `web/src/store/api/financeApi.ts`, `web/src/components/finance/ExpensesView.tsx`, `web/src/components/finance/ExpenseDialog.tsx`, `web/src/app/(dashboard)/finance/depenses/page.tsx`
- Modify: `web/src/store/api/baseApi.ts` (tag `"Expense"` après `"Payment"`), `web/src/types/index.ts` (types finance)
- Test: `web/src/components/finance/ExpenseDialog.test.tsx`, `web/src/components/finance/ExpensesView.test.tsx`

**Interfaces:**
- Types (`types/index.ts`) :
```ts
export type ExpenseSource = "MANUAL" | "PURCHASE" | "STOCK_ENTRY" | "SALARY";
export interface Expense {
  id: number; categoryKey: string; amountXof: number; expenseDate: string; label: string;
  notes: string | null; productionUnitId: number | null; source: ExpenseSource;
  purchaseOrderId: number | null; stockMovementId: number | null;
}
export interface ExpenseInput {
  categoryKey: string; amountXof: number; expenseDate: string; label: string;
  notes?: string; productionUnitId?: number;
}
export interface ExpenseSummary { categories: { categoryKey: string; amountXof: number }[]; totalXof: number; }
export interface UnitAnalytics {
  unitId: number; costs: { categoryKey: string; label: string; amountXof: number }[];
  totalCostXof: number; costPerHeadXof: number | null; revenueXof: number; marginXof: number;
}
```
- `financeApi` (pattern `catalogApi` : `baseApi.injectEndpoints`, `ApiEnvelope`, `transformResponse: r => r.data`) : `getExpenses({farmId, from?, to?, category?, unitId?})` (providesTags `[{type:"Expense", id:\`LIST-${farmId}\`}]`), `createExpense({farmId, body: ExpenseInput})`, `updateExpense({farmId, id, body})`, `deleteExpense({farmId, id})` (tous invalident le tag), `getExpenseSummary({farmId, from?, to?})` (providesTags même tag), `getUnitAnalytics({farmId, unitId})`.
- `ExpenseDialog({open, onClose, farmId, expense?})` : RHF+zod (categoryKey requis, label requis, amountXof > 0 entier, expenseDate requis ISO, productionUnitId optionnel) ; catégories depuis `useGetCatalogQuery({farmId, category:"expense_categories"})` (**réutilise `catalogApi`** — label = `String(entry.value.label ?? entry.key)`) ; lots depuis `useGetProductionUnitsQuery({ farmId })` (option « Aucun lot ») ; reset **edge-triggered** (`wasOpen` ref, pattern `CatalogEntryDialog`) ; submit → create ou update selon `expense`.
- `ExpensesView({farmId})` : `useGetExpensesQuery` + `useGetExpenseSummaryQuery` ; bandeau total période + table (Date, Libellé, Catégorie, Lot, Montant, Origine badge — `MANUAL`→«Manuelle», `PURCHASE`→«Achat», `STOCK_ENTRY`→«Entrée stock», `SALARY`→«Salaire» ; chips tokens `colors.primary[50]/accent[50]`) ; actions Modifier/Supprimer **uniquement** si `source === "MANUAL"` (et gated `canManageCatalog(useFarmRole(farmId))` — réutilise le hook PR #115, la règle OWNER/MANAGER est identique) ; filtre catégorie (select depuis le catalogue) ; ConfirmDialog pour suppression ; skeleton/vide/erreur + toasts (patterns maison).
- Page `depenses/page.tsx` : client wrapper mince avec `useSelectedFarm` (pattern `CatalogCategoryView` : skeleton tant que `farmId` absent).

- [ ] **Step 1 : tests (échec d'abord)** — stub fetch (idiome `AddMemberDialog.test.tsx`, avec `input.clone().json()` pour capturer le body, **`/catalog/` matché avant `/api/v1/farms`**) :
  - `ExpenseDialog` : création envoie `{categoryKey, amountXof, expenseDate, label, productionUnitId}` exact ; catégorie select alimentée par le stub catalogue (`[{key:"feed", value:{label:"Aliment"}}]`).
  - `ExpensesView` : la table rend une MANUAL avec boutons Modifier/Supprimer et une PURCHASE **sans** (badge «Achat» présent) ; total du summary affiché.
- [ ] **Step 2 : implémenter** ; **Step 3 : vérifier** — `npx vitest run src/components/finance` vert ; `npx tsc --noEmit 2>&1 | grep -iE "finance|Expense"` → rien.
- [ ] **Step 4 : commit**
```bash
git add web/src/store/api/financeApi.ts web/src/store/api/baseApi.ts web/src/types/index.ts web/src/components/finance web/src/app/\(dashboard\)/finance/depenses
git commit -m "feat(web): finance expenses page with manual entry and source badges"
```

---

### Task F7 : page Analytique + Sidebar Finance + prix sur le mouvement + gates complets

**Files:**
- Create: `web/src/components/finance/UnitAnalyticsView.tsx`, `web/src/app/(dashboard)/finance/analytique/page.tsx`
- Modify: `web/src/components/layout/Sidebar.tsx` (groupe Finance), `web/src/components/inventory/StockMovementDialog.tsx` (champ prix optionnel)
- Test: `web/src/components/finance/UnitAnalyticsView.test.tsx` + étendre `web/src/components/layout/Sidebar.test.tsx`

**Interfaces:**
- Consumes : `useGetUnitAnalyticsQuery` (F6), `useGetProductionUnitsQuery`, `useFarmPermissions` (gating déjà dans Sidebar).

- [ ] **Step 1 : `UnitAnalyticsView({farmId})`** — sélecteur de lot (`useGetProductionUnitsQuery`, défaut = premier) ; 3 KPI cards (Coût total / Revenus / Marge — marge en `colors.success.main` si ≥0 sinon `colors.error.main`) + « Coût par tête » si non null ; table Catégorie/Montant. Test : stub analytics `{costs:[{categoryKey:"feed",label:"Aliment",amountXof:50000}], totalCostXof:50000, costPerHeadXof:500, revenueXof:120000, marginXof:70000}` → assert KPI et ligne Aliment.
- [ ] **Step 2 : Sidebar** — dans `NAV`, après le groupe `commercial`, ajouter :
```ts
{
  kind: "group",
  key: "finance",
  label: "Finance",
  icon: Wallet,                    // lucide-react
  requiredModule: "module.finance",
  requiredPermission: "finance:read",
  children: [
    { label: "Dépenses", href: "/finance/depenses", icon: Receipt },
    { label: "Analytique", href: "/finance/analytique", icon: TrendingUp },
  ],
},
```
Étendre `Sidebar.test.tsx` : avec `module.finance` actif + perm `finance:read` → « Finance » visible ; FARMER (poultry/health seulement) → absent ; module non souscrit → absent même avec `["*"]`.
- [ ] **Step 3 : `StockMovementDialog`** — lire le composant ; ajouter un champ optionnel « Prix unitaire (XOF) » envoyé comme `unitPriceXof` (le DTO backend l'accepte déjà), pré-rempli depuis `typicalUnitPriceXof` de l'article sélectionné quand disponible, avec l'aide « Une entrée valorisée est enregistrée automatiquement en dépense. » Ne rien changer d'autre au dialog.
- [ ] **Step 4 : GATES COMPLETS** :
```bash
cd web && npx tsc --noEmit && npm run lint && npx vitest run && npx next build
```
Tout vert exigé (dernier gate front).
- [ ] **Step 5 : commit**
```bash
git add web/src/components/finance web/src/app/\(dashboard\)/finance/analytique web/src/components/layout/Sidebar.tsx web/src/components/layout/Sidebar.test.tsx web/src/components/inventory/StockMovementDialog.tsx
git commit -m "feat(web): unit analytics page, finance nav group and valued stock entries"
```

---

## Self-Review (couverture spec P1)

- §4 table `expenses` + index + trigger → B1. Sources MANUAL/PURCHASE/STOCK_ENTRY → B2 (service+facade) + B3 (hooks). Garde `EXPENSE_NOT_EDITABLE` → B2 (+IT B5 cas 4). Anti-double-compte UI (badges, actions MANUAL only) → F6. ✓
- §4 endpoints : expenses CRUD+filters+summary+analytics → B5 ; analytics calculs (coût/catégorie, coût/tête ÷ initial, revenu V24, marge) → B4. ✓
- §6 RBAC : READ=finance:read+module, WRITE=OWNER/MANAGER+module → B5 ; Sidebar requiredModule+requiredPermission → F7. ✓
- §7 P1 frontend : page Dépenses (catalogue catégories via catalogApi) + Analytique + champ prix mouvement → F6/F7. ✓
- §9 tests : mapper/service/hooks/analytics unit → B2/B3/B4 ; IT complet → B5 ; Vitest → F6/F7. ✓
- P2 (salaires/avances, V26) : hors de ce plan — plan séparé après merge P1. `expenses.salary_id` créé nullable en V25 ✓ (spec §10).

**Type consistency:** `FinanceFacade.PurchaseExpenseLine(String,String,long)` produit en B2, consommé en B3 ; `UnitAnalyticsResponse` (B4) exposé tel quel en B5 et typé `UnitAnalytics` en F6/F7 ; `ExpenseResponse.source` string ↔ union TS `ExpenseSource` ; tags RTK `Expense` cohérents entre F6 queries/mutations.

**Ordering:** B1 → B2 → B3 → B4 → B5 (backend) → F6 → F7 (front, F7 = porte tout-vert). B3 dépend de B2 (facade) ; B4 de B1 (repo) ; B5 de B2+B4.

**Ambiguïtés résolues pour l'implémenteur :** montant PURCHASE = quantité **reçue** × prix (pas lineTotalXof commandé) ; identifiants locaux des hooks B3 à adapter au code réel (le sens est contractuel) ; vérification du LifecycleEvent CREATED avant d'écrire l'assertion coût/tête de l'IT (B5 cas 1).
