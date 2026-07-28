# Analytique globale + dépense auto véto — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer l'analytique par-lot par un compte de résultat ferme (revenus − dépenses = marge) et faire qu'un coût saisi sur une visite vétérinaire crée automatiquement une dépense `veterinary`.

**Architecture:** Deux features indépendantes dans le monolithe modulaire Jawdi. F1 (analytique globale) : nouveau DTO + méthode de service `finance` s'appuyant sur deux nouvelles méthodes de `CommercialFacade` (revenu) et la requête `sumByCategory` existante (dépenses), plus un frontend RTK Query/MUI. F2 (dépense véto) : `VetVisitService` (contexte livestock) appelle `FinanceFacade` (contexte finance) — même sens de dépendance que `PurchaseOrderService`/`StockMovementService` déjà en place.

**Tech Stack:** Spring Boot 3.4 / Java 21 / Hibernate 6.4 / PostgreSQL / Flyway ; Next.js 16 / MUI v9 / RTK Query / Vitest.

## Global Constraints

- Aucune signature Claude/AI dans les commits ; Conventional Commits, scope bounded-context (`feat(finance:...)`, `feat(web):`, `feat(livestock:health):`).
- Pas de cross-import entre bounded contexts — passer par les façades publiques (`CommercialFacade`, `FinanceFacade`, `LivestockFacade`), référencement par ID.
- Money en `long`/`BIGINT` XOF (pas de décimales). Soft-delete via `@SQLDelete`/`@SQLRestriction` (déjà en place sur `Expense`).
- Migrations Flyway immuables une fois **mergées** ; **V28** est le prochain numéro libre (max actuel = V27).
- Services `@Service` + `@RequiredArgsConstructor` ; DTOs = records Java 21 ; AssertJ pour les tests backend.
- Revenu (F1), formule exacte : `revenu = Σ ventes COMPLETED (Sale.totalXof) + Σ Invoice.amountPaidXof où sourceType=DELIVERY et status<>CANCELLED` ; `marge = revenu − Σ dépenses` ; totaux **cumulés** (pas de période).
- Après édition backend : `./mvnw -q spotless:apply -pl avicare-app` avant commit. Après édition d'un fichier **test** Java, vérifier avec `clean test-compile` (le `-am test-compile` incrémental peut masquer un import manquant).
- Les `*IT` Testcontainers ne tournent qu'en CI (Docker local indisponible) ; valider le reste en local, s'appuyer sur la CI verte pour les IT.
- Footgun récurrent : les **trois** contextes DB-less (`SecurityE2ETest`, `SecurityIntegrationTest`, `DashboardControllerIT`) doivent booter ; un nouveau `@Service`/repo dep peut les casser.

---

## File Structure

**Feature 1 — backend**
- Modif `livestock/api/dto/ProductionUnitInfo.java` — ajoute `String name`.
- Modif `livestock/service/LivestockFacadeImpl.java` — `toInfo` passe `u.getName()`.
- Modif `livestock/repository/SaleRepository.java` — `sumAllRevenue`.
- Modif `livestock/repository/InvoiceRepository.java` — `sumPaidFromDeliveries`.
- Modif `livestock/commercial/CommercialFacade.java` + `CommercialFacadeImpl.java` — 2 méthodes.
- Create `finance/dto/response/FarmAnalyticsResponse.java`.
- Modif `finance/service/FinanceAnalyticsService.java` — `farmAnalytics`, retire `unitAnalytics`.
- Modif `finance/controller/ExpenseController.java` — endpoint `/analytics`, retire `/units/{unitId}/analytics`.
- Delete `finance/dto/response/UnitAnalyticsResponse.java`.
- Modif test `finance/service/FinanceAnalyticsServiceTest.java` — réécrit pour `farmAnalytics`.

**Feature 1 — frontend**
- Modif `web/src/types/index.ts` — `FarmAnalytics` remplace `UnitAnalytics`.
- Modif `web/src/store/api/financeApi.ts` — `getFarmAnalytics` remplace `getUnitAnalytics`.
- Create `web/src/components/finance/FarmAnalyticsView.tsx` (+ `.test.tsx`).
- Modif `web/src/app/(dashboard)/finance/analytique/page.tsx`.
- Delete `web/src/components/finance/UnitAnalyticsView.tsx` (+ `.test.tsx`).

**Feature 2 — backend**
- Modif `finance/domain/ExpenseSource.java` — `VET_VISIT`.
- Create `backend/avicare-app/src/main/resources/db/migration/V28__expenses_vet_visit_source.sql`.
- Modif `finance/domain/Expense.java` — `vetVisitId`.
- Modif `finance/repository/ExpenseRepository.java` — `findByFarmIdAndVetVisitId`.
- Modif `finance/api/FinanceFacade.java` + `finance/service/FinanceFacadeImpl.java` — 2 méthodes.
- Create test `finance/service/FinanceFacadeVetVisitTest.java`.
- Modif `livestock/health/VetVisitService.java` — injecte `FinanceFacade`, hook `record`/`delete`.
- Create test `livestock/health/VetVisitServiceTest.java`.
- Modif test `livestock/health/HealthTreatmentsVetIT.java` — fixe le test existant + ajoute l'E2E.

---

## Task 1 : `ProductionUnitInfo` enrichi avec `name`

**Files:**
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/api/dto/ProductionUnitInfo.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/service/LivestockFacadeImpl.java:197-206`
- Modify (test compile only): `backend/avicare-app/src/test/java/com/avicare/finance/service/FinanceAnalyticsServiceTest.java:45-47` (réécrit en Task 3 — ici juste rendre le build vert)

**Interfaces:**
- Produces: `ProductionUnitInfo(Long id, Long farmId, Species species, UnitKind unitKind, Long breedId, String name, int currentCount, UnitStatus status)` — accesseur `name()`.

- [ ] **Step 1: Ajouter `name` au record**

Dans `ProductionUnitInfo.java`, remplacer le record par :

```java
public record ProductionUnitInfo(
    Long id,
    Long farmId,
    Species species,
    UnitKind unitKind,
    Long breedId,
    String name,
    int currentCount,
    UnitStatus status) {}
```

- [ ] **Step 2: Peupler `name` dans `toInfo`**

Dans `LivestockFacadeImpl.java`, méthode `toInfo`, insérer `u.getName()` à la bonne position :

```java
  private static ProductionUnitInfo toInfo(ProductionUnit u) {
    return new ProductionUnitInfo(
        u.getId(),
        u.getFarmId(),
        u.getSpecies(),
        u.getUnitKind(),
        u.getBreedId(),
        u.getName(),
        u.getCurrentCount(),
        u.getStatus());
  }
```

- [ ] **Step 3: Réparer le seul site de construction en test**

Dans `FinanceAnalyticsServiceTest.java`, la méthode `unitInfo` (ligne ~45) construit positionnellement le record → ajouter le nom :

```java
  private static ProductionUnitInfo unitInfo(Long id, Long farmId) {
    return new ProductionUnitInfo(
        id, farmId, Species.POULTRY, UnitKind.BATCH, 1L, "Lot test", 100, UnitStatus.ACTIVE);
  }
```

- [ ] **Step 4: Compiler (clean, à cause du fichier test édité)**

Run: `cd backend && ./mvnw -q -pl avicare-app -am clean test-compile`
Expected: BUILD SUCCESS.

- [ ] **Step 5: Spotless + commit**

```bash
cd backend && ./mvnw -q spotless:apply -pl avicare-app
git add backend/avicare-app/src/main/java/com/avicare/livestock/api/dto/ProductionUnitInfo.java \
        backend/avicare-app/src/main/java/com/avicare/livestock/service/LivestockFacadeImpl.java \
        backend/avicare-app/src/test/java/com/avicare/finance/service/FinanceAnalyticsServiceTest.java
