package com.avicare.livestock.layer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.common.security.principal.UserRole;
import com.avicare.identity.domain.User;
import com.avicare.livestock.domain.DailyEggProduction;
import com.avicare.livestock.domain.LifecycleEvent;
import com.avicare.livestock.domain.Species;
import com.avicare.livestock.poultry.PoultryBatchCreate;
import com.avicare.livestock.poultry.PoultryBatchService;
import com.avicare.livestock.repository.BreedRepository;
import com.avicare.livestock.repository.EggTrayStockRepository;
import com.avicare.livestock.repository.LifecycleEventRepository;
import com.avicare.tenancy.domain.Farm;
import jakarta.persistence.EntityManager;
import java.time.LocalDate;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Integration test for {@link EggProductionService#closeDay} on a real PostgreSQL (Testcontainers,
 * V1–V9): empty-day rejection, multi-timeslot aggregation, grade merge, rate calculations,
 * idempotent re-close and the lifecycle event. CI-only on dev machines where Docker is unavailable.
 */
@SpringBootTest
@Testcontainers
@Transactional
class EggProductionServiceIT {

  @Container
  static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

  @DynamicPropertySource
  static void props(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    registry.add("spring.datasource.username", POSTGRES::getUsername);
    registry.add("spring.datasource.password", POSTGRES::getPassword);
    registry.add("spring.flyway.enabled", () -> "true");
    registry.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
  }

  private static final LocalDate DAY = LocalDate.of(2026, 6, 7);

  @Autowired private EggProductionService eggProductionService;
  @Autowired private EggCollectionService eggCollectionService;
  @Autowired private LifecycleEventRepository lifecycleEventRepository;
  @Autowired private EggTrayStockRepository eggTrayStockRepository;
  @Autowired private PoultryBatchService poultryBatchService;
  @Autowired private BreedRepository breedRepository;
  @Autowired private EntityManager em;

  private long userId;
  private long farmId;

  private long createLayerUnit(int count) {
    User u = new User();
    u.setEmail("ep" + System.nanoTime() + "@example.com");
    u.setPasswordHash("$2a$12$abcdefghijklmnopqrstuv");
    u.setFullName("EP");
    u.setRole(UserRole.USER);
    em.persist(u);
    userId = u.getId();
    Farm f = new Farm();
    f.setName("Ferme EP");
    f.setCreatedBy(u.getId());
    em.persist(f);
    em.flush();
    farmId = f.getId();

    long breedId =
        breedRepository
            .findBySpeciesAndCodeAndFarmId(Species.POULTRY, "isa_brown", null)
            .orElseThrow()
            .getId();
    long id =
        poultryBatchService
            .create(
                new PoultryBatchCreate(f.getId(), breedId, "Pondeuses", DAY, null, null, count),
                userId)
            .getId();
    em.flush();
    return id;
  }

  private void collect(long unitId, String slot, int total, int broken, Map<String, Integer> g) {
    eggCollectionService.record(
        unitId, new EggCollectionCommand(DAY, slot, total, broken, g, null, null), userId);
  }

  @Test
  void closeDay_rejectsWhenNoCollections() {
    long unitId = createLayerUnit(1000);

    assertThatThrownBy(() -> eggProductionService.closeDay(unitId, DAY, userId))
        .isInstanceOf(BusinessRuleException.class)
        .hasMessageContaining(DAY.toString());
  }

  @Test
  void closeDay_aggregatesAcrossTimeslots() {
    long unitId = createLayerUnit(1000);
    collect(unitId, "morning", 400, 5, Map.of("M", 400));
    collect(unitId, "noon", 250, 3, Map.of("M", 250));
    collect(unitId, "evening", 150, 2, Map.of("M", 150));

    DailyEggProduction p = eggProductionService.closeDay(unitId, DAY, userId);

    assertThat(p.getTotalEggsCollected()).isEqualTo(800);
    assertThat(p.getTotalBrokenEggs()).isEqualTo(10);
    assertThat(p.getActiveLayersCount()).isEqualTo(1000);
  }

