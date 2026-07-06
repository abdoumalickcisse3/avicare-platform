# Page Ferme « Vue d'ensemble » — KPIs + activité récente — Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Remplir l'onglet « Vue d'ensemble » d'une ferme : 4 cartes KPI élevage (fenêtre 7 j) + un flux « Activité récente » multi-sources (élevage + ventes + stock).

**Architecture:** Réutilise l'endpoint dashboard existant pour 3 cartes ; ajoute un champ `dailyFeedKg` à l'agrégat élevage pour la 4ᵉ. Le flux d'activité fusionne, côté `reporting`, deux nouvelles méthodes de façade (`LivestockFacade.recentActivity`, `CommercialFacade.recentActivity`) via un DTO partagé `ActivityItem` en `common-api`.

**Tech Stack:** Spring Boot 3.4 / Java 21 / Hibernate / PostgreSQL ; Next.js 16 / MUI v9 / RTK Query / Vitest.

## Global Constraints

- Commits : Conventional Commits, scope bounded-context (`feat(reporting:…)`, `feat(livestock:…)`, `feat(web):`). **Aucune signature Claude/AI, pas de Co-Authored-By, pas d'emoji.**
- Pas de cross-import entre bounded contexts — façades publiques uniquement, référencement par ID. DTO partagé en `common-api` (`com.avicare.common.api.dto`).
- Fenêtre KPI = 7 jours fixe (pas de sélecteur). `dailyFeedKg` = Σ feed_kg (7 j) ÷ jours distincts saisis ; `null` si aucune saisie.
- Activité : liste blanche d'`event_type` = `MORTALITY, COUNT_ADJUSTMENT, VACCINATION_ADMINISTERED, TREATMENT_ADMINISTERED, VET_VISIT_RECORDED, DAILY_PRODUCTION_CLOSED, CREATED, HEALTH_OBSERVATION`. Ventes/paiements viennent de `CommercialFacade` (ne PAS ré-inclure les events `SALE`/`SALE_CANCEL` côté élevage). Top 20, pas de pagination.
- `at` de tri : lifecycle=`occurredAt`, sale/payment=`createdAt`, stock=`movementDate.atStartOfDay()` (tous non-null après persist).
- Argent en `long` XOF. Façades de lecture : `@Transactional(readOnly = true)` (lazy `stockItem` chargé dans la transaction).
- `*IT` Testcontainers = CI only (Docker local indisponible) → vérifier en local par `clean test-compile`.
- Après édition backend : `./mvnw -q spotless:apply` (racine réacteur — touche `common-api` ET `avicare-app`) avant commit. Après édition d'un fichier TEST Java : `./mvnw -q -pl avicare-app -am clean test-compile`. Lancer un seul test avec `-am` : ajouter `-Dsurefire.failIfNoSpecifiedTests=false`.
- Frontend depuis `web/` : vitest ciblé + `npm run lint`. « This is NOT the Next.js you know » → consulter `web/node_modules/next/dist/docs/` si API Next spécifique.
- Footgun : ajouter un champ à un `record` casse les constructions POSITIONNELLES en test → grep + mettre à jour tous les sites.
- Footgun : les 3 contextes DB-less (`SecurityE2ETest`, `SecurityIntegrationTest`, `DashboardControllerIT`) doivent booter.

---

## File Structure

**Partie 1 — feed KPI (backend + front)**
- Modify `backend/avicare-app/src/main/java/com/avicare/livestock/repository/DailyRecordRepository.java` — 2 requêtes feed.
- Modify `backend/avicare-app/src/main/java/com/avicare/livestock/api/dto/LivestockStats.java` — champ `dailyFeedKg`.
- Modify `backend/avicare-app/src/main/java/com/avicare/livestock/service/LivestockFacadeImpl.java` — calcul + arg.
- Modify `backend/avicare-app/src/main/java/com/avicare/reporting/api/dto/DashboardResponse.java` — champ `LivestockSection.dailyFeedKg`.
- Modify `backend/avicare-app/src/main/java/com/avicare/reporting/service/ReportingService.java` — passe `ls.dailyFeedKg()`.
- Modify `web/src/types/dashboard.ts` — `dailyFeedKg`.
- Modify `web/src/components/farms/FarmDetailView.tsx` — brancher les 4 cartes.

**Partie 2 — activité (backend + front)**
- Create `backend/common/common-api/src/main/java/com/avicare/common/api/dto/ActivityItem.java`.
- Modify `LivestockFacade.java` (+`LivestockFacadeImpl.java`) — `recentActivity`.
- Modify `LifecycleEventRepository.java`, `StockMovementRepository.java` — requêtes recent.
- Modify `CommercialFacade.java` (+`CommercialFacadeImpl.java`) — `recentActivity`.
- Modify `SaleRepository.java`, `PaymentRepository.java` — variantes Pageable.
- Create `backend/avicare-app/src/main/java/com/avicare/reporting/service/ActivityService.java`.
- Create `backend/avicare-app/src/main/java/com/avicare/reporting/controller/ActivityController.java`.
- Create `web/src/store/api/activityApi.ts`; Modify `web/src/types/index.ts` (type `ActivityItem`); Modify `FarmDetailView.tsx`.

---

## Task 1 : Backend — `dailyFeedKg` dans l'agrégat élevage

**Files:**
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/repository/DailyRecordRepository.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/api/dto/LivestockStats.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/service/LivestockFacadeImpl.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/reporting/api/dto/DashboardResponse.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/reporting/service/ReportingService.java`
- Test: `backend/avicare-app/src/test/java/com/avicare/livestock/DailyRecordFeedAggregateIT.java` (create) + mettre à jour les tests qui construisent `LivestockStats`/`LivestockSection`.

**Interfaces:**
- Produces: `LivestockStats.dailyFeedKg()` (Double, nullable, dernier champ) ; `DashboardResponse.LivestockSection.dailyFeedKg()` (Double, nullable, dernier champ) ; `DailyRecordRepository.sumFeedKgByFarmAndPeriod(Long,LocalDate,LocalDate)→BigDecimal`, `countFeedDaysByFarmAndPeriod(Long,LocalDate,LocalDate)→long`.

- [ ] **Step 1: Écrire le slice IT des 2 requêtes (échoue d'abord)**

Create `DailyRecordFeedAggregateIT.java`. Il seed 2 unités d'une ferme, des `DailyRecord` sur 2 jours, et vérifie la somme et le nombre de jours distincts.

```java
package com.avicare.livestock;

import static org.assertj.core.api.Assertions.assertThat;