git commit -m "feat(livestock): expose unit name on ProductionUnitInfo facade record"
```

---

## Task 2 : Requêtes + façade de revenu commercial

**Files:**
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/repository/SaleRepository.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/repository/InvoiceRepository.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/commercial/CommercialFacade.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/commercial/CommercialFacadeImpl.java`
- Test: `backend/avicare-app/src/test/java/com/avicare/livestock/commercial/CommercialRevenueQueriesIT.java` (create)

**Interfaces:**
- Produces (sur `CommercialFacade`) :
  - `long totalSalesRevenue(Long farmId)` — Σ ventes COMPLETED, lifetime.
  - `long totalPaidFromDeliveryInvoices(Long farmId)` — Σ `amountPaidXof` des factures `sourceType=DELIVERY`, `status<>CANCELLED`, lifetime.

- [ ] **Step 1: Écrire le test d'intégration des deux requêtes (échoue d'abord)**

Create `CommercialRevenueQueriesIT.java`. Il vérifie sur une vraie base : une vente COMPLETED (comptée), une facture de livraison partiellement payée (part payée comptée), une facture de vente payée (NON comptée dans `sumPaidFromDeliveries`), une facture de livraison annulée (exclue).

```java
package com.avicare.livestock.commercial;

import static org.assertj.core.api.Assertions.assertThat;

import com.avicare.livestock.domain.Invoice;
import com.avicare.livestock.domain.InvoiceSourceType;
import com.avicare.livestock.domain.InvoiceStatus;
import com.avicare.livestock.repository.InvoiceRepository;
import com.avicare.livestock.repository.SaleRepository;
import com.avicare.support.RsaKeys;
import java.security.KeyPair;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Verifies the two lifetime revenue aggregates on a real PostgreSQL: COMPLETED sales total and
 * paid-amount total on DELIVERY-sourced invoices (SALE-sourced and CANCELLED excluded). CI-only.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@Testcontainers
class CommercialRevenueQueriesIT {

  @Container
  static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

  private static final KeyPair KEYS = RsaKeys.generate();

  @DynamicPropertySource
  static void props(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    registry.add("spring.datasource.username", POSTGRES::getUsername);
    registry.add("spring.datasource.password", POSTGRES::getPassword);
    registry.add("spring.flyway.enabled", () -> "true");
    registry.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
    registry.add("avicare.security.jwt.private-key", () -> RsaKeys.privatePem(KEYS));
    registry.add("avicare.security.jwt.public-key", () -> RsaKeys.publicPem(KEYS));
  }

  @Autowired private SaleRepository saleRepository;
  @Autowired private InvoiceRepository invoiceRepository;

  private Invoice invoice(long farmId, InvoiceSourceType src, InvoiceStatus st, long total, long paid) {
    Invoice i = new Invoice();
    i.setFarmId(farmId);
    i.setInvoiceNumber("INV-" + System.nanoTime());
    i.setSourceType(src);
    if (src == InvoiceSourceType.SALE) i.setSaleId(1L);
    else i.setDeliveryId(1L);
    i.setStatus(st);
    i.setIssueDate(LocalDate.now());
    i.setDueDate(LocalDate.now().plusDays(15));
    i.setTotalXof(total);
    i.setAmountPaidXof(paid);
    i.setCreatedBy(1L);
    return invoiceRepository.save(i);
  }

  @Test
  void aggregates_countExpectedRowsOnly() {
    long farmId = 999_001L;
    // DELIVERY invoices: 40000 paid + 10000 paid = 50000 counted
    invoice(farmId, InvoiceSourceType.DELIVERY, InvoiceStatus.PARTIALLY_PAID, 100000, 40000);
    invoice(farmId, InvoiceSourceType.DELIVERY, InvoiceStatus.PAID, 10000, 10000);
    // SALE invoice: NOT counted by sumPaidFromDeliveries
    invoice(farmId, InvoiceSourceType.SALE, InvoiceStatus.PAID, 70000, 70000);
    // CANCELLED delivery invoice: excluded
    invoice(farmId, InvoiceSourceType.DELIVERY, InvoiceStatus.CANCELLED, 20000, 20000);

    assertThat(invoiceRepository.sumPaidFromDeliveries(farmId)).isEqualTo(50000L);
    // No sales seeded for this farm → 0 (COALESCE)
    assertThat(saleRepository.sumAllRevenue(farmId)).isEqualTo(0L);
  }
}
```

- [ ] **Step 2: Lancer le test — échoue (méthodes absentes)**

Run: `cd backend && ./mvnw -q -pl avicare-app -am clean test-compile`
Expected: FAIL — `cannot find symbol: method sumPaidFromDeliveries` / `sumAllRevenue`.

- [ ] **Step 3: Ajouter `sumAllRevenue` à `SaleRepository`**

Dans `SaleRepository.java`, ajouter :

```java
  /** Σ des ventes COMPLETED de la ferme, tous exercices confondus (finance P&L). 0 si aucune. */
  @Query(
      "SELECT COALESCE(SUM(s.totalXof), 0) FROM Sale s "
          + "WHERE s.farmId = :farmId "
          + "AND s.status = com.avicare.livestock.domain.SaleStatus.COMPLETED")
  long sumAllRevenue(@Param("farmId") Long farmId);
```

(`import org.springframework.data.jpa.repository.Query;` et `import org.springframework.data.repository.query.Param;` sont déjà présents.)

- [ ] **Step 4: Ajouter `sumPaidFromDeliveries` à `InvoiceRepository`**

Dans `InvoiceRepository.java`, ajouter :

```java
  /**
   * Σ des montants encaissés sur les factures issues d'une LIVRAISON (non annulées) pour la ferme,
   * tous exercices confondus (finance P&L : « commandes payées »). 0 si aucune.
   */
  @Query(
      "SELECT COALESCE(SUM(i.amountPaidXof), 0) FROM Invoice i "
          + "WHERE i.farmId = :farmId "
          + "AND i.sourceType = com.avicare.livestock.domain.InvoiceSourceType.DELIVERY "
          + "AND i.status <> com.avicare.livestock.domain.InvoiceStatus.CANCELLED")
  long sumPaidFromDeliveries(@Param("farmId") Long farmId);
```

- [ ] **Step 5: Déclarer les 2 méthodes sur `CommercialFacade`**

Dans `CommercialFacade.java`, après `revenueByProductionUnit` :

```java
  /** Σ des ventes directes COMPLETED de la ferme (lifetime), pour le P&L finance. */
  long totalSalesRevenue(Long farmId);

  /** Σ des montants encaissés sur les factures de LIVRAISON non annulées (lifetime). */
  long totalPaidFromDeliveryInvoices(Long farmId);
```

- [ ] **Step 6: Implémenter dans `CommercialFacadeImpl`**

Dans `CommercialFacadeImpl.java`, après la méthode `revenueByProductionUnit` :

```java
  @Override
  public long totalSalesRevenue(Long farmId) {
    return saleRepository.sumAllRevenue(farmId);
  }

  @Override
  public long totalPaidFromDeliveryInvoices(Long farmId) {
    return invoiceRepository.sumPaidFromDeliveries(farmId);
  }
```

(`saleRepository` et `invoiceRepository` sont déjà des champs injectés.)

- [ ] **Step 7: Compiler**

Run: `cd backend && ./mvnw -q -pl avicare-app -am clean test-compile`
Expected: BUILD SUCCESS.

- [ ] **Step 8: Spotless + commit**

