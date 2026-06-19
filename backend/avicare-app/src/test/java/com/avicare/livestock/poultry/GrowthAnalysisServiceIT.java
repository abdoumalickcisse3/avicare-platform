package com.avicare.livestock.poultry;

import static org.assertj.core.api.Assertions.assertThat;

import com.avicare.common.security.principal.UserRole;
import com.avicare.identity.domain.User;
import com.avicare.livestock.domain.GrowthPerformance;
import com.avicare.livestock.domain.Species;
import com.avicare.livestock.domain.WeighingSample;
import com.avicare.livestock.repository.BreedRepository;
import com.avicare.tenancy.domain.Farm;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
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
 * Integration test for {@link GrowthAnalysisService} on a real PostgreSQL (Testcontainers, V1–V7).
 * CI-only on dev machines where Docker is unavailable.
 */
@SpringBootTest
@Testcontainers
@Transactional
class GrowthAnalysisServiceIT {

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
  private static final LocalDate START = DAY.minusDays(35); // age 35 on DAY

  @Autowired private GrowthAnalysisService growthAnalysisService;
  @Autowired private PoultryBatchService poultryBatchService;
  @Autowired private DailyRecordService dailyRecordService;
  @Autowired private BreedRepository breedRepository;
  @Autowired private EntityManager em;

  private long userId;

  private long createBatch(int initialCount, Integer targetWeightG, Integer targetAgeDays) {
    User u = new User();
    u.setEmail("ga" + System.nanoTime() + "@example.com");
    u.setPasswordHash("$2a$12$abcdefghijklmnopqrstuv");
    u.setFullName("GA");
    u.setRole(UserRole.USER);
    em.persist(u);
    userId = u.getId();
    Farm f = new Farm();
    f.setName("Ferme GA");
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
                new PoultryBatchCreate(
                    f.getId(), breedId, "Lot", START, targetWeightG, targetAgeDays, initialCount),
                u.getId())
            .getId();
    em.flush();
    return id;
  }

  @Test
  void recordWeighing_computesSampleStats_andSnapshot() {
    long batchId = createBatch(1000, 2200, 42);

    WeighingSample sample =
        growthAnalysisService.recordWeighing(
            batchId, new WeighingCommand(DAY, List.of(1800, 1900, 2000, 2100, 2200), null), userId);

    assertThat(sample.getSampleSize()).isEqualTo(5);
    assertThat(sample.getAgeDays()).isEqualTo(35);
    assertThat(sample.getAvgWeightG()).isEqualByComparingTo("2000.000");
    assertThat(sample.getMinWeightG()).isEqualByComparingTo("1800.000");
    assertThat(sample.getMaxWeightG()).isEqualByComparingTo("2200.000");
    assertThat(sample.getStdDeviation()).isEqualByComparingTo("141.421");
    assertThat(sample.getUniformityPercent()).isEqualByComparingTo("100.00");

    GrowthPerformance perf = growthAnalysisService.getLatestPerformance(batchId);
    assertThat(perf.getAgeDays()).isEqualTo(35);
    assertThat(perf.getCurrentWeightG()).isEqualByComparingTo("2000.000");
    assertThat(perf.getGmqGPerDay()).isEqualByComparingTo("57.143"); // 2000 / 35
    // target curve at age 35 ≈ 1840 g, current 2000 → AHEAD; forecast = DAY +
    // ceil((2200-2000)/57.143)
    assertThat(perf.getPerformanceScore()).isEqualTo(GrowthAnalysisService.SCORE_AHEAD);
    assertThat(perf.getForecastedTargetDate()).isEqualTo(DAY.plusDays(4));
    assertThat(perf.getCumulativeMortalityPercent()).isEqualByComparingTo("0.00");
  }

  @Test
  void fcr_isComputedFromCumulativeDailyFeed() {
    long batchId = createBatch(1000, 2200, 42);
    // 3000 kg feed up to DAY; live weight = 2.0 kg * 1000 = 2000 kg → FCR = 1.5
    dailyRecordService.record(
        batchId,
        new DailyRecordCommand(DAY, 0, new BigDecimal("3000"), BigDecimal.ZERO, null, null),
        userId);

    growthAnalysisService.recordWeighing(
        batchId, new WeighingCommand(DAY, List.of(2000, 2000, 2000), null), userId);

    GrowthPerformance perf = growthAnalysisService.getLatestPerformance(batchId);
    assertThat(perf.getCumulativeFeedKg()).isEqualByComparingTo("3000.000");
    assertThat(perf.getFeedConversionRatio()).isEqualByComparingTo("1.500");
  }

  @Test
  void score_isBehind_whenUnderTargetCurve() {
    long batchId = createBatch(1000, 2200, 42);

    growthAnalysisService.recordWeighing(
        batchId, new WeighingCommand(DAY, List.of(1400, 1500, 1600), null), userId);

    GrowthPerformance perf = growthAnalysisService.getLatestPerformance(batchId);
    // avg 1500 vs target ≈ 1840 at age 35 → ratio 0.82 → BEHIND
    assertThat(perf.getPerformanceScore()).isEqualTo(GrowthAnalysisService.SCORE_BEHIND);
  }

  @Test
  void listWeighings_returnsSamplesNewestFirst() {
    long batchId = createBatch(1000, 2200, 42);
    growthAnalysisService.recordWeighing(
        batchId, new WeighingCommand(START.plusDays(21), List.of(1000, 1100), null), userId);
    growthAnalysisService.recordWeighing(
        batchId, new WeighingCommand(DAY, List.of(2000, 2100), null), userId);

    List<WeighingSample> samples = growthAnalysisService.listWeighings(batchId);
    assertThat(samples).hasSize(2);
    assertThat(samples.get(0).getSampleDate()).isEqualTo(DAY);
  }
}