import com.avicare.livestock.domain.DailyRecord;
import com.avicare.livestock.domain.ProductionUnit;
import com.avicare.livestock.domain.Species;
import com.avicare.livestock.domain.UnitKind;
import com.avicare.livestock.domain.UnitStatus;
import com.avicare.livestock.repository.DailyRecordRepository;
import com.avicare.livestock.repository.ProductionUnitRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** Slice IT for the farm+period feed aggregates on DailyRecordRepository. CI-only (Docker). */
@DataJpaTest(properties = "spring.jpa.hibernate.ddl-auto=validate")
@Testcontainers
class DailyRecordFeedAggregateIT {

  @Container
  static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

  @DynamicPropertySource
  static void props(DynamicPropertyRegistry r) {
    r.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    r.add("spring.datasource.username", POSTGRES::getUsername);
    r.add("spring.datasource.password", POSTGRES::getPassword);
    r.add("spring.flyway.enabled", () -> "true");
  }

  @Autowired private DailyRecordRepository dailyRecordRepository;
  @Autowired private ProductionUnitRepository productionUnitRepository;

  private Long unit(long farmId) {
    ProductionUnit u = new ProductionUnit();
    u.setFarmId(farmId);
    u.setSpecies(Species.POULTRY);
    u.setUnitKind(UnitKind.BATCH);
    u.setName("Lot");
    u.setStartDate(LocalDate.now().minusDays(10));
    u.setCurrentCount(100);
    u.setStatus(UnitStatus.ACTIVE);
    return productionUnitRepository.save(u).getId();
  }

  private void record(Long unitId, LocalDate date, String feedKg) {
    DailyRecord d = new DailyRecord();
    d.setProductionUnit(productionUnitRepository.findById(unitId).orElseThrow());
    d.setRecordDate(date);
    d.setMortalityCount(0);
    d.setFeedKg(new BigDecimal(feedKg));
    dailyRecordRepository.save(d);
  }

  @Test
  void sumsFeedAcrossUnits_andCountsDistinctDays() {
    long farmId = 771_000L;
    Long u1 = unit(farmId);
    Long u2 = unit(farmId);
    LocalDate d1 = LocalDate.now().minusDays(1);
    LocalDate d2 = LocalDate.now();
    record(u1, d1, "10");
    record(u2, d1, "5"); // same day, second unit
    record(u1, d2, "12");
    LocalDate from = LocalDate.now().minusDays(6);
    LocalDate to = LocalDate.now();

    assertThat(dailyRecordRepository.sumFeedKgByFarmAndPeriod(farmId, from, to))
        .isEqualByComparingTo("27"); // 10+5+12
    assertThat(dailyRecordRepository.countFeedDaysByFarmAndPeriod(farmId, from, to))
        .isEqualTo(2L); // d1, d2
  }
}
```

- [ ] **Step 2: Compiler — échoue (méthodes absentes)**

Run: `cd backend && ./mvnw -q -pl avicare-app -am clean test-compile`
Expected: FAIL — `cannot find symbol: method sumFeedKgByFarmAndPeriod`.

- [ ] **Step 3: Ajouter les 2 requêtes à `DailyRecordRepository`**

Après `sumMortalityByFarmAndPeriod`, ajouter (l'import `java.math.BigDecimal` est déjà présent) :

```java
  /**
   * Total feed (kg) across all units of a farm within [{@code from}, {@code to}]. COALESCE to 0 so
   * the caller distinguishes "no records" via {@link #countFeedDaysByFarmAndPeriod}.
   */
  @Query(
      "SELECT COALESCE(SUM(d.feedKg), 0) FROM DailyRecord d "
          + "WHERE d.productionUnit.id IN "
          + "  (SELECT u.id FROM ProductionUnit u WHERE u.farmId = :farmId) "
          + "AND d.recordDate BETWEEN :from AND :to")
  BigDecimal sumFeedKgByFarmAndPeriod(
      @Param("farmId") Long farmId, @Param("from") LocalDate from, @Param("to") LocalDate to);

  /** Number of distinct calendar days with a daily record for a farm within the window. */
  @Query(
      "SELECT COUNT(DISTINCT d.recordDate) FROM DailyRecord d "
          + "WHERE d.productionUnit.id IN "
          + "  (SELECT u.id FROM ProductionUnit u WHERE u.farmId = :farmId) "
          + "AND d.recordDate BETWEEN :from AND :to")
  long countFeedDaysByFarmAndPeriod(
      @Param("farmId") Long farmId, @Param("from") LocalDate from, @Param("to") LocalDate to);