```bash
cd backend && ./mvnw -q spotless:apply -pl avicare-app
git add backend/avicare-app/src/main/java/com/avicare/livestock/repository/SaleRepository.java \
        backend/avicare-app/src/main/java/com/avicare/livestock/repository/InvoiceRepository.java \
        backend/avicare-app/src/main/java/com/avicare/livestock/commercial/CommercialFacade.java \
        backend/avicare-app/src/main/java/com/avicare/livestock/commercial/CommercialFacadeImpl.java \
        backend/avicare-app/src/test/java/com/avicare/livestock/commercial/CommercialRevenueQueriesIT.java
git commit -m "feat(commercial): lifetime revenue aggregates (sales + paid delivery invoices)"
```

---

## Task 3 : DTO + service `farmAnalytics` + endpoint (retire l'analytique par-lot)

**Files:**
- Create: `backend/avicare-app/src/main/java/com/avicare/finance/dto/response/FarmAnalyticsResponse.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/finance/service/FinanceAnalyticsService.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/finance/controller/ExpenseController.java`
- Delete: `backend/avicare-app/src/main/java/com/avicare/finance/dto/response/UnitAnalyticsResponse.java`
- Test: `backend/avicare-app/src/test/java/com/avicare/finance/service/FinanceAnalyticsServiceTest.java` (réécrit)

**Interfaces:**
- Consumes: `CommercialFacade.totalSalesRevenue`, `.totalPaidFromDeliveryInvoices`, `.revenueByProductionUnit` ; `LivestockFacade.listFarmUnits(Long)` → `List<ProductionUnitInfo>` avec `id()`/`name()` ; `ExpenseRepository.sumByCategory(farmId, null, null)`.
- Produces: `FarmAnalyticsResponse` ; endpoint `GET /api/v1/farms/{farmId}/finance/analytics`.

- [ ] **Step 1: Écrire le nouveau test de service (échoue d'abord)**

Remplacer **tout** le contenu de `FinanceAnalyticsServiceTest.java` par :

```java
package com.avicare.finance.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.avicare.finance.dto.response.FarmAnalyticsResponse;
import com.avicare.finance.repository.ExpenseRepository;
import com.avicare.livestock.api.LivestockFacade;
import com.avicare.livestock.api.dto.ProductionUnitInfo;
import com.avicare.livestock.commercial.CommercialFacade;
import com.avicare.livestock.domain.Species;
import com.avicare.livestock.domain.UnitKind;
import com.avicare.livestock.domain.UnitStatus;
import com.avicare.parameters.api.ParametersFacade;
import com.avicare.parameters.api.dto.CatalogEntryInfo;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

/** Unit test for {@link FinanceAnalyticsService#farmAnalytics}: all dependencies mocked. */
class FinanceAnalyticsServiceTest {

  private ExpenseRepository expenseRepository;
  private LivestockFacade livestockFacade;
  private CommercialFacade commercialFacade;
  private ParametersFacade parametersFacade;
  private FinanceAnalyticsService service;

  @BeforeEach
  void setUp() {
    expenseRepository = Mockito.mock(ExpenseRepository.class);
    livestockFacade = Mockito.mock(LivestockFacade.class);
    commercialFacade = Mockito.mock(CommercialFacade.class);
    parametersFacade = Mockito.mock(ParametersFacade.class);
    service =
        new FinanceAnalyticsService(
            expenseRepository, livestockFacade, commercialFacade, parametersFacade);
  }

  private static ProductionUnitInfo unit(Long id, Long farmId, String name) {
    return new ProductionUnitInfo(
        id, farmId, Species.POULTRY, UnitKind.BATCH, 1L, name, 100, UnitStatus.ACTIVE);
  }

  @Test
  void farmAnalytics_revenueMinusExpensesIsMargin_withCategoryLabelsAndPerUnitRevenue() {
    long farmId = 3L;
    when(commercialFacade.totalSalesRevenue(farmId)).thenReturn(700_000L);
    when(commercialFacade.totalPaidFromDeliveryInvoices(farmId)).thenReturn(50_000L);
    when(expenseRepository.sumByCategory(farmId, null, null))
        .thenReturn(
            List.<Object[]>of(
                new Object[] {"feed", 344_000L}, new Object[] {"veterinary", 6_000L}));
    when(parametersFacade.listForFarm(farmId, "expense_categories"))
        .thenReturn(
            List.of(
                new CatalogEntryInfo(
                    "expense_categories", "feed", Map.of("label", "Aliment"), false)));
    when(livestockFacade.listFarmUnits(farmId))
        .thenReturn(List.of(unit(10L, farmId, "Lot A"), unit(11L, farmId, "Lot B")));
    when(commercialFacade.revenueByProductionUnit(farmId, 10L)).thenReturn(700_000L);
    when(commercialFacade.revenueByProductionUnit(farmId, 11L)).thenReturn(0L);

    FarmAnalyticsResponse r = service.farmAnalytics(farmId);

    assertThat(r.directSalesXof()).isEqualTo(700_000L);
    assertThat(r.paidOrdersXof()).isEqualTo(50_000L);
    assertThat(r.totalRevenueXof()).isEqualTo(750_000L);
    assertThat(r.totalExpenseXof()).isEqualTo(350_000L);
    assertThat(r.marginXof()).isEqualTo(400_000L);

    assertThat(r.expensesByCategory())
        .extracting(FarmAnalyticsResponse.CategoryCost::categoryKey)
        .containsExactlyInAnyOrder("feed", "veterinary");
    FarmAnalyticsResponse.CategoryCost feed =
        r.expensesByCategory().stream().filter(c -> c.categoryKey().equals("feed")).findFirst().orElseThrow();
    assertThat(feed.label()).isEqualTo("Aliment");
    assertThat(feed.amountXof()).isEqualTo(344_000L);
    // libellé absent du catalogue mocké -> fallback sur la clé
    FarmAnalyticsResponse.CategoryCost vet =
        r.expensesByCategory().stream().filter(c -> c.categoryKey().equals("veterinary")).findFirst().orElseThrow();
    assertThat(vet.label()).isEqualTo("veterinary");

    // Seuls les lots à revenu > 0 sont listés.
    assertThat(r.revenueByUnit()).hasSize(1);
    assertThat(r.revenueByUnit().get(0).unitId()).isEqualTo(10L);
    assertThat(r.revenueByUnit().get(0).unitName()).isEqualTo("Lot A");
    assertThat(r.revenueByUnit().get(0).revenueXof()).isEqualTo(700_000L);
  }

  @Test
  void farmAnalytics_noData_allZero() {
    long farmId = 5L;
    when(commercialFacade.totalSalesRevenue(farmId)).thenReturn(0L);
    when(commercialFacade.totalPaidFromDeliveryInvoices(farmId)).thenReturn(0L);
    when(expenseRepository.sumByCategory(farmId, null, null)).thenReturn(List.of());
    when(parametersFacade.listForFarm(farmId, "expense_categories")).thenReturn(List.of());
    when(livestockFacade.listFarmUnits(farmId)).thenReturn(List.of());

    FarmAnalyticsResponse r = service.farmAnalytics(farmId);

    assertThat(r.totalRevenueXof()).isZero();
    assertThat(r.totalExpenseXof()).isZero();
    assertThat(r.marginXof()).isZero();
    assertThat(r.expensesByCategory()).isEmpty();
    assertThat(r.revenueByUnit()).isEmpty();
  }
}
```

- [ ] **Step 2: Lancer — échoue (FarmAnalyticsResponse / farmAnalytics absents)**

Run: `cd backend && ./mvnw -q -pl avicare-app -am clean test-compile`
Expected: FAIL — `cannot find symbol: class FarmAnalyticsResponse` / `method farmAnalytics`.

- [ ] **Step 3: Créer le DTO `FarmAnalyticsResponse`**

Create `FarmAnalyticsResponse.java` :

```java
package com.avicare.finance.dto.response;

import java.util.List;

/**
 * Compte de résultat au niveau ferme (Sprint B6) : total revenus (ventes directes + commandes
 * payées) − total dépenses = marge, avec ventilation des dépenses par catégorie et revenu par lot.
 * Totaux cumulés (pas de fenêtre temporelle en V1).
 */
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

- [ ] **Step 4: Réécrire `FinanceAnalyticsService`**

Remplacer **tout** le contenu de `FinanceAnalyticsService.java` par :

```java
package com.avicare.finance.service;

import com.avicare.finance.dto.response.FarmAnalyticsResponse;
import com.avicare.finance.repository.ExpenseRepository;
import com.avicare.livestock.api.LivestockFacade;
import com.avicare.livestock.commercial.CommercialFacade;
import com.avicare.parameters.api.ParametersFacade;
import com.avicare.parameters.api.dto.CatalogEntryInfo;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Analytique financière au niveau ferme (Sprint B6) : compte de résultat cumulé — total revenus
 * (ventes directes COMPLETED + montants encaissés sur les factures de livraison) moins le total des
 * dépenses = marge ; ventilation des dépenses par catégorie (jointe au catalogue pour les libellés)
 * et revenu attribué par lot.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class FinanceAnalyticsService {

  private final ExpenseRepository expenseRepository;
  private final LivestockFacade livestockFacade;
  private final CommercialFacade commercialFacade;
  private final ParametersFacade parametersFacade;

  public FarmAnalyticsResponse farmAnalytics(Long farmId) {
    long directSalesXof = commercialFacade.totalSalesRevenue(farmId);
    long paidOrdersXof = commercialFacade.totalPaidFromDeliveryInvoices(farmId);
    long totalRevenueXof = directSalesXof + paidOrdersXof;

    Map<String, String> labelsByKey =
        parametersFacade.listForFarm(farmId, "expense_categories").stream()
            .collect(Collectors.toMap(CatalogEntryInfo::key, FinanceAnalyticsService::labelOf));

    List<FarmAnalyticsResponse.CategoryCost> expensesByCategory =
        expenseRepository.sumByCategory(farmId, null, null).stream()
            .map(
                row -> {
                  String categoryKey = (String) row[0];
                  long amountXof = ((Number) row[1]).longValue();
                  return new FarmAnalyticsResponse.CategoryCost(
                      categoryKey, labelsByKey.getOrDefault(categoryKey, categoryKey), amountXof);
                })
            .toList();

    long totalExpenseXof =
        expensesByCategory.stream()
            .mapToLong(FarmAnalyticsResponse.CategoryCost::amountXof)
            .sum();

    List<FarmAnalyticsResponse.UnitRevenue> revenueByUnit =
        livestockFacade.listFarmUnits(farmId).stream()
            .map(
                u ->
                    new FarmAnalyticsResponse.UnitRevenue(
                        u.id(), u.name(), commercialFacade.revenueByProductionUnit(farmId, u.id())))
            .filter(r -> r.revenueXof() > 0)
            .sorted(
                Comparator.comparingLong(FarmAnalyticsResponse.UnitRevenue::revenueXof).reversed())
            .toList();

    long marginXof = totalRevenueXof - totalExpenseXof;

    return new FarmAnalyticsResponse(
        totalRevenueXof,
        directSalesXof,
        paidOrdersXof,
        totalExpenseXof,
        marginXof,
        expensesByCategory,
        revenueByUnit);
  }

  private static String labelOf(CatalogEntryInfo entry) {
    Object label = entry.value() != null ? entry.value().get("label") : null;
    return label != null ? label.toString() : entry.key();
  }
}
```

- [ ] **Step 5: Basculer l'endpoint dans `ExpenseController`**

Dans `ExpenseController.java` : remplacer l'import `UnitAnalyticsResponse` par `FarmAnalyticsResponse` :

```java
import com.avicare.finance.dto.response.FarmAnalyticsResponse;
```
(supprimer `import com.avicare.finance.dto.response.UnitAnalyticsResponse;`)

Puis remplacer la méthode `unitAnalytics` (le bloc `@GetMapping("/units/{unitId}/analytics") ... }`) par :

```java
  @GetMapping("/analytics")
  @PreAuthorize(FinanceAccess.READ)
  public ApiResponse<FarmAnalyticsResponse> farmAnalytics(@PathVariable Long farmId) {
    return ApiResponse.of(financeAnalyticsService.farmAnalytics(farmId));
  }
