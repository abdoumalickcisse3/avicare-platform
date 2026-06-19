package com.avicare.livestock.layer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.avicare.common.api.exception.ValidationException;
import com.avicare.common.security.principal.UserRole;
import com.avicare.identity.domain.User;
import com.avicare.livestock.domain.EggCollection;
import com.avicare.livestock.domain.Species;
import com.avicare.livestock.poultry.PoultryBatchCreate;
import com.avicare.livestock.poultry.PoultryBatchService;
import com.avicare.livestock.repository.BreedRepository;
import com.avicare.livestock.repository.EggCollectionRepository;
import com.avicare.parameters.service.CatalogService;
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
 * Integration test for {@link EggCollectionService} on a real PostgreSQL (Testcontainers, V1–V8):
 * upsert, time-slot + grade validation against the farm's parametrized config, fallback defaults
 * and per-farm isolation. CI-only on dev machines where Docker is unavailable.
 */
@SpringBootTest
@Testcontainers
@Transactional
class EggCollectionServiceIT {

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

  @Autowired private EggCollectionService eggCollectionService;
  @Autowired private EggCollectionRepository eggCollectionRepository;
  @Autowired private PoultryBatchService poultryBatchService;
  @Autowired private BreedRepository breedRepository;
  @Autowired private CatalogService catalogService;
  @Autowired private EntityManager em;

  private long userId;

  private Farm createFarm() {
    User u = new User();
    u.setEmail("ec" + System.nanoTime() + "@example.com");
    u.setPasswordHash("$2a$12$abcdefghijklmnopqrstuv");
    u.setFullName("EC");
    u.setRole(UserRole.USER);
    em.persist(u);
    userId = u.getId();
    Farm f = new Farm();
    f.setName("Ferme EC");
    f.setCreatedBy(u.getId());
    em.persist(f);
    em.flush();
    return f;
  }

  private long createLayerUnit(Long farmId) {
    long breedId =
        breedRepository
            .findBySpeciesAndCodeAndFarmId(Species.POULTRY, "isa_brown", null)
            .orElseThrow()
            .getId();
    long id =
        poultryBatchService
            .create(
                new PoultryBatchCreate(farmId, breedId, "Pondeuses", DAY, null, null, 1000), userId)
            .getId();
    em.flush();
    return id;
  }

  private EggCollectionCommand cmd(String timeslot, int total, int broken, Map<String, Integer> g) {
    return new EggCollectionCommand(DAY, timeslot, total, broken, g, null, null);
  }

  @Test
  void record_persistsCollection() {
    long unitId = createLayerUnit(createFarm().getId());

    EggCollection saved =
        eggCollectionService.record(
            unitId, cmd("morning", 800, 12, Map.of("M", 500, "L", 300)), userId);

    assertThat(saved.getId()).isNotNull();
    assertThat(saved.getTotalEggs()).isEqualTo(800);
    assertThat(saved.getBrokenEggs()).isEqualTo(12);
    assertThat(saved.getGradesCount()).containsEntry("M", 500).containsEntry("L", 300);
  }

  @Test
  void record_upsertsOnSameUnitDateTimeslot() {
    long unitId = createLayerUnit(createFarm().getId());

    eggCollectionService.record(unitId, cmd("morning", 800, 10, Map.of("M", 800)), userId);
    eggCollectionService.record(unitId, cmd("morning", 850, 5, Map.of("M", 850)), userId);

    assertThat(
            eggCollectionRepository.findByProductionUnitIdOrderByCollectionDateDescTimeslotKeyAsc(
                unitId))
        .hasSize(1);
    EggCollection row =
        eggCollectionRepository
            .findByProductionUnitIdAndCollectionDateAndTimeslotKey(unitId, DAY, "morning")
            .orElseThrow();
    assertThat(row.getTotalEggs()).isEqualTo(850);
    assertThat(row.getBrokenEggs()).isEqualTo(5);
  }

  @Test
  void record_rejectsUnknownTimeslot() {
    long unitId = createLayerUnit(createFarm().getId());

    assertThatThrownBy(
            () -> eggCollectionService.record(unitId, cmd("midnight", 100, 0, Map.of()), userId))
        .isInstanceOf(ValidationException.class)
        .hasMessageContaining("midnight");
  }

  @Test
  void record_rejectsUnknownGrade() {
    long unitId = createLayerUnit(createFarm().getId());

    assertThatThrownBy(
            () ->
                eggCollectionService.record(
                    unitId, cmd("morning", 100, 0, Map.of("XXL", 50)), userId))
        .isInstanceOf(ValidationException.class)
        .hasMessageContaining("XXL");
  }

  @Test
  void record_usesDefaults_whenFarmHasNoCustomConfig() {
    // A brand-new farm with no farm_catalog_items still accepts the seeded
    // default time-slots and grades (S/M/L/XL).
    long unitId = createLayerUnit(createFarm().getId());

    EggCollection saved =
        eggCollectionService.record(unitId, cmd("evening", 200, 0, Map.of("S", 200)), userId);

    assertThat(saved.getTimeslotKey()).isEqualTo("evening");
  }

  @Test
  void record_acceptsBrokenGreaterThanTotal_andPartialGrades() {
    long unitId = createLayerUnit(createFarm().getId());

    // No ordering constraint between broken and total; grades may sum below total.
    EggCollection saved =
        eggCollectionService.record(unitId, cmd("noon", 100, 150, Map.of("M", 40)), userId);

    assertThat(saved.getTotalEggs()).isEqualTo(100);
    assertThat(saved.getBrokenEggs()).isEqualTo(150);
    assertThat(saved.getGradesCount()).containsEntry("M", 40);
  }

  @Test
  void sumTotalEggsBetween_aggregatesOverPeriod() {
    long unitId = createLayerUnit(createFarm().getId());

    eggCollectionService.record(unitId, cmd("morning", 800, 0, Map.of()), userId);
    eggCollectionService.record(unitId, cmd("evening", 200, 0, Map.of()), userId);
    eggCollectionService.record(
        unitId,
        new EggCollectionCommand(DAY.plusDays(1), "morning", 500, 0, Map.of(), null, null),
        userId);

    assertThat(eggCollectionRepository.sumTotalEggsBetween(unitId, DAY, DAY.plusDays(1)))
        .isEqualTo(1500L);
    assertThat(eggCollectionRepository.sumTotalEggsBetween(unitId, DAY, DAY)).isEqualTo(1000L);
  }

  @Test
  void timeslotConfig_isIsolatedPerFarm() {
    Farm farmA = createFarm();
    Farm farmB = createFarm();
    long unitA = createLayerUnit(farmA.getId());
    long unitB = createLayerUnit(farmB.getId());

    // Farm B customizes: hides "morning", adds a custom "dawn" slot.
    catalogService.disable(farmB.getId(), "egg_timeslots", "morning");
    catalogService.override(farmB.getId(), "egg_timeslots", "dawn", Map.of("label", "Aube"));
    em.flush();

    // Farm A still accepts the default "morning".
    assertThat(
            eggCollectionService
                .record(unitA, cmd("morning", 100, 0, Map.of()), userId)
                .getTimeslotKey())
        .isEqualTo("morning");

    // Farm B accepts its custom "dawn" but rejects the hidden "morning".
    assertThat(
            eggCollectionService
                .record(unitB, cmd("dawn", 100, 0, Map.of()), userId)
                .getTimeslotKey())
        .isEqualTo("dawn");
    assertThatThrownBy(
            () -> eggCollectionService.record(unitB, cmd("morning", 100, 0, Map.of()), userId))
        .isInstanceOf(ValidationException.class);
  }
}