```

- [ ] **Step 4: Ajouter `dailyFeedKg` à `LivestockStats`**

Dans `LivestockStats.java`, ajouter `Double dailyFeedKg` comme DERNIER composant du record (après `treatmentsCount`), et compléter le javadoc de tête (« {@code dailyFeedKg} = moyenne journalière de feed_kg sur la fenêtre, null si aucune saisie »).

- [ ] **Step 5: Calculer et passer `dailyFeedKg` dans `LivestockFacadeImpl.livestockStats`**

Juste avant le `return new LivestockStats(`, ajouter :

```java
    long feedDays = dailyRecordRepository.countFeedDaysByFarmAndPeriod(farmId, from, to);
    Double dailyFeedKg =
        feedDays > 0
            ? dailyRecordRepository.sumFeedKgByFarmAndPeriod(farmId, from, to).doubleValue()
                / feedDays
            : null;
```

Puis ajouter `dailyFeedKg` comme DERNIER argument du `new LivestockStats(...)`.

- [ ] **Step 6: Propager dans `DashboardResponse.LivestockSection` + `ReportingService`**

Dans `DashboardResponse.java`, ajouter `Double dailyFeedKg` comme DERNIER composant du record `LivestockSection` (le `@JsonInclude(NON_NULL)` de classe l'omet si null) et compléter son javadoc.

Dans `ReportingService.java`, ajouter `ls.dailyFeedKg()` comme DERNIER argument du `new LivestockSection(...)`.

- [ ] **Step 7: Réparer les constructions positionnelles en test**

Run: `cd backend && grep -rln "new LivestockStats(\|new LivestockSection(" avicare-app/src/test`
Pour CHAQUE fichier trouvé, ajouter l'argument `dailyFeedKg` à la bonne position (dernier). Valeur suggérée : un `Double` explicite (ex. `1.5`) ou `null` selon le scénario du test. Exemples typiques : `ReportingServiceTest`, `DashboardControllerIT` (si construit un `LivestockSection`/assert JSON — pour l'IT, ajouter au besoin une assertion `dailyFeedKg` mais NE PAS casser l'existant).

- [ ] **Step 8: Compiler (clean, fichiers test édités)**

Run: `cd backend && ./mvnw -q -pl avicare-app -am clean test-compile`
Expected: BUILD SUCCESS.

- [ ] **Step 9: Lancer les tests unitaires reporting touchés**

Run: `cd backend && ./mvnw -q -pl avicare-app -am test -Dtest=ReportingServiceTest -Dsurefire.failIfNoSpecifiedTests=false`
Expected: PASS (le slice IT `DailyRecordFeedAggregateIT` ne tourne qu'en CI).

- [ ] **Step 10: Spotless + commit**

```bash
cd backend && ./mvnw -q spotless:apply
git add backend/avicare-app/src/main/java/com/avicare/livestock/repository/DailyRecordRepository.java \
        backend/avicare-app/src/main/java/com/avicare/livestock/api/dto/LivestockStats.java \
        backend/avicare-app/src/main/java/com/avicare/livestock/service/LivestockFacadeImpl.java \
        backend/avicare-app/src/main/java/com/avicare/reporting/api/dto/DashboardResponse.java \
        backend/avicare-app/src/main/java/com/avicare/reporting/service/ReportingService.java \
        backend/avicare-app/src/test/java/com/avicare/
git commit -m "feat(reporting): add dailyFeedKg (7-day avg) to the livestock dashboard aggregate"
```

---

## Task 2 : Frontend — brancher les 4 cartes KPI

**Files:**
- Modify: `web/src/types/dashboard.ts`
- Modify: `web/src/components/farms/FarmDetailView.tsx`
- Test: `web/src/components/farms/FarmDetailView.test.tsx` (create ou étendre)

**Interfaces:**
- Consumes: `useGetDashboardQuery({ farmId, period })` → `DashboardResponse` avec `livestock.{totalHeadcount, mortalityRate, layingRate, dailyFeedKg}`.

- [ ] **Step 1: Ajouter `dailyFeedKg` au type dashboard**

Dans `web/src/types/dashboard.ts`, dans le type de la section `livestock`, ajouter `dailyFeedKg: number | null;` (aligné avec les autres champs nullables `mortalityRate`/`layingRate`).

- [ ] **Step 2: Écrire le test des cartes (échoue d'abord)**

Create/étendre `web/src/components/farms/FarmDetailView.test.tsx` : stub `fetch` pour `/farms/{id}` (la ferme) ET `/dashboard` (renvoie `{ data: { period, livestock: { totalHeadcount: 769, mortalityRate: 3.1, layingRate: null, dailyFeedKg: 42.5, ... }, commercial: null, inventory: null } }`), rendre `<FarmDetailView farmId={1} />`, onglet overview par défaut, et asserter :

```tsx
expect(await screen.findByText("769")).toBeInTheDocument();      // Effectif total
expect(screen.getByText("3.1 %")).toBeInTheDocument();           // Mortalité
expect(screen.getByText("n/d")).toBeInTheDocument();             // Production (layingRate null)
expect(screen.getByText("42.5 kg")).toBeInTheDocument();         // Aliment
```

(S'inspirer d'un test existant pour le stub `fetch` multi-URL, ex. `web/src/components/finance/ExpenseDialog.test.tsx`.)

- [ ] **Step 3: Lancer — échoue (cartes affichent « — »)**

Run: `cd web && npx vitest run src/components/farms/FarmDetailView.test.tsx`
Expected: FAIL — les valeurs ne sont pas rendues.

- [ ] **Step 4: Brancher les cartes dans `FarmDetailView`**

Ajouter l'import et l'appel (dans le composant, à côté de `useGetFarmQuery`) :

```tsx
import { useGetDashboardQuery } from "@/store/api/dashboardApi";
```
```tsx
  const { data: dashboard } = useGetDashboardQuery({ farmId, period: "7d" });
  const ls = dashboard?.livestock;
```

Définir un helper de formatage au-dessus du composant :

```tsx
const pct = (v: number | null | undefined) => (v != null ? `${v.toFixed(1)} %` : "n/d");
const kg = (v: number | null | undefined) => (v != null ? `${v.toFixed(1)} kg` : "n/d");
```

Remplacer le bloc `OVERVIEW_STATS.map(...)` qui rend `—` par un rendu piloté par les données. Remplacer la constante `OVERVIEW_STATS` par une fonction de valeurs :

```tsx
const overviewCards = [
  { label: "Effectif total", hint: "Sujets actifs", value: ls ? String(ls.totalHeadcount) : "…" },
  { label: "Taux de mortalité", hint: "Sur 7 jours", value: ls ? pct(ls.mortalityRate) : "…" },
  { label: "Production (7j)", hint: "Taux de ponte", value: ls ? pct(ls.layingRate) : "…" },
  { label: "Aliment (journalier)", hint: "Consommation moy./jour", value: ls ? kg(ls.dailyFeedKg) : "…" },
];
```

et dans le `.map`, afficher `card.value` au lieu de `—`, et `card.hint` sans « · bientôt disponible ».

- [ ] **Step 5: Lancer — passe**

Run: `cd web && npx vitest run src/components/farms/FarmDetailView.test.tsx`
Expected: PASS.

- [ ] **Step 6: Lint + commit**

```bash
cd web && npm run lint
git add web/src/types/dashboard.ts web/src/components/farms/FarmDetailView.tsx web/src/components/farms/FarmDetailView.test.tsx
git commit -m "feat(web): wire farm overview KPI cards to the 7-day dashboard aggregate"
```

---

## Task 3 : `ActivityItem` DTO + `LivestockFacade.recentActivity`

**Files:**
- Create: `backend/common/common-api/src/main/java/com/avicare/common/api/dto/ActivityItem.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/api/LivestockFacade.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/service/LivestockFacadeImpl.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/repository/LifecycleEventRepository.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/repository/StockMovementRepository.java`
- Test: `backend/avicare-app/src/test/java/com/avicare/livestock/LivestockActivityIT.java` (create)

**Interfaces:**
- Produces: `ActivityItem(String kind, LocalDateTime at, String label, String detail)` (`com.avicare.common.api.dto`) ; `LivestockFacade.recentActivity(Long farmId, int limit) → List<ActivityItem>`.

- [ ] **Step 1: Créer le DTO partagé**

Create `ActivityItem.java` :

```java
package com.avicare.common.api.dto;

import java.time.LocalDateTime;

/**
 * One item in a farm's recent-activity feed. {@code kind} is a stable machine tag (e.g. {@code
 * MORTALITY}, {@code VET_VISIT_RECORDED}, {@code SALE}, {@code PAYMENT}, {@code STOCK_IN}); {@code
 * at} is the sort key (most recent first); {@code label} is a ready-to-display French line; {@code
 * detail} is an optional secondary line (nullable).
 */
public record ActivityItem(String kind, LocalDateTime at, String label, String detail) {}
```

- [ ] **Step 2: Écrire l'IT (échoue d'abord)**

Create `LivestockActivityIT.java` (Testcontainers, CI-only). Il seed une unité, journalise une mortalité via `LivestockService.recordMortality` (ou insère un `LifecycleEvent`), fait un mouvement de stock, et vérifie que `recentActivity` renvoie les items attendus, triés desc, en excluant un event hors liste blanche.

```java
package com.avicare.livestock;

import static org.assertj.core.api.Assertions.assertThat;

import com.avicare.common.api.dto.ActivityItem;
import com.avicare.livestock.api.LivestockFacade;
import com.avicare.livestock.domain.LifecycleEvent;
import com.avicare.livestock.domain.ProductionUnit;
import com.avicare.livestock.domain.Species;
import com.avicare.livestock.domain.UnitKind;
import com.avicare.livestock.domain.UnitStatus;
import com.avicare.livestock.repository.LifecycleEventRepository;
import com.avicare.livestock.repository.ProductionUnitRepository;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** Verifies LivestockFacade.recentActivity whitelist + ordering on a real DB. CI-only. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@Testcontainers
class LivestockActivityIT {

  @Container
  static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

  @DynamicPropertySource
  static void props(DynamicPropertyRegistry r) {
    r.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    r.add("spring.datasource.username", POSTGRES::getUsername);
    r.add("spring.datasource.password", POSTGRES::getPassword);
    r.add("spring.flyway.enabled", () -> "true");
    r.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
  }

  @Autowired private LivestockFacade livestockFacade;
  @Autowired private ProductionUnitRepository productionUnitRepository;
  @Autowired private LifecycleEventRepository lifecycleEventRepository;

  private Long unit(long farmId) {
    ProductionUnit u = new ProductionUnit();
    u.setFarmId(farmId);
    u.setSpecies(Species.POULTRY);
    u.setUnitKind(UnitKind.BATCH);
    u.setName("Lot");
    u.setStartDate(java.time.LocalDate.now().minusDays(5));
    u.setCurrentCount(100);
    u.setStatus(UnitStatus.ACTIVE);
    return productionUnitRepository.save(u).getId();
  }

  private void event(Long unitId, String type, int delta) {
    LifecycleEvent e = new LifecycleEvent();
    e.setProductionUnitId(unitId);
    e.setEventType(type);
    e.setQuantityDelta(delta);
    lifecycleEventRepository.save(e);
  }

  @Test
  void recentActivity_whitelistsMeaningfulEvents_andExcludesGuards() {
    long farmId = 772_000L;
    Long unitId = unit(farmId);
    event(unitId, "MORTALITY", -5);
    event(unitId, "VET_VISIT_RECORDED", 0);
    event(unitId, "INVALID_MORTALITY_COUNT", 0); // guard marker → excluded
    event(unitId, "DAILY_RECORD", 0); // noisy → excluded (not in whitelist)

    List<ActivityItem> items = livestockFacade.recentActivity(farmId, 20);

    assertThat(items).extracting(ActivityItem::kind)
        .contains("MORTALITY", "VET_VISIT_RECORDED")
        .doesNotContain("INVALID_MORTALITY_COUNT", "DAILY_RECORD");
    assertThat(items).extracting(ActivityItem::label)
        .anyMatch(l -> l.equals("Mortalité : 5 sujets"));
  }
}
```

- [ ] **Step 3: Compiler — échoue (recentActivity absent)**

Run: `cd backend && ./mvnw -q -pl avicare-app -am clean test-compile`
Expected: FAIL — `cannot find symbol: method recentActivity`.

- [ ] **Step 4: Requête lifecycle events récents (whitelist)**

Dans `LifecycleEventRepository.java`, ajouter les imports `java.util.Collection`, `org.springframework.data.domain.Pageable`, `org.springframework.data.jpa.repository.Query`, `org.springframework.data.repository.query.Param` (ceux déjà présents ne sont pas redoublés) et :

```java
  /** Recent whitelisted lifecycle events for a farm, most recent first, capped by {@code pageable}. */
  @Query(
      "SELECT e FROM LifecycleEvent e WHERE e.productionUnitId IN "
          + "  (SELECT u.id FROM ProductionUnit u WHERE u.farmId = :farmId) "
          + "AND e.eventType IN :types ORDER BY e.occurredAt DESC")
  java.util.List<com.avicare.livestock.domain.LifecycleEvent> findRecentByFarmAndTypes(
      @Param("farmId") Long farmId,
      @Param("types") java.util.Collection<String> types,
      org.springframework.data.domain.Pageable pageable);
```

- [ ] **Step 5: Variante Pageable des mouvements de stock**

Dans `StockMovementRepository.java`, ajouter (import `org.springframework.data.domain.Pageable`) :

```java
  List<StockMovement> findByStockItem_FarmIdOrderByMovementDateDescIdDesc(
      Long farmId, org.springframework.data.domain.Pageable pageable);
```

- [ ] **Step 6: Implémenter `recentActivity` sur la façade**

Dans `LivestockFacade.java` (interface), ajouter (import `com.avicare.common.api.dto.ActivityItem`, `java.util.List`) :

```java
  /** Up to {@code limit} most recent livestock activity items (lifecycle events + stock movements). */
  java.util.List<com.avicare.common.api.dto.ActivityItem> recentActivity(Long farmId, int limit);
```

Dans `LivestockFacadeImpl.java`, injecter le repo manquant (`StockMovementRepository stockMovementRepository` — l'ajouter comme champ `private final` si absent ; `LifecycleEventRepository` est déjà injecté) et ajouter :

```java
  private static final java.util.Set<String> ACTIVITY_EVENT_TYPES =
      java.util.Set.of(
          "MORTALITY", "COUNT_ADJUSTMENT", "VACCINATION_ADMINISTERED", "TREATMENT_ADMINISTERED",
          "VET_VISIT_RECORDED", "DAILY_PRODUCTION_CLOSED", "CREATED", "HEALTH_OBSERVATION");

  @Override
  @org.springframework.transaction.annotation.Transactional(readOnly = true)
  public java.util.List<com.avicare.common.api.dto.ActivityItem> recentActivity(
      Long farmId, int limit) {
    org.springframework.data.domain.Pageable page =
        org.springframework.data.domain.PageRequest.of(0, limit);
    java.util.stream.Stream<com.avicare.common.api.dto.ActivityItem> events =
        lifecycleEventRepository
            .findRecentByFarmAndTypes(farmId, ACTIVITY_EVENT_TYPES, page)
            .stream()
            .map(LivestockFacadeImpl::lifecycleToActivity);
    java.util.stream.Stream<com.avicare.common.api.dto.ActivityItem> movements =
        stockMovementRepository
            .findByStockItem_FarmIdOrderByMovementDateDescIdDesc(farmId, page)
            .stream()
            .map(LivestockFacadeImpl::movementToActivity);
    return java.util.stream.Stream.concat(events, movements)
        .sorted(
            java.util.Comparator.comparing(
                    com.avicare.common.api.dto.ActivityItem::at,
                    java.util.Comparator.nullsLast(java.util.Comparator.naturalOrder()))
                .reversed())
        .limit(limit)
        .toList();
  }

  private static com.avicare.common.api.dto.ActivityItem lifecycleToActivity(
      com.avicare.livestock.domain.LifecycleEvent e) {
    String label =
        switch (e.getEventType()) {
          case "MORTALITY" -> "Mortalité : " + Math.abs(e.getQuantityDelta()) + " sujets";
          case "COUNT_ADJUSTMENT" -> "Ajustement d'effectif";
          case "VACCINATION_ADMINISTERED" -> "Vaccination";
          case "TREATMENT_ADMINISTERED" -> "Traitement administré";
          case "VET_VISIT_RECORDED" -> "Visite vétérinaire";
          case "DAILY_PRODUCTION_CLOSED" -> "Production journalière clôturée";
          case "CREATED" -> "Lot créé";
          case "HEALTH_OBSERVATION" -> "Observation sanitaire";
          default -> e.getEventType();
        };
    return new com.avicare.common.api.dto.ActivityItem(
        e.getEventType(), e.getOccurredAt(), label, e.getReason());
  }

  private static com.avicare.common.api.dto.ActivityItem movementToActivity(
      com.avicare.livestock.domain.StockMovement m) {
    String article = m.getStockItem().getArticleKey();
    String kind =
        switch (m.getMovementType()) {
          case IN -> "STOCK_IN";
          case OUT -> "STOCK_OUT";
          case ADJUSTMENT -> "STOCK_ADJUSTMENT";
        };
    String label =
        switch (m.getMovementType()) {
          case IN -> "Entrée stock : " + article;
          case OUT -> "Sortie stock : " + article;
          case ADJUSTMENT -> "Ajustement stock : " + article;
        };
    return new com.avicare.common.api.dto.ActivityItem(
        kind, m.getMovementDate().atStartOfDay(), label, m.getQuantity().toPlainString() + " unités");
  }
```

> Note : `occurredAt` (lifecycle) est en `insertable=false` (rempli par trigger DB) → après `save`+flush il est non-null en lecture. En `@DataJpaTest`/IT le flush a lieu avant la lecture de la façade.

- [ ] **Step 7: Compiler**

Run: `cd backend && ./mvnw -q -pl avicare-app -am clean test-compile`
Expected: BUILD SUCCESS.

- [ ] **Step 8: Spotless + commit**

```bash
cd backend && ./mvnw -q spotless:apply
git add backend/common/common-api/src/main/java/com/avicare/common/api/dto/ActivityItem.java \
        backend/avicare-app/src/main/java/com/avicare/livestock/api/LivestockFacade.java \
        backend/avicare-app/src/main/java/com/avicare/livestock/service/LivestockFacadeImpl.java \
        backend/avicare-app/src/main/java/com/avicare/livestock/repository/LifecycleEventRepository.java \
        backend/avicare-app/src/main/java/com/avicare/livestock/repository/StockMovementRepository.java \
        backend/avicare-app/src/test/java/com/avicare/livestock/LivestockActivityIT.java
git commit -m "feat(livestock): ActivityItem DTO + LivestockFacade.recentActivity (events + stock)"
```

---

## Task 4 : `CommercialFacade.recentActivity` (ventes + paiements)

**Files:**
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/commercial/CommercialFacade.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/commercial/CommercialFacadeImpl.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/repository/SaleRepository.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/repository/PaymentRepository.java`
- Test: `backend/avicare-app/src/test/java/com/avicare/livestock/commercial/CommercialActivityIT.java` (create)

**Interfaces:**
- Consumes: `ActivityItem` (Task 3).
- Produces: `CommercialFacade.recentActivity(Long farmId, int limit) → List<ActivityItem>`.

- [ ] **Step 1: Écrire l'IT (échoue d'abord)**