  @Test
  void closeDay_mergesGradesAcrossTimeslots() {
    long unitId = createLayerUnit(1000);
    collect(unitId, "morning", 150, 0, Map.of("S", 50, "M", 100));
    collect(unitId, "noon", 110, 0, Map.of("S", 30, "L", 80));

    DailyEggProduction p = eggProductionService.closeDay(unitId, DAY, userId);

    assertThat(p.getGradesAggregate())
        .containsEntry("S", 80)
        .containsEntry("M", 100)
        .containsEntry("L", 80);
  }

  @Test
  void closeDay_computesLayingRate() {
    long unitId = createLayerUnit(1000);
    collect(unitId, "morning", 800, 0, Map.of());

    DailyEggProduction p = eggProductionService.closeDay(unitId, DAY, userId);

    // 800 / 1000 * 100 = 80.00
    assertThat(p.getLayingRatePct()).isEqualByComparingTo("80.00");
  }

  @Test
  void closeDay_computesBreakRate_andZeroWhenNothingProduced() {
    long unitId = createLayerUnit(1000);
    collect(unitId, "morning", 800, 200, Map.of());

    DailyEggProduction p = eggProductionService.closeDay(unitId, DAY, userId);
    // 200 / (800 + 200) * 100 = 20.00
    assertThat(p.getBreakRatePct()).isEqualByComparingTo("20.00");

    long emptyUnit = createLayerUnit(500);
    collect(emptyUnit, "morning", 0, 0, Map.of());
    DailyEggProduction empty = eggProductionService.closeDay(emptyUnit, DAY, userId);
    assertThat(empty.getBreakRatePct()).isEqualByComparingTo("0.00");
  }

  @Test
  void closeDay_isIdempotentAndRecomputes() {
    long unitId = createLayerUnit(1000);
    collect(unitId, "morning", 400, 5, Map.of("M", 400));

    DailyEggProduction first = eggProductionService.closeDay(unitId, DAY, userId);
    assertThat(first.getTotalEggsCollected()).isEqualTo(400);

    // A late collection is added, then the day is re-closed: recompute, still one row.
    collect(unitId, "evening", 300, 2, Map.of("M", 300));
    DailyEggProduction second = eggProductionService.closeDay(unitId, DAY, userId);

    assertThat(second.getId()).isEqualTo(first.getId());
    assertThat(second.getTotalEggsCollected()).isEqualTo(700);
    assertThat(second.getTotalBrokenEggs()).isEqualTo(7);
    assertThat(eggProductionService.listForUnit(unitId, DAY, DAY)).hasSize(1);
  }

  @Test
  void closeDay_journalsLifecycleEvent() {
    long unitId = createLayerUnit(1000);
    collect(unitId, "morning", 400, 5, Map.of());

    eggProductionService.closeDay(unitId, DAY, userId);

    assertThat(lifecycleEventRepository.findByProductionUnitId(unitId))
        .extracting(LifecycleEvent::getEventType)
        .contains(EggProductionService.EVENT_DAILY_PRODUCTION_CLOSED);
  }

  /**
   * P1.3 — closing a day with collected=95, broken=5 (90 good eggs) on a farm that starts at 0
   * trays must credit floor(90/30)=3 full trays. A re-close of the same day (idempotent path) must
   * NOT double-credit.
   */
  @Test
  void closeDay_creditsEggTrayStockOnFirstClose_andNotOnReclose() {
    long unitId = createLayerUnit(500);
    collect(unitId, "morning", 95, 5, Map.of());

    // farm starts with no tray-stock row (auto-created at 0 by adjustStock)
    eggProductionService.closeDay(unitId, DAY, userId);

    int fullTrays = eggTrayStockRepository.findByFarmId(farmId).orElseThrow().getFullTraysCount();
    assertThat(fullTrays).as("floor((95-5)/30) = 3 full trays credited").isEqualTo(3);

    // Re-close with an additional collection: must NOT credit again
    collect(unitId, "evening", 30, 0, Map.of());
    eggProductionService.closeDay(unitId, DAY, userId);

    int afterReclose =
        eggTrayStockRepository.findByFarmId(farmId).orElseThrow().getFullTraysCount();
    assertThat(afterReclose).as("re-close must not double-credit").isEqualTo(3);
  }
}