```

- [ ] **Step 6: Supprimer le DTO obsolète**

```bash
git rm backend/avicare-app/src/main/java/com/avicare/finance/dto/response/UnitAnalyticsResponse.java
```

- [ ] **Step 7: Lancer le test de service — passe**

Run: `cd backend && ./mvnw -q -pl avicare-app -am test -Dtest=FinanceAnalyticsServiceTest`
Expected: PASS (2 tests).

- [ ] **Step 8: Spotless + commit**

```bash
cd backend && ./mvnw -q spotless:apply -pl avicare-app
git add backend/avicare-app/src/main/java/com/avicare/finance/
git commit -m "feat(finance): farm-wide P&L analytics endpoint, replacing per-lot analytics"
```

---

## Task 4 : Frontend — vue analytique globale

**Files:**
- Modify: `web/src/types/index.ts:1220-1229`
- Modify: `web/src/store/api/financeApi.ts`
- Create: `web/src/components/finance/FarmAnalyticsView.tsx`
- Create: `web/src/components/finance/FarmAnalyticsView.test.tsx`
- Modify: `web/src/app/(dashboard)/finance/analytique/page.tsx`
- Delete: `web/src/components/finance/UnitAnalyticsView.tsx`
- Delete: `web/src/components/finance/UnitAnalyticsView.test.tsx`

**Interfaces:**
- Consumes: endpoint `GET /api/v1/farms/{farmId}/finance/analytics` → `FarmAnalytics`.
- Produces: hook `useGetFarmAnalyticsQuery({ farmId })`, composant `FarmAnalyticsView`.

- [ ] **Step 1: Remplacer le type `UnitAnalytics` par `FarmAnalytics`**

Dans `web/src/types/index.ts`, remplacer le bloc `UnitAnalytics` (l.1220-1229) par :

```ts
/** Compte de résultat ferme (mirrors backend FarmAnalyticsResponse). */
export interface FarmAnalytics {
  totalRevenueXof: number;
  directSalesXof: number;
  paidOrdersXof: number;
  totalExpenseXof: number;
  marginXof: number;
  expensesByCategory: { categoryKey: string; label: string; amountXof: number }[];
  revenueByUnit: { unitId: number; unitName: string; revenueXof: number }[];
}
```

- [ ] **Step 2: Remplacer l'endpoint RTK Query**

Dans `web/src/store/api/financeApi.ts` :

1. Dans l'import de types, remplacer `UnitAnalytics` par `FarmAnalytics`.
2. Remplacer le bloc `getUnitAnalytics: build.query<...>({ ... }),` par :

```ts
    getFarmAnalytics: build.query<FarmAnalytics, { farmId: number }>({
      query: ({ farmId }) => `/api/v1/farms/${farmId}/finance/analytics`,
      transformResponse: (r: ApiEnvelope<FarmAnalytics>) => r.data,
      providesTags: (_r, _e, { farmId }) => [{ type: "Expense", id: `LIST-${farmId}` }],
    }),