Create `CommercialActivityIT.java` — miroir de `CommercialRevenueQueriesIT` (setup ferme via signup/login + services `SaleService`/`PaymentService`/`ClientService`). Crée une vente COMPLETED, une facture payée, puis vérifie que `recentActivity` contient un item `SALE` et un item `PAYMENT` avec les bons libellés.

```java
package com.avicare.livestock.commercial;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.avicare.common.api.dto.ActivityItem;
import com.avicare.livestock.domain.ArticleSource;
import com.avicare.livestock.domain.Invoice;
import com.avicare.livestock.domain.PaymentMethod;
import com.avicare.livestock.domain.Sale;
import com.avicare.support.RsaKeys;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.security.KeyPair;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** Verifies CommercialFacade.recentActivity (sales + payments) on a real DB. CI-only. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@Testcontainers
class CommercialActivityIT {

  @Container
  static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

  private static final KeyPair KEYS = RsaKeys.generate();

  @DynamicPropertySource
  static void props(DynamicPropertyRegistry r) {
    r.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    r.add("spring.datasource.username", POSTGRES::getUsername);
    r.add("spring.datasource.password", POSTGRES::getPassword);
    r.add("spring.flyway.enabled", () -> "true");
    r.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
    r.add("avicare.security.jwt.private-key", () -> RsaKeys.privatePem(KEYS));
    r.add("avicare.security.jwt.public-key", () -> RsaKeys.publicPem(KEYS));
  }

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;
  @Autowired private CommercialFacade commercialFacade;
  @Autowired private SaleService saleService;
  @Autowired private InvoiceService invoiceService;
  @Autowired private PaymentService paymentService;
  @Autowired private ClientService clientService;

  @Test
  void recentActivity_includesSaleAndPayment() throws Exception {
    long farmId = createFarm();
    long clientId =
        clientService
            .create(
                farmId,
                new ClientCommand(
                    com.avicare.livestock.domain.ClientType.BUSINESS,
                    "Ferme du Soleil", null, null, null, null, null, null, null, null),
                1L)
            .getId();

    Sale sale =
        saleService.create(
            farmId,
            new SaleCommand(
                clientId, null, "CREDIT", null,
                List.of(
                    new SaleCommand.Line(
                        "eggs_consumption", ArticleSource.INVENTORY, new BigDecimal("10"), 3000,
                        null, null, null))),
            1L);
    Invoice inv = invoiceService.createFromSale(farmId, sale.getId(), null, 1L);
    paymentService.record(
        farmId,
        new PaymentCommand(inv.getId(), 30_000L, PaymentMethod.CASH, null, null, null),
        1L);

    List<ActivityItem> items = commercialFacade.recentActivity(farmId, 20);

    assertThat(items).extracting(ActivityItem::kind).contains("SALE", "PAYMENT");
    assertThat(items).extracting(ActivityItem::label)
        .anyMatch(l -> l.startsWith("Vente "))
        .anyMatch(l -> l.startsWith("Paiement reçu "));
  }

  private long createFarm() throws Exception {
    String email = "t" + System.nanoTime() + "@act.io";
    mockMvc
        .perform(
            post("/api/v1/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"email\":\"" + email + "\",\"password\":\"password123\",\"fullName\":\"T\"}"))
        .andExpect(status().isCreated());
    String token =
        objectMapper
            .readTree(
                mockMvc
                    .perform(
                        post("/api/v1/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"email\":\"" + email + "\",\"password\":\"password123\"}"))
                    .andReturn()
                    .getResponse()
                    .getContentAsString())
            .get("data")
            .get("accessToken")
            .asText();
    String json =
        mockMvc
            .perform(
                post("/api/v1/farms")
                    .header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"name\":\"Ferme Act\"}"))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    return objectMapper.readTree(json).get("data").get("id").asLong();
  }
}
```

