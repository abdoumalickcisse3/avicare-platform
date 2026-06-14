package com.avicare.livestock.poultry;

import static org.assertj.core.api.Assertions.assertThat;

import com.avicare.common.security.principal.UserRole;
import com.avicare.identity.domain.User;
import com.avicare.livestock.domain.Species;
import com.avicare.livestock.repository.BreedRepository;
import com.avicare.livestock.repository.DailyRecordRepository;
import com.avicare.livestock.repository.ProductionUnitRepository;
import com.avicare.tenancy.domain.Farm;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.LocalDate;
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
 * Integration test for {@link DailyRecordService} mortality reconciliation (delta + clamp) on a
 * real PostgreSQL (Testcontainers, V1–V6). CI-only on dev machines where Docker is unavailable.
 */
@SpringBootTest
@Testcontainers
@Transactional
class DailyRecordServiceIT {

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

  @Autowired private DailyRecordService dailyRecordService;
  @Autowired private PoultryBatchService poultryBatchService;
  @Autowired private ProductionUnitRepository productionUnitRepository;
  @Autowired private DailyRecordRepository dailyRecordRepository;
  @Autowired private BreedRepository breedRepository;
  @Autowired private EntityManager em;

  private long createBatch(int count) {
    User u = new User();
    u.setEmail("dr" + System.nanoTime() + "@example.com");
    u.setPasswordHash("$2a$12$abcdefghijklmnopqrstuv");
    u.setFullName("DR");
    u.setRole(UserRole.USER);
    em.persist(u);
    Farm f = new Farm();
    f.setName("Ferme DR");
    f.setCreatedBy(u.getId());
    em.persist(f);
    em.flush();

    long breedId =
        breedRepository
            .findBySpeciesAndCodeAndFarmId(Species.POULTRY, "cobb_500", null)
            .orElseThrow()
            .getId();
    long id =
        poultryBatchService
            .create(
                new PoultryBatchCreate(f.getId(), breedId, "Lot", DAY, null, null, count),
                u.getId())
            .getId();
    em.flush();
    return id;
  }

  private int currentCount(long unitId) {
    em.flush();
    em.clear();
    return productionUnitRepository.findById(unitId).orElseThrow().getCurrentCount();
  }

  private DailyRecordCommand mortality(int count) {
    return new DailyRecordCommand(DAY, count, BigDecimal.ZERO, BigDecimal.ZERO, null, null);
  }

  @Test
  void normalMortality_decrementsCount() {
    long unitId = createBatch(500);

    dailyRecordService.record(unitId, mortality(10), 1L);

    assertThat(currentCount(unitId)).isEqualTo(490);
    assertThat(
            dailyRecordRepository
                .findByProductionUnitIdAndRecordDate(unitId, DAY)
                .orElseThrow()
                .getMortalityCount())
        .isEqualTo(10);
  }

  @Test
  void catastrophe_clampsCountToZero_butStoresRawMortality() {
    long unitId = createBatch(5);

    dailyRecordService.record(unitId, mortality(8), 1L);

    assertThat(currentCount(unitId)).isZero();
    assertThat(
            dailyRecordRepository
                .findByProductionUnitIdAndRecordDate(unitId, DAY)
                .orElseThrow()
                .getMortalityCount())
        .isEqualTo(8);
  }

  @Test
  void upsertSameDay_increasingMortality_appliesOnlyTheDelta() {
    long unitId = createBatch(500);

    dailyRecordService.record(unitId, mortality(5), 1L); // 500 -> 495
    dailyRecordService.record(unitId, mortality(8), 1L); // delta +3 -> 492

    assertThat(currentCount(unitId)).isEqualTo(492);
    assertThat(dailyRecordRepository.findByProductionUnitIdOrderByRecordDateDesc(unitId))
        .hasSize(1);
    assertThat(
            dailyRecordRepository
                .findByProductionUnitIdAndRecordDate(unitId, DAY)
                .orElseThrow()
                .getMortalityCount())
        .isEqualTo(8);
  }

  @Test
  void upsertSameDay_decreasingMortality_addsCountBack() {
    long unitId = createBatch(500);

    dailyRecordService.record(unitId, mortality(8), 1L); // 500 -> 492
    dailyRecordService.record(unitId, mortality(5), 1L); // delta -3 -> 495 (COUNT_ADJUSTMENT)

    assertThat(currentCount(unitId)).isEqualTo(495);
    assertThat(
            dailyRecordRepository
                .findByProductionUnitIdAndRecordDate(unitId, DAY)
                .orElseThrow()
                .getMortalityCount())
        .isEqualTo(5);
  }

  @Test
  void downwardCorrection_onZeroCount_appliesAdjustment() {
    long unitId = createBatch(5);

    dailyRecordService.record(unitId, mortality(8), 1L); // clamps 5 -> count 0
    assertThat(currentCount(unitId)).isZero();

    dailyRecordService.record(unitId, mortality(5), 1L); // delta -3 -> count 3

    assertThat(currentCount(unitId)).isEqualTo(3);
  }
}