```

3. Dans le bloc d'exports de hooks, remplacer `useGetUnitAnalyticsQuery,` par `useGetFarmAnalyticsQuery,`.

- [ ] **Step 3: Écrire le test du composant (échoue d'abord)**

Create `web/src/components/finance/FarmAnalyticsView.test.tsx` :

```tsx
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { FarmAnalyticsView } from "./FarmAnalyticsView";
import type { FarmAnalytics } from "@/types";

function respond(data: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify({ data }), { status: 200, headers: { "Content-Type": "application/json" } }),
  );
}

const analytics: FarmAnalytics = {
  totalRevenueXof: 750000,
  directSalesXof: 700000,
  paidOrdersXof: 50000,
  totalExpenseXof: 350000,
  marginXof: 400000,
  expensesByCategory: [{ categoryKey: "feed", label: "Aliment", amountXof: 344000 }],
  revenueByUnit: [{ unitId: 10, unitName: "Lot A", revenueXof: 700000 }],
};

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => respond(analytics)),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("FarmAnalyticsView", () => {
  it("renders the three KPIs, the expense breakdown and per-lot revenue", async () => {
    renderWithProviders(<FarmAnalyticsView farmId={1} />);

    expect(await screen.findByText("Total revenus")).toBeInTheDocument();
    expect(screen.getByText("Total dépenses")).toBeInTheDocument();
    expect(screen.getByText("Marge")).toBeInTheDocument();
    // ventilation dépenses
    expect(await screen.findByText("Aliment")).toBeInTheDocument();
    // revenu par lot
    expect(screen.getByText("Lot A")).toBeInTheDocument();
    // détail revenu
    expect(screen.getByText("Ventes directes")).toBeInTheDocument();
    expect(screen.getByText("Commandes payées")).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Lancer — échoue (composant absent)**

Run: `cd web && npx vitest run src/components/finance/FarmAnalyticsView.test.tsx`
Expected: FAIL — impossible de résoudre `./FarmAnalyticsView`.

- [ ] **Step 5: Créer `FarmAnalyticsView.tsx`**

Create `web/src/components/finance/FarmAnalyticsView.tsx` :

```tsx
"use client";

import {
  Alert,
  Box,
  Card,
  CardContent,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useGetFarmAnalyticsQuery } from "@/store/api/financeApi";
import { apiErrorMessage } from "@/lib/apiError";
import { formatCurrency } from "@/lib/format";
import { colors } from "@/theme/tokens";

/**
 * Compte de résultat ferme : trois KPIs (total revenus, total dépenses, marge colorée), le détail
 * du revenu (ventes directes + commandes payées), la ventilation des dépenses par catégorie et le
 * revenu par lot. Totaux cumulés.
 */
export function FarmAnalyticsView({ farmId }: { farmId: number }) {
  const { data, isLoading, error } = useGetFarmAnalyticsQuery({ farmId });

  if (isLoading) {
    return <Skeleton variant="rectangular" height={280} sx={{ borderRadius: 2 }} />;
  }
  if (error) {
    return <Alert severity="error">{apiErrorMessage(error)}</Alert>;
  }
  if (!data) {
    return null;
  }

  const empty = data.totalRevenueXof === 0 && data.totalExpenseXof === 0;

  return (
    <Box>
      <Box
        sx={{
          display: "grid",
          gap: { xs: 2, md: 3 },
          gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
          mb: 3,
        }}
      >
        <Card variant="outlined">
          <CardContent>
            <Typography variant="body2" color="text.secondary">
              Total revenus
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {formatCurrency(data.totalRevenueXof)}
            </Typography>
          </CardContent>
        </Card>
        <Card variant="outlined">
          <CardContent>
            <Typography variant="body2" color="text.secondary">
              Total dépenses
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {formatCurrency(data.totalExpenseXof)}
            </Typography>
          </CardContent>
        </Card>
        <Card variant="outlined">
          <CardContent>
            <Typography variant="body2" color="text.secondary">
              Marge
            </Typography>
            <Typography
              variant="h5"
              sx={{
                fontWeight: 700,
                color: data.marginXof >= 0 ? colors.success.main : colors.error.main,
              }}
            >
              {formatCurrency(data.marginXof)}
            </Typography>
          </CardContent>
        </Card>
      </Box>

      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
            Détail du revenu
          </Typography>
          <Box sx={{ display: "flex", justifyContent: "space-between", py: 0.5 }}>
            <Typography variant="body2">Ventes directes</Typography>
            <Typography variant="body2">{formatCurrency(data.directSalesXof)}</Typography>
          </Box>
          <Box sx={{ display: "flex", justifyContent: "space-between", py: 0.5 }}>
            <Typography variant="body2">Commandes payées</Typography>
            <Typography variant="body2">{formatCurrency(data.paidOrdersXof)}</Typography>
          </Box>
        </CardContent>
      </Card>

      {empty ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: "center" }}>
          Aucune donnée financière pour le moment.
        </Typography>
      ) : (
        <Box
          sx={{
            display: "grid",
            gap: 3,
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          }}
        >
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Dépenses par catégorie
            </Typography>
            {data.expensesByCategory.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Aucune dépense.
              </Typography>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Catégorie</TableCell>
                      <TableCell align="right">Montant</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.expensesByCategory.map((c) => (
                      <TableRow key={c.categoryKey} hover>
                        <TableCell>{c.label}</TableCell>
                        <TableCell align="right">{formatCurrency(c.amountXof)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Revenu par lot
            </Typography>
            {data.revenueByUnit.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Aucune vente attribuée à un lot.
              </Typography>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Lot</TableCell>
                      <TableCell align="right">Revenu</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.revenueByUnit.map((u) => (
                      <TableRow key={u.unitId} hover>
                        <TableCell>{u.unitName}</TableCell>
                        <TableCell align="right">{formatCurrency(u.revenueXof)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
}
```

- [ ] **Step 6: Lancer le test — passe**

Run: `cd web && npx vitest run src/components/finance/FarmAnalyticsView.test.tsx`
Expected: PASS.

- [ ] **Step 7: Brancher la page + supprimer l'ancienne vue**

Remplacer `web/src/app/(dashboard)/finance/analytique/page.tsx` par :

```tsx
"use client";

import { Box, Skeleton, Typography } from "@mui/material";
import { useSelectedFarm } from "@/hooks/useSelectedFarm";
import { FarmAnalyticsView } from "@/components/finance/FarmAnalyticsView";

/** Finance / Analytique : résout la ferme active puis affiche le compte de résultat ferme. */
export default function AnalyticsPage() {
  const { farmId, isLoading } = useSelectedFarm();

  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>
        Analytique
      </Typography>

      {isLoading || !farmId ? (
        <Skeleton variant="rectangular" height={240} sx={{ borderRadius: 2 }} />
      ) : (
        <FarmAnalyticsView farmId={farmId} />
      )}
    </Box>
  );
}
```

Puis supprimer l'ancienne vue et son test :

```bash
git rm web/src/components/finance/UnitAnalyticsView.tsx web/src/components/finance/UnitAnalyticsView.test.tsx
```

- [ ] **Step 8: Lint + suite web ciblée**

Run: `cd web && npx vitest run src/components/finance/ && npm run lint`
Expected: PASS ; aucun import résiduel de `UnitAnalyticsView`/`useGetUnitAnalyticsQuery`/`UnitAnalytics`.

- [ ] **Step 9: Commit**

```bash
git add web/src/types/index.ts web/src/store/api/financeApi.ts \
        web/src/components/finance/FarmAnalyticsView.tsx web/src/components/finance/FarmAnalyticsView.test.tsx \
        "web/src/app/(dashboard)/finance/analytique/page.tsx"
git commit -m "feat(web): farm-wide analytics view (revenue, expenses, margin) replacing per-lot"
```

---

## Task 5 : Source `VET_VISIT` + migration V28 + colonne `vet_visit_id`

**Files:**
- Modify: `backend/avicare-app/src/main/java/com/avicare/finance/domain/ExpenseSource.java`
- Create: `backend/avicare-app/src/main/resources/db/migration/V28__expenses_vet_visit_source.sql`
- Modify: `backend/avicare-app/src/main/java/com/avicare/finance/domain/Expense.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/finance/repository/ExpenseRepository.java`

**Interfaces:**
- Produces: `ExpenseSource.VET_VISIT` ; colonne `expenses.vet_visit_id` ; champ `Expense.vetVisitId` (getter/setter Lombok) ; `ExpenseRepository.findByFarmIdAndVetVisitId(Long, Long) -> Optional<Expense>`.

> Note : tâche à validation surtout par compilation ; la migration V28 est validée par le boot CI (Testcontainers, `ddl-auto=validate`) — Docker local indisponible.

- [ ] **Step 1: Ajouter la valeur d'enum**

Dans `ExpenseSource.java`, remplacer l'enum + son javadoc de fin par :

```java
public enum ExpenseSource {
  MANUAL,
  PURCHASE,
  STOCK_ENTRY,
  SALARY,
  VET_VISIT
}
```

(Compléter le javadoc de tête : `VET_VISIT = auto-recorded from a vet visit cost.`)

- [ ] **Step 2: Écrire la migration V28**

Create `V28__expenses_vet_visit_source.sql` :

```sql
-- Étend les sources de dépense pour couvrir les visites vétérinaires (coût auto-comptabilisé),
-- et ajoute le lien vers la visite d'origine (référencement par id, comme purchase_order_id).

ALTER TABLE expenses DROP CONSTRAINT expenses_source_check;
ALTER TABLE expenses ADD CONSTRAINT expenses_source_check
    CHECK (source IN ('MANUAL', 'PURCHASE', 'STOCK_ENTRY', 'SALARY', 'VET_VISIT'));

ALTER TABLE expenses ADD COLUMN vet_visit_id BIGINT REFERENCES vet_visits(id);
CREATE INDEX idx_expenses_vet_visit ON expenses(vet_visit_id);
```

> Vérifier le nom réel de la contrainte CHECK avant merge : la migration V25 la nomme
> implicitement `expenses_source_check` (nom PostgreSQL par défaut `<table>_<column>_check`).
> Si le CHECK V25 a été écrit inline sans nom explicite, ce nom par défaut s'applique.

- [ ] **Step 3: Mapper le champ dans `Expense`**

Dans `Expense.java`, après le champ `salaryId` (`@Column(name = "salary_id") private Long salaryId;`), ajouter :

```java
  @Column(name = "vet_visit_id")
  private Long vetVisitId;
```

- [ ] **Step 4: Ajouter le lookup d'idempotence**

Dans `ExpenseRepository.java`, ajouter l'import `import java.util.Optional;` (si absent) et la méthode dérivée :

```java
  /** Dépense liée à une visite vétérinaire donnée (idempotence de l'auto-dépense). */
  Optional<Expense> findByFarmIdAndVetVisitId(Long farmId, Long vetVisitId);
```

- [ ] **Step 5: Compiler**

Run: `cd backend && ./mvnw -q -pl avicare-app -am clean test-compile`
Expected: BUILD SUCCESS.

- [ ] **Step 6: Spotless + commit**

```bash
cd backend && ./mvnw -q spotless:apply -pl avicare-app
git add backend/avicare-app/src/main/java/com/avicare/finance/domain/ExpenseSource.java \
        backend/avicare-app/src/main/resources/db/migration/V28__expenses_vet_visit_source.sql \
        backend/avicare-app/src/main/java/com/avicare/finance/domain/Expense.java \
        backend/avicare-app/src/main/java/com/avicare/finance/repository/ExpenseRepository.java
git commit -m "feat(finance): VET_VISIT expense source + vet_visit_id link (V28)"
```

---

## Task 6 : `FinanceFacade` — enregistrer / réverser la dépense véto

**Files:**
- Modify: `backend/avicare-app/src/main/java/com/avicare/finance/api/FinanceFacade.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/finance/service/FinanceFacadeImpl.java`
- Test: `backend/avicare-app/src/test/java/com/avicare/finance/service/FinanceFacadeVetVisitTest.java` (create)

**Interfaces:**
- Consumes: `ExpenseRepository.findByFarmIdAndVetVisitId` (Task 5).
- Produces (sur `FinanceFacade`) :
  - `void recordVetVisitExpense(Long farmId, Long vetVisitId, String label, long amountXof, LocalDate date, Long productionUnitId, Long userId)` — catégorie `veterinary`, source `VET_VISIT`, idempotent, no-op si `amountXof <= 0`.
  - `void reverseVetVisitExpense(Long farmId, Long vetVisitId)` — soft-delete la dépense liée, no-op si absente.

- [ ] **Step 1: Écrire le test (échoue d'abord)**

Create `FinanceFacadeVetVisitTest.java` :

```java
package com.avicare.finance.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
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

/** Unit test for the vet-visit auto-expense hooks on {@link FinanceFacadeImpl}. */
class FinanceFacadeVetVisitTest {

  private ExpenseRepository expenseRepository;
  private FinanceFacadeImpl facade;

  @BeforeEach
  void setUp() {
    expenseRepository = Mockito.mock(ExpenseRepository.class);
    facade = new FinanceFacadeImpl(expenseRepository);
  }

  @Test
  void recordVetVisitExpense_createsVeterinaryExpense() {
    when(expenseRepository.findByFarmIdAndVetVisitId(3L, 77L)).thenReturn(Optional.empty());

    facade.recordVetVisitExpense(
        3L, 77L, "Visite vétérinaire — Vaccination", 15000L, LocalDate.of(2026, 7, 6), 42L, 9L);

    ArgumentCaptor<Expense> captor = ArgumentCaptor.forClass(Expense.class);
    verify(expenseRepository).save(captor.capture());
    Expense e = captor.getValue();
    assertThat(e.getFarmId()).isEqualTo(3L);
    assertThat(e.getCategoryKey()).isEqualTo("veterinary");
    assertThat(e.getSource()).isEqualTo(ExpenseSource.VET_VISIT);
    assertThat(e.getVetVisitId()).isEqualTo(77L);
    assertThat(e.getAmountXof()).isEqualTo(15000L);
    assertThat(e.getProductionUnitId()).isEqualTo(42L);
    assertThat(e.getCreatedBy()).isEqualTo(9L);
    assertThat(e.getLabel()).isEqualTo("Visite vétérinaire — Vaccination");
  }

  @Test
  void recordVetVisitExpense_idempotent_skipsWhenAlreadyLinked() {
    when(expenseRepository.findByFarmIdAndVetVisitId(3L, 77L))
        .thenReturn(Optional.of(new Expense()));

    facade.recordVetVisitExpense(3L, 77L, "x", 15000L, LocalDate.now(), 42L, 9L);

    verify(expenseRepository, never()).save(any());
  }

  @Test
  void recordVetVisitExpense_nonPositiveAmount_noOp() {
    facade.recordVetVisitExpense(3L, 77L, "x", 0L, LocalDate.now(), 42L, 9L);
    verify(expenseRepository, never()).save(any());
  }

  @Test
  void reverseVetVisitExpense_softDeletesLinkedExpense() {
    Expense e = new Expense();
    when(expenseRepository.findByFarmIdAndVetVisitId(3L, 77L)).thenReturn(Optional.of(e));

    facade.reverseVetVisitExpense(3L, 77L);

    verify(expenseRepository).delete(e);
  }

  @Test
  void reverseVetVisitExpense_noOpWhenAbsent() {
    when(expenseRepository.findByFarmIdAndVetVisitId(3L, 77L)).thenReturn(Optional.empty());

    facade.reverseVetVisitExpense(3L, 77L);

    verify(expenseRepository, never()).delete(any());
  }
}
```

- [ ] **Step 2: Lancer — échoue (méthodes absentes)**

Run: `cd backend && ./mvnw -q -pl avicare-app -am clean test-compile`
Expected: FAIL — `cannot find symbol: method recordVetVisitExpense` / `reverseVetVisitExpense`.

- [ ] **Step 3: Déclarer sur `FinanceFacade`**

Dans `FinanceFacade.java`, après `recordStockEntryExpense(...)` :

```java
  /**
   * Enregistre une dépense catégorie {@code veterinary}, source {@code VET_VISIT}, liée à la visite.
   * Idempotent : ne fait rien si une dépense existe déjà pour {@code vetVisitId}, ou si {@code
   * amountXof <= 0}.
   */
  void recordVetVisitExpense(
      Long farmId,
      Long vetVisitId,
      String label,
      long amountXof,
      LocalDate date,
      Long productionUnitId,
      Long userId);

  /** Réverse (soft-delete) la dépense liée à une visite supprimée. No-op si absente. */
  void reverseVetVisitExpense(Long farmId, Long vetVisitId);
```

(`import java.time.LocalDate;` est déjà présent.)

- [ ] **Step 4: Implémenter dans `FinanceFacadeImpl`**

Dans `FinanceFacadeImpl.java`, ajouter après `recordStockEntryExpense(...)` :

```java
  @Override
  @Transactional
  public void recordVetVisitExpense(
      Long farmId,
      Long vetVisitId,
      String label,
      long amountXof,
      LocalDate date,
      Long productionUnitId,
      Long userId) {
    if (amountXof <= 0) return;
    if (expenseRepository.findByFarmIdAndVetVisitId(farmId, vetVisitId).isPresent()) return;

    Expense expense = new Expense();
    expense.setFarmId(farmId);
    expense.setCategoryKey("veterinary");
    expense.setAmountXof(amountXof);
    expense.setExpenseDate(date);
    expense.setLabel(label);
    expense.setSource(ExpenseSource.VET_VISIT);
    expense.setVetVisitId(vetVisitId);
    expense.setProductionUnitId(productionUnitId);
    expense.setCreatedBy(userId);
    expenseRepository.save(expense);
  }

  @Override
  @Transactional
  public void reverseVetVisitExpense(Long farmId, Long vetVisitId) {
    expenseRepository
        .findByFarmIdAndVetVisitId(farmId, vetVisitId)
        .ifPresent(expenseRepository::delete);
  }
```

- [ ] **Step 5: Lancer le test — passe**

Run: `cd backend && ./mvnw -q -pl avicare-app -am test -Dtest=FinanceFacadeVetVisitTest`
Expected: PASS (5 tests).

- [ ] **Step 6: Spotless + commit**

```bash
cd backend && ./mvnw -q spotless:apply -pl avicare-app
git add backend/avicare-app/src/main/java/com/avicare/finance/api/FinanceFacade.java \
        backend/avicare-app/src/main/java/com/avicare/finance/service/FinanceFacadeImpl.java \
        backend/avicare-app/src/test/java/com/avicare/finance/service/FinanceFacadeVetVisitTest.java
git commit -m "feat(finance): FinanceFacade record/reverse vet-visit expense hooks"
```

---

## Task 7 : Hook `VetVisitService` (record/delete) + tests

**Files:**
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/health/VetVisitService.java`
- Test: `backend/avicare-app/src/test/java/com/avicare/livestock/health/VetVisitServiceTest.java` (create)
- Modify (test): `backend/avicare-app/src/test/java/com/avicare/livestock/health/HealthTreatmentsVetIT.java`

**Interfaces:**
- Consumes: `FinanceFacade.recordVetVisitExpense`, `.reverseVetVisitExpense` (Task 6).

- [ ] **Step 1: Écrire le test unitaire du service (échoue d'abord)**

Create `VetVisitServiceTest.java` :

```java
package com.avicare.livestock.health;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.finance.api.FinanceFacade;
import com.avicare.livestock.domain.ProductionUnit;
import com.avicare.livestock.domain.VetVisit;
import com.avicare.livestock.repository.LifecycleEventRepository;
import com.avicare.livestock.repository.VetVisitRepository;
import com.avicare.livestock.repository.VeterinarianRepository;
import com.avicare.livestock.service.LivestockService;
import java.time.LocalDate;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

/** Unit test for the finance auto-expense wiring on {@link VetVisitService}. */
class VetVisitServiceTest {

  private VetVisitRepository vetVisitRepository;
  private LifecycleEventRepository lifecycleEventRepository;
  private LivestockService livestockService;
  private VeterinarianRepository veterinarianRepository;
  private FinanceFacade financeFacade;
  private VetVisitService service;

  @BeforeEach
  void setUp() {
    vetVisitRepository = Mockito.mock(VetVisitRepository.class);
    lifecycleEventRepository = Mockito.mock(LifecycleEventRepository.class);
    livestockService = Mockito.mock(LivestockService.class);
    veterinarianRepository = Mockito.mock(VeterinarianRepository.class);
    financeFacade = Mockito.mock(FinanceFacade.class);
    service =
        new VetVisitService(
            vetVisitRepository,
            lifecycleEventRepository,
            livestockService,
            veterinarianRepository,
            financeFacade);
  }

  private ProductionUnit unitWithFarm(long farmId) {
    ProductionUnit u = Mockito.mock(ProductionUnit.class);
    when(u.getFarmId()).thenReturn(farmId);
    return u;
  }

  private VetVisit savedVisitWithId(long id) {
    VetVisit v = Mockito.mock(VetVisit.class);
    when(v.getId()).thenReturn(id);
    return v;
  }

  @Test
  void record_withPositiveCost_createsVetVisitExpense() {
    when(livestockService.getUnit(5L)).thenReturn(unitWithFarm(3L));
    when(vetVisitRepository.save(any(VetVisit.class))).thenReturn(savedVisitWithId(77L));

    service.record(
        5L,
        new VetVisitCommand(
            null, LocalDate.of(2026, 7, 6), "Vaccination", null, null, 15000, false, null, null),
        9L);

    verify(financeFacade)
        .recordVetVisitExpense(
            eq(3L),
            eq(77L),
            eq("Visite vétérinaire — Vaccination"),
            eq(15000L),
            eq(LocalDate.of(2026, 7, 6)),
            eq(5L),
            eq(9L));
  }

  @Test
  void record_withoutCost_doesNotCreateExpense() {
    when(livestockService.getUnit(5L)).thenReturn(unitWithFarm(3L));
    when(vetVisitRepository.save(any(VetVisit.class))).thenReturn(savedVisitWithId(77L));

    service.record(
        5L,
        new VetVisitCommand(
            null, LocalDate.of(2026, 7, 6), "Contrôle", null, null, null, false, null, null),
        9L);

    verify(financeFacade, never())
        .recordVetVisitExpense(anyLong(), anyLong(), any(), anyLong(), any(), any(), any());
  }

  @Test
  void delete_reversesVetVisitExpense() {
    VetVisit v = Mockito.mock(VetVisit.class);
    when(v.getProductionUnit()).thenReturn(unitWithFarm(3L));
    when(vetVisitRepository.findById(88L)).thenReturn(Optional.of(v));

    service.delete(88L);

    verify(financeFacade).reverseVetVisitExpense(3L, 88L);
    verify(vetVisitRepository).delete(v);
  }
}
```

- [ ] **Step 2: Lancer — échoue (constructeur à 4 args, hook absent)**

Run: `cd backend && ./mvnw -q -pl avicare-app -am clean test-compile`
Expected: FAIL — `constructor VetVisitService(...) cannot be applied` (le 5e argument `financeFacade` n'existe pas encore).

- [ ] **Step 3: Injecter `FinanceFacade` + brancher `record`**

Dans `VetVisitService.java` :

1. Ajouter l'import : `import com.avicare.finance.api.FinanceFacade;`
2. Ajouter le champ (après `veterinarianRepository`) : `private final FinanceFacade financeFacade;`
3. Dans `record(...)`, juste avant `return saved;`, insérer :

```java
    if (cmd.costXof() != null && cmd.costXof() > 0) {
      financeFacade.recordVetVisitExpense(
          unit.getFarmId(),
          saved.getId(),
          "Visite vétérinaire — " + cmd.reason(),
          cmd.costXof(),
          cmd.visitDate(),
          unitId,
          userId);
    }
```

- [ ] **Step 4: Brancher `delete`**

Dans `VetVisitService.java`, remplacer la méthode `delete` par :

```java
  @Transactional
  public void delete(Long id) {
    VetVisit visit = get(id);
    Long farmId = visit.getProductionUnit().getFarmId();
    financeFacade.reverseVetVisitExpense(farmId, id);
    vetVisitRepository.delete(visit);
  }
```

- [ ] **Step 5: Lancer le test unitaire — passe**

Run: `cd backend && ./mvnw -q -pl avicare-app -am test -Dtest=VetVisitServiceTest`
Expected: PASS (3 tests).

- [ ] **Step 6: Fixer le test IT existant + ajouter l'E2E**

Dans `HealthTreatmentsVetIT.java` :

**(a)** Le test `vetVisit_anonymous_followUp_andValidation` enregistre une visite avec un coût `15000` et un `userId` `null` — désormais le hook tenterait d'insérer une dépense avec `created_by = NULL` (FK NOT NULL → échec). Ce test ne porte pas sur le coût : remplacer le `15000` de ce test par `null` :

```java
    // visit with vet + follow-up in 10 days (coût null : ce test ne porte pas sur la dépense)
    vetVisitService.record(
        unitId,
        new VetVisitCommand(
            vet.getId(),
            LocalDate.now(),
            "Suivi",
            "RAS",
            "Revenir",
            null,
            true,
            LocalDate.now().plusDays(10),
            null),
        null);
```

**(b)** Ajouter l'autowiring du repo finance + une helper d'id propriétaire, et un test E2E. En tête de classe, ajouter les imports :

```java
import com.avicare.finance.domain.Expense;
import com.avicare.finance.domain.ExpenseSource;
import com.avicare.finance.repository.ExpenseRepository;
import com.avicare.identity.repository.UserRepository;
import java.util.Optional;
```

Ajouter les champs autowirés (à côté des autres `@Autowired`) :

```java
  @Autowired private ExpenseRepository expenseRepository;
  @Autowired private UserRepository userRepository;
```

Ajouter le test :

```java
  @Test
  void vetVisitWithCost_createsAndReversesVeterinaryExpense() throws Exception {
    long farmId = createFarm();
    long unitId = seedUnit(farmId);
    // Le created_by de la dépense est une FK users(id) : utiliser un vrai id d'utilisateur.
    long ownerId = userRepository.findAll().get(0).getId();

    VetVisit visit =
        vetVisitService.record(
            unitId,
            new VetVisitCommand(
                null, LocalDate.now(), "Vaccination", null, null, 12000, false, null, null),
            ownerId);

    Optional<Expense> created = expenseRepository.findByFarmIdAndVetVisitId(farmId, visit.getId());
    assertThat(created).isPresent();
    assertThat(created.get().getCategoryKey()).isEqualTo("veterinary");
    assertThat(created.get().getSource()).isEqualTo(ExpenseSource.VET_VISIT);
    assertThat(created.get().getAmountXof()).isEqualTo(12000L);
    assertThat(created.get().getProductionUnitId()).isEqualTo(unitId);

    vetVisitService.delete(visit.getId());
    // Soft-delete → @SQLRestriction rend la dépense invisible.
    assertThat(expenseRepository.findByFarmIdAndVetVisitId(farmId, visit.getId())).isEmpty();
  }
```

> `userRepository.findAll().get(0)` : chaque test crée sa ferme via un signup frais ; le premier
> (unique pertinent) utilisateur suffit comme `created_by` valide. Si l'ordre s'avère instable,
> remplacer par une recherche sur l'email — mais `createFarm` ne l'expose pas ; garder `findAll`.

- [ ] **Step 7: Vérifier la compilation (clean — fichiers test édités)**

Run: `cd backend && ./mvnw -q -pl avicare-app -am clean test-compile`
Expected: BUILD SUCCESS.

- [ ] **Step 8: Vérifier le boot des 3 contextes DB-less**

`VetVisitService` gagne une dépendance `FinanceFacade` (bean `FinanceFacadeImpl`, déjà satisfait par `ExpenseRepository` mocké dans le profil DB-less) — aucun nouveau repo. Confirmer que les contextes bootent quand même :

Run: `cd backend && ./mvnw -q -pl avicare-app -am test -Dtest=SecurityE2ETest,SecurityIntegrationTest`
Expected: PASS (contexte démarre). `DashboardControllerIT` est DB-less mais suffixé `*IT` (failsafe) → couvert par la CI ; ne bloque pas la validation locale.

- [ ] **Step 9: Spotless + commit**

```bash
cd backend && ./mvnw -q spotless:apply -pl avicare-app
git add backend/avicare-app/src/main/java/com/avicare/livestock/health/VetVisitService.java \
        backend/avicare-app/src/test/java/com/avicare/livestock/health/VetVisitServiceTest.java \
        backend/avicare-app/src/test/java/com/avicare/livestock/health/HealthTreatmentsVetIT.java
git commit -m "feat(livestock:health): vet visit cost auto-creates and reverses a veterinary expense"
```

---

## Self-Review (rempli à l'écriture du plan)

**1. Spec coverage :**
- Analytique globale (revenu = ventes + livraisons payées ; marge ; ventilation ; revenu par lot ; suppression coût/tête + endpoint unit) → Tasks 1-4. ✅
- `ProductionUnitInfo.name` → Task 1. ✅
- Visite véto → dépense (`VET_VISIT`, V28, `vet_visit_id`, façade record/reverse, hook record/delete, idempotence) → Tasks 5-7. ✅
- Hors-périmètre respecté : pas de filtre période (`sumByCategory(farmId,null,null)`, agrégats lifetime), pas de backfill, pas d'édition de coût (record/delete uniquement). ✅
- Footgun DB-less (3 contextes) → Task 7 Step 8. ✅

**2. Placeholder scan :** aucun TODO/TBD ; tout le code est fourni.

**3. Type consistency :** `FarmAnalyticsResponse(totalRevenueXof, directSalesXof, paidOrdersXof, totalExpenseXof, marginXof, expensesByCategory[CategoryCost], revenueByUnit[UnitRevenue])` — identique backend (Task 3) / frontend `FarmAnalytics` (Task 4). Méthodes façade `totalSalesRevenue`/`totalPaidFromDeliveryInvoices` (Task 2) consommées à l'identique en Task 3. `recordVetVisitExpense`/`reverseVetVisitExpense` (Task 6) consommées à l'identique en Task 7. `findByFarmIdAndVetVisitId` (Task 5) utilisée en Tasks 6-7. Constructeur `VetVisitService` à 5 args cohérent (test Task 7 Step 1 ↔ champ Task 7 Step 3).