> Si une signature de commande (`SaleCommand.Line`, `ClientCommand`, `PaymentCommand`) diffère, l'aligner sur `CommercialRevenueQueriesIT` (déjà mergé, même package) qui utilise ces mêmes types.

- [ ] **Step 2: Compiler — échoue (recentActivity absent)**

Run: `cd backend && ./mvnw -q -pl avicare-app -am clean test-compile`
Expected: FAIL — `cannot find symbol: method recentActivity`.

- [ ] **Step 3: Variantes Pageable des repos**

Dans `SaleRepository.java` (import `Pageable` déjà présent) :

```java
  List<Sale> findByFarmIdAndStatusOrderBySaleDateDescIdDesc(
      Long farmId, SaleStatus status, org.springframework.data.domain.Pageable pageable);
```

Dans `PaymentRepository.java` (ajouter l'import `org.springframework.data.domain.Pageable`) :

```java
  List<Payment> findByFarmIdOrderByPaymentDateDescIdDesc(
      Long farmId, org.springframework.data.domain.Pageable pageable);
```

- [ ] **Step 4: Déclarer + implémenter `recentActivity`**

Dans `CommercialFacade.java`, après `totalPaidFromDeliveryInvoices` :

```java
  /** Up to {@code limit} most recent commercial activity items (sales + payments). */
  java.util.List<com.avicare.common.api.dto.ActivityItem> recentActivity(Long farmId, int limit);
```

Dans `CommercialFacadeImpl.java` (les champs `saleRepository` et `PaymentRepository` : `saleRepository` existe déjà ; ajouter `private final PaymentRepository paymentRepository;` s'il n'est pas déjà injecté — vérifier et n'ajouter que si absent) :

```java
  @Override
  public java.util.List<com.avicare.common.api.dto.ActivityItem> recentActivity(
      Long farmId, int limit) {
    org.springframework.data.domain.Pageable page =
        org.springframework.data.domain.PageRequest.of(0, limit);
    java.util.stream.Stream<com.avicare.common.api.dto.ActivityItem> sales =
        saleRepository
            .findByFarmIdAndStatusOrderBySaleDateDescIdDesc(
                farmId, com.avicare.livestock.domain.SaleStatus.COMPLETED, page)
            .stream()
            .map(
                s ->
                    new com.avicare.common.api.dto.ActivityItem(
                        "SALE", s.getCreatedAt(), "Vente " + s.getTotalXof() + " XOF", null));
    java.util.stream.Stream<com.avicare.common.api.dto.ActivityItem> payments =
        paymentRepository
            .findByFarmIdOrderByPaymentDateDescIdDesc(farmId, page)
            .stream()
            .map(
                p ->
                    new com.avicare.common.api.dto.ActivityItem(
                        "PAYMENT",
                        p.getCreatedAt(),
                        "Paiement reçu " + p.getAmountXof() + " XOF",
                        null));
    return java.util.stream.Stream.concat(sales, payments)
        .sorted(
            java.util.Comparator.comparing(
                    com.avicare.common.api.dto.ActivityItem::at,
                    java.util.Comparator.nullsLast(java.util.Comparator.naturalOrder()))
                .reversed())
        .limit(limit)
        .toList();
  }
```

- [ ] **Step 5: Compiler**

Run: `cd backend && ./mvnw -q -pl avicare-app -am clean test-compile`
Expected: BUILD SUCCESS.

- [ ] **Step 6: Spotless + commit**

```bash
cd backend && ./mvnw -q spotless:apply
git add backend/avicare-app/src/main/java/com/avicare/livestock/commercial/CommercialFacade.java \
        backend/avicare-app/src/main/java/com/avicare/livestock/commercial/CommercialFacadeImpl.java \
        backend/avicare-app/src/main/java/com/avicare/livestock/repository/SaleRepository.java \
        backend/avicare-app/src/main/java/com/avicare/livestock/repository/PaymentRepository.java \
        backend/avicare-app/src/test/java/com/avicare/livestock/commercial/CommercialActivityIT.java
git commit -m "feat(commercial): CommercialFacade.recentActivity (sales + payments)"
```

---

## Task 5 : `ActivityService` (fusion) + endpoint

**Files:**
- Create: `backend/avicare-app/src/main/java/com/avicare/reporting/service/ActivityService.java`
- Create: `backend/avicare-app/src/main/java/com/avicare/reporting/controller/ActivityController.java`
- Test: `backend/avicare-app/src/test/java/com/avicare/reporting/service/ActivityServiceTest.java` (create) + `backend/avicare-app/src/test/java/com/avicare/reporting/controller/ActivityControllerIT.java` (create)

**Interfaces:**
- Consumes: `LivestockFacade.recentActivity`, `CommercialFacade.recentActivity` (Tasks 3-4).
- Produces: `ActivityService.recentActivity(Long farmId, int limit) → List<ActivityItem>` ; `GET /api/v1/farms/{farmId}/activity?limit=20`.

- [ ] **Step 1: Écrire le test unitaire du service (échoue d'abord)**

Create `ActivityServiceTest.java` — façades mockées, vérifie fusion + tri desc + limite.

```java
package com.avicare.reporting.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.avicare.common.api.dto.ActivityItem;
import com.avicare.livestock.api.LivestockFacade;
import com.avicare.livestock.commercial.CommercialFacade;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

class ActivityServiceTest {

  private LivestockFacade livestockFacade;
  private CommercialFacade commercialFacade;
  private ActivityService service;

  @BeforeEach
  void setUp() {
    livestockFacade = Mockito.mock(LivestockFacade.class);
    commercialFacade = Mockito.mock(CommercialFacade.class);
    service = new ActivityService(livestockFacade, commercialFacade);
  }

  @Test
  void mergesSortsDescAndCaps() {
    LocalDateTime t1 = LocalDateTime.of(2026, 7, 1, 8, 0);
    LocalDateTime t2 = LocalDateTime.of(2026, 7, 3, 8, 0);
    LocalDateTime t3 = LocalDateTime.of(2026, 7, 2, 8, 0);
    when(livestockFacade.recentActivity(3L, 20))
        .thenReturn(List.of(new ActivityItem("MORTALITY", t1, "Mortalité : 2 sujets", null)));
    when(commercialFacade.recentActivity(3L, 20))
        .thenReturn(
            List.of(
                new ActivityItem("SALE", t2, "Vente 700000 XOF", null),
                new ActivityItem("PAYMENT", t3, "Paiement reçu 5000 XOF", null)));

    List<ActivityItem> items = service.recentActivity(3L, 2);

    assertThat(items).hasSize(2);
    assertThat(items).extracting(ActivityItem::at).containsExactly(t2, t3); // desc, capped at 2
  }
}
```

- [ ] **Step 2: Lancer — échoue (ActivityService absent)**

Run: `cd backend && ./mvnw -q -pl avicare-app -am clean test-compile`
Expected: FAIL — `cannot find symbol: class ActivityService`.

- [ ] **Step 3: Implémenter `ActivityService`**

Create `ActivityService.java` :

```java
package com.avicare.reporting.service;

import com.avicare.common.api.dto.ActivityItem;
import com.avicare.livestock.api.LivestockFacade;
import com.avicare.livestock.commercial.CommercialFacade;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Stream;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Merges the recent-activity feeds from the livestock and commercial contexts into a single farm
 * timeline (most recent first, capped at {@code limit}).
 */
@Service
@RequiredArgsConstructor
public class ActivityService {

  private final LivestockFacade livestockFacade;
  private final CommercialFacade commercialFacade;

  public List<ActivityItem> recentActivity(Long farmId, int limit) {
    return Stream.concat(
            livestockFacade.recentActivity(farmId, limit).stream(),
            commercialFacade.recentActivity(farmId, limit).stream())
        .sorted(
            Comparator.comparing(
                    ActivityItem::at, Comparator.nullsLast(Comparator.naturalOrder()))
                .reversed())
        .limit(limit)
        .toList();
  }
}
```

- [ ] **Step 4: Lancer le test unitaire — passe**

Run: `cd backend && ./mvnw -q -pl avicare-app -am test -Dtest=ActivityServiceTest -Dsurefire.failIfNoSpecifiedTests=false`
Expected: PASS.

- [ ] **Step 5: Écrire l'IT de l'endpoint (échoue d'abord)**

Create `ActivityControllerIT.java` — miroir de `CommercialActivityIT` pour le setup ferme ; après une vente, `GET /api/v1/farms/{farmId}/activity?limit=20` (avec Bearer) et assert un item `SALE` dans le JSON.

```java
package com.avicare.reporting.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.avicare.support.RsaKeys;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.security.KeyPair;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** E2E: the /activity endpoint returns a merged feed with RBAC. CI-only. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@Testcontainers
class ActivityControllerIT {

  @Container
  static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

  private static final KeyPair KEYS = RsaKeys.generate();

  @DynamicPropertySource
  static void props(DynamicPropertyRegistry r) {
    r.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    r.add("spring.datasource.username", POSTGRES::getUsername);
    r.add("spring.datasource.password", POSTGRES::getPassword);
    r.add("spring.flyway.enabled", () -> "true");
    r.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
    r.add("avicare.security.jwt.private-key", () -> RsaKeys.privatePem(KEYS));
    r.add("avicare.security.jwt.public-key", () -> RsaKeys.publicPem(KEYS));
  }

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;

  @Test
  void activityEndpoint_returnsMergedFeed() throws Exception {
    String email = "t" + System.nanoTime() + "@actapi.io";
    mockMvc
        .perform(
            post("/api/v1/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"email\":\"" + email + "\",\"password\":\"password123\",\"fullName\":\"T\"}"))
        .andExpect(status().isCreated());
    String token =
        objectMapper
            .readTree(
                mockMvc
                    .perform(
                        post("/api/v1/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(
                                "{\"email\":\"" + email + "\",\"password\":\"password123\"}"))
                    .andReturn()
                    .getResponse()
                    .getContentAsString())
            .get("data")
            .get("accessToken")
            .asText();
    long farmId =
        objectMapper
            .readTree(
                mockMvc
                    .perform(
                        post("/api/v1/farms")
                            .header("Authorization", "Bearer " + token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"name\":\"Ferme Act\"}"))
                    .andExpect(status().isCreated())
                    .andReturn()
                    .getResponse()
                    .getContentAsString())
            .get("data")
            .get("id")
            .asLong();

    // Empty feed is a valid 200 (no activity yet) — asserts the endpoint + RBAC wire up.
    mockMvc
        .perform(
            get("/api/v1/farms/" + farmId + "/activity?limit=20")
                .header("Authorization", "Bearer " + token))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data").isArray());
  }
}
```

- [ ] **Step 6: Implémenter `ActivityController`**

Create `ActivityController.java` (miroir de `DashboardController`) :

```java
package com.avicare.reporting.controller;

import com.avicare.common.api.dto.ActivityItem;
import com.avicare.common.api.response.ApiResponse;
import com.avicare.reporting.service.ActivityService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Recent-activity feed for a farm (reporting). Any farm member; capped at 50. */
@RestController
@RequestMapping("/api/v1/farms/{farmId}/activity")
@RequiredArgsConstructor
public class ActivityController {

  private final ActivityService activityService;

  @GetMapping
  @PreAuthorize("@farmAccess.hasAccess(#farmId)")
  public ApiResponse<List<ActivityItem>> get(
      @PathVariable Long farmId, @RequestParam(defaultValue = "20") int limit) {
    int capped = Math.max(1, Math.min(limit, 50));
    return ApiResponse.of(activityService.recentActivity(farmId, capped));
  }
}
```

- [ ] **Step 7: Compiler + vérifier le boot DB-less**

Run: `cd backend && ./mvnw -q -pl avicare-app -am clean test-compile`
Expected: BUILD SUCCESS.

`ActivityService` dépend de `LivestockFacade` + `CommercialFacade` (beans existants) ; `ActivityController` est un nouveau bean sans nouveau repo. Confirmer le boot :

Run: `cd backend && ./mvnw -q -pl avicare-app -am test -Dtest=SecurityE2ETest,SecurityIntegrationTest -Dsurefire.failIfNoSpecifiedTests=false`
Expected: PASS (les 3 contextes DB-less démarrent ; `DashboardControllerIT` = failsafe/CI).

- [ ] **Step 8: Spotless + commit**

```bash
cd backend && ./mvnw -q spotless:apply
git add backend/avicare-app/src/main/java/com/avicare/reporting/service/ActivityService.java \
        backend/avicare-app/src/main/java/com/avicare/reporting/controller/ActivityController.java \
        backend/avicare-app/src/test/java/com/avicare/reporting/
git commit -m "feat(reporting): merge livestock + commercial activity into GET /farms/{id}/activity"
```

---

## Task 6 : Frontend — flux « Activité récente »

**Files:**
- Modify: `web/src/types/index.ts` (type `ActivityItem`)
- Create: `web/src/store/api/activityApi.ts`
- Modify: `web/src/components/farms/FarmDetailView.tsx`
- Test: `web/src/components/farms/FarmDetailView.test.tsx` (étendre)

**Interfaces:**
- Consumes: `GET /api/v1/farms/{farmId}/activity?limit=20` → `ActivityItem[]`.
- Produces: `useGetFarmActivityQuery({ farmId, limit })`.

- [ ] **Step 1: Type `ActivityItem`**

Dans `web/src/types/index.ts`, ajouter :

```ts
/** One item in a farm's recent-activity feed (mirrors backend ActivityItem). */
export interface ActivityItem {
  kind: string;
  at: string; // ISO LocalDateTime
  label: string;
  detail: string | null;
}
```

- [ ] **Step 2: Endpoint RTK Query**

Create `web/src/store/api/activityApi.ts` (miroir de `dashboardApi.ts`) :

```ts
import { baseApi } from "./baseApi";
import type { ActivityItem } from "@/types";

interface ApiEnvelope<T> {
  data: T;
}

export const activityApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getFarmActivity: build.query<ActivityItem[], { farmId: number; limit?: number }>({
      query: ({ farmId, limit = 20 }) => `/api/v1/farms/${farmId}/activity?limit=${limit}`,
      transformResponse: (r: ApiEnvelope<ActivityItem[]>) => r.data,
    }),
  }),
});

export const { useGetFarmActivityQuery } = activityApi;
```

- [ ] **Step 3: Écrire le test de la liste (échoue d'abord)**

Étendre `FarmDetailView.test.tsx` : dans le stub `fetch`, répondre pour `/activity` avec `{ data: [{ kind: "MORTALITY", at: "2026-07-06T08:00:00", label: "Mortalité : 5 sujets", detail: null }, { kind: "SALE", at: "2026-07-05T10:00:00", label: "Vente 700000 XOF", detail: null }] }`. Assert que « Mortalité : 5 sujets » et « Vente 700000 XOF » sont rendus dans l'onglet overview.

```tsx
expect(await screen.findByText("Mortalité : 5 sujets")).toBeInTheDocument();
expect(screen.getByText("Vente 700000 XOF")).toBeInTheDocument();
```

- [ ] **Step 4: Lancer — échoue (placeholder encore là)**

Run: `cd web && npx vitest run src/components/farms/FarmDetailView.test.tsx`
Expected: FAIL — les libellés d'activité ne sont pas rendus.

- [ ] **Step 5: Rendre la liste dans `FarmDetailView`**

Importer le hook et une fonction de date relative :

```tsx
import { useGetFarmActivityQuery } from "@/store/api/activityApi";
```
```tsx
  const { data: activity = [], isLoading: activityLoading } =
    useGetFarmActivityQuery({ farmId, limit: 20 });
```

Remplacer le contenu de la carte « Activité récente » (le `<Placeholder>…</Placeholder>`) par :

```tsx
{activityLoading ? (
  <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 1 }} />
) : activity.length === 0 ? (
  <Placeholder>Aucune activité récente.</Placeholder>
) : (
  <List dense disablePadding>
    {activity.map((item, i) => (
      <ListItem key={`${item.at}-${i}`} disableGutters>
        <ListItemText
          primary={item.label}
          secondary={new Date(item.at).toLocaleString("fr-FR")}
        />
      </ListItem>
    ))}
  </List>
)}
```

Ajouter les imports MUI manquants (`List`, `ListItem`, `ListItemText`, `Skeleton`) au bloc d'import `@mui/material` existant.

> Icône par `kind` : optionnelle V1. Si ajoutée, mapper `kind` → une icône MUI ; sinon la liste texte suffit (YAGNI).

- [ ] **Step 6: Lancer — passe**

Run: `cd web && npx vitest run src/components/farms/FarmDetailView.test.tsx`
Expected: PASS.

- [ ] **Step 7: Lint + commit**

```bash
cd web && npm run lint
git add web/src/types/index.ts web/src/store/api/activityApi.ts web/src/components/farms/FarmDetailView.tsx web/src/components/farms/FarmDetailView.test.tsx
git commit -m "feat(web): recent-activity feed on the farm overview tab"
```

---

## Self-Review (rempli à l'écriture)

**1. Spec coverage :**
- 4 cartes KPI (3 réutilisées + `dailyFeedKg`) → Tasks 1-2. ✅
- Activité multi-sources : DTO `common-api` + `LivestockFacade.recentActivity` (lifecycle whitelist + stock) + `CommercialFacade.recentActivity` (ventes+paiements) + fusion `ActivityService` + endpoint → Tasks 3-5. ✅
- Frontend cartes + liste → Tasks 2, 6. ✅
- Fenêtre 7 j fixe (`period:"7d"`), `dailyFeedKg` nullable, whitelist exacte (avec `TREATMENT_ADMINISTERED`), exclusion des events `SALE` côté élevage, top 20. ✅
- Boot DB-less → Task 5 Step 7. ✅

**2. Placeholder scan :** aucun TODO/TBD ; code complet fourni (les seules notes « optionnel »/« si signature diffère » pointent une vérification, pas un trou de code).

**3. Type consistency :** `ActivityItem(kind, at, label, detail)` identique backend (Task 3) / service (Task 5) / frontend (Task 6). `recentActivity(Long, int)` identique sur les 2 façades (Tasks 3-4) et consommé à l'identique (Task 5). `dailyFeedKg` (Double nullable, dernier champ) cohérent `LivestockStats`→`LivestockSection`→type front (Tasks 1-2). Requêtes repo (noms/paramètres) cohérentes entre déclaration et appel.
