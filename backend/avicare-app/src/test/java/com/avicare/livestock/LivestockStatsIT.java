package com.avicare.livestock;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import com.avicare.common.security.principal.UserRole;
import com.avicare.identity.domain.User;
import com.avicare.livestock.domain.Breed;
import com.avicare.livestock.domain.DailyEggProduction;
import com.avicare.livestock.domain.DailyRecord;
import com.avicare.livestock.domain.LifecycleEvent;
import com.avicare.livestock.domain.PoultryBatch;
import com.avicare.livestock.domain.ProductionUnit;
import com.avicare.livestock.domain.Species;
import com.avicare.livestock.domain.TreatmentExecuted;
import com.avicare.livestock.domain.UnitKind;
import com.avicare.livestock.domain.UnitStatus;
import com.avicare.livestock.domain.Vaccination;
import com.avicare.livestock.domain.WeighingSample;
import com.avicare.livestock.repository.DailyEggProductionRepository;
import com.avicare.livestock.repository.DailyRecordRepository;
import com.avicare.livestock.repository.LifecycleEventRepository;
import com.avicare.livestock.repository.ProductionUnitRepository;
import com.avicare.livestock.repository.TreatmentExecutedRepository;
import com.avicare.livestock.repository.VaccinationRepository;
import com.avicare.livestock.repository.WeighingSampleRepository;
import com.avicare.tenancy.domain.Farm;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Verifies the dashboard aggregation queries for the livestock section on a real PostgreSQL
 * (Testcontainers, migrations V1–V25+). Inserts a minimal fixture:
 *
 * <ul>
 *   <li>2 ACTIVE units (1 PoultryBatch broiler + 1 ProductionUnit layer) with CREATED lifecycle
 *       events (initialCount 100 + 200 = 300);
 *   <li>3 DailyRecords on the broiler: 2 within the window (mortality 3 + 2 = 5), 1 outside (10) —
 *       ensures period-filter exclusion;
 *   <li>2 WeighingSamples (age 14 → 500 g, age 17 → 590 g) → GMQ = 30 g/day;
 *   <li>2 DailyEggProductions on the layer (laying_rate 90 % + 95 %) → avgLayingRate = 92.5 %;
 *   <li>1 Vaccination and 1 TreatmentExecuted within the window.
 * </ul>
 *
 * <p>CI-only — Testcontainers can't run on this dev machine (Docker 29.x incompatibility, see
 * project memory).
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers
class LivestockStatsIT {

  @Container
  static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

  @DynamicPropertySource
  static void datasource(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    registry.add("spring.datasource.username", POSTGRES::getUsername);
    registry.add("spring.datasource.password", POSTGRES::getPassword);
    registry.add("spring.flyway.enabled", () -> "true");
    registry.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
  }

  @Autowired ProductionUnitRepository productionUnitRepo;
  @Autowired LifecycleEventRepository lifecycleEventRepo;
  @Autowired DailyRecordRepository dailyRecordRepo;
  @Autowired WeighingSampleRepository weighingSampleRepo;
  @Autowired DailyEggProductionRepository dailyEggProductionRepo;
  @Autowired VaccinationRepository vaccinationRepo;
  @Autowired TreatmentExecutedRepository treatmentExecutedRepo;
  @Autowired EntityManager em;

  Long farmId;
  Long batchId; // PoultryBatch (broiler)
  Long layerId; // ProductionUnit (layer)

  // Window: [from, to] = [today-10, today]; day1/day2 inside; dayOutside before from.
  LocalDate from;
  LocalDate to;
  LocalDate day1;
  LocalDate day2;
  LocalDate dayOutside;

  @BeforeEach
  void setUp() {
    LocalDate today = LocalDate.now();
    from = today.minusDays(10);
    to = today;
    day1 = today.minusDays(5);
    day2 = today.minusDays(2);
    dayOutside = today.minusDays(20); // before 'from' — must be excluded by period queries

    // ── User (required by Farm.createdBy NOT NULL FK) ────────────────────────
    User user = new User();
    user.setEmail("livestock.stats." + System.nanoTime() + "@test.io");
    user.setPasswordHash("$2a$12$aaaabbbbccccddddeeeeffff");
    user.setFullName("Stats Test");
    user.setRole(UserRole.USER);
    em.persist(user);
    em.flush();
    Long userId = user.getId();

    // ── Farm ─────────────────────────────────────────────────────────────────
    Farm farm = new Farm();
    farm.setName("Livestock Stats Farm");
    farm.setCreatedBy(userId);
    em.persist(farm);
    em.flush();
    farmId = farm.getId();

    // ── Breed (POULTRY, farm-scoped to avoid collision with platform breeds) ─
    Breed breed = new Breed();
    breed.setSpecies(Species.POULTRY);
    breed.setCode("RD308-" + System.nanoTime());
    breed.setName("Ross 308 Test");
    breed.setFarmId(farmId);
    em.persist(breed);
    em.flush();

    // ── Unit 1: PoultryBatch (broiler) initialCount=100, currentCount=95 ─────
    PoultryBatch batch = new PoultryBatch();
    batch.setFarmId(farmId);
    batch.setSpecies(Species.POULTRY);
    batch.setUnitKind(UnitKind.BATCH);
    batch.setStartDate(today.minusDays(30));
    batch.setCurrentCount(95); // 100 placed, 5 deaths so far
    batch.setStatus(UnitStatus.ACTIVE);
    batch.setCreatedBy(userId);
    batch.setBreed(breed);
    batch.setInitialCount(100);
    em.persist(batch);
    em.flush();
    batchId = batch.getId();

    // ── Unit 2: ProductionUnit (layer, no sub-table) initialCount=200 ─────────
    ProductionUnit layer = new ProductionUnit();
    layer.setFarmId(farmId);
    layer.setSpecies(Species.POULTRY);
    layer.setUnitKind(UnitKind.BATCH);
    layer.setStartDate(today.minusDays(60));
    layer.setCurrentCount(200);
    layer.setStatus(UnitStatus.ACTIVE);
    layer.setCreatedBy(userId);
    em.persist(layer);
    em.flush();
    layerId = layer.getId();

    // ── CREATED lifecycle events (initialCount denominator) ─────────────────
    persistCreatedEvent(batchId, 100, userId);
    persistCreatedEvent(layerId, 200, userId);

    // ── DailyRecords on broiler unit ─────────────────────────────────────────
    // day1: 3 deaths (IN window)
    persistDailyRecord(batch, day1, 3, userId);
    // day2: 2 deaths (IN window)
    persistDailyRecord(batch, day2, 2, userId);
    // dayOutside: 10 deaths (OUT of window — must be excluded by period filter)
    persistDailyRecord(batch, dayOutside, 10, userId);

    // ── WeighingSamples on broiler unit ──────────────────────────────────────
    // age_days 14 → 500 g; age_days 17 → 590 g → GMQ = (590−500)/(17−14) = 30 g/day
    persistWeighingSample(batchId, day1, 14, new BigDecimal("500.000"), userId);
    persistWeighingSample(batchId, day2, 17, new BigDecimal("590.000"), userId);

    // ── DailyEggProductions on layer unit ───────────────────────────────────
    // day1: 180 eggs, laying_rate 90 %; day2: 190 eggs, laying_rate 95 %
    // → avgLayingRate = 92.5 %; layingSeries: [{day1,180},{day2,190}]
    persistDailyEggProduction(layer, day1, 180, new BigDecimal("90.00"), 200, userId);
    persistDailyEggProduction(layer, day2, 190, new BigDecimal("95.00"), 200, userId);

    // ── Health events (in-window) ────────────────────────────────────────────
    persistVaccination(batch, day1, "Newcastle", userId);
    persistTreatment(batch, day1, "Amoxicillin", userId);

    em.flush();
    em.clear(); // detach everything so queries hit the DB, not the first-level cache
  }

  // ── Snapshot KPI tests ───────────────────────────────────────────────────

  @Test
  void active_batches_counts_both_active_units() {
    long count = productionUnitRepo.countActiveByFarmId(farmId);
    assertThat(count).isEqualTo(2); // broiler + layer
  }

  @Test
  void total_headcount_sums_current_count_of_active_units() {
    Long total = productionUnitRepo.sumCurrentCountActiveByFarmId(farmId);
    assertThat(total).isEqualTo(295L); // 95 (batch) + 200 (layer)
  }

  @Test
  void total_headcount_is_null_when_no_active_units_for_farm() {
    Long total = productionUnitRepo.sumCurrentCountActiveByFarmId(999_999L);
    assertThat(total).isNull();
  }

  @Test
  void active_batches_is_zero_for_unknown_farm() {
    long count = productionUnitRepo.countActiveByFarmId(999_999L);
    assertThat(count).isZero();
  }

  // ── Period KPI — mortality ───────────────────────────────────────────────

  @Test
  void deaths_sum_only_includes_records_within_window() {
    Long deaths = dailyRecordRepo.sumMortalityByFarmAndPeriod(farmId, from, to);
    // day1(3) + day2(2) = 5; dayOutside(10) excluded
    assertThat(deaths).isEqualTo(5L);
  }

  @Test
  void deaths_is_null_when_no_records_in_window() {
    LocalDate future = LocalDate.now().plusDays(10);
    Long deaths = dailyRecordRepo.sumMortalityByFarmAndPeriod(farmId, future, future.plusDays(5));
    assertThat(deaths).isNull();
  }

  @Test
  void mortality_series_contains_only_in_window_days_ordered_asc() {
    List<Object[]> series = dailyRecordRepo.sumMortalityByDayForFarm(farmId, from, to);
    assertThat(series).hasSize(2);
    assertThat((LocalDate) series.get(0)[0]).isEqualTo(day1);
    assertThat(((Number) series.get(0)[1]).longValue()).isEqualTo(3L);
    assertThat((LocalDate) series.get(1)[0]).isEqualTo(day2);
    assertThat(((Number) series.get(1)[1]).longValue()).isEqualTo(2L);
  }

  @Test
  void period_filter_excludes_out_of_window_mortality_record() {
    // Without the BETWEEN filter, deaths would be 5 + 10 = 15 instead of 5.
    Long deaths = dailyRecordRepo.sumMortalityByFarmAndPeriod(farmId, from, to);
    assertThat(deaths)
        .as(
            "out-of-window daily record (10 deaths on dayOutside) must be excluded; "
                + "total must be 3 + 2 = 5, not 15")
        .isEqualTo(5L);

    List<Object[]> series = dailyRecordRepo.sumMortalityByDayForFarm(farmId, from, to);
    assertThat(series)
        .as("series must contain only the 2 in-window dates, not dayOutside")
        .hasSize(2);
  }

  @Test
  void initial_effectif_sums_created_event_deltas_for_farm() {
    long initial = lifecycleEventRepo.sumInitialCountByFarm(farmId);
    // broiler CREATED delta=100 + layer CREATED delta=200 = 300
    assertThat(initial).isEqualTo(300L);
  }

  @Test
  void initial_effectif_is_zero_for_unknown_farm() {
    long initial = lifecycleEventRepo.sumInitialCountByFarm(999_999L);
    assertThat(initial).isZero();
  }

  // ── Period KPI — GMQ (avgDailyGainG) ────────────────────────────────────

  @Test
  void avg_daily_gain_is_computed_from_two_weighing_samples_per_batch() {
    Double gmq = weighingSampleRepo.avgDailyGainGByFarmAndPeriod(farmId, from, to);
    // (590 − 500) / (17 − 14) = 90 / 3 = 30.0 g/day
    assertThat(gmq).isNotNull();
    assertThat(gmq).isCloseTo(30.0, within(0.01));
  }

  @Test
  void avg_daily_gain_is_null_when_fewer_than_two_samples_in_window() {
    // Query a future window where no weighing samples exist.
    LocalDate future = LocalDate.now().plusDays(10);
    Double gmq =
        weighingSampleRepo.avgDailyGainGByFarmAndPeriod(farmId, future, future.plusDays(5));
    assertThat(gmq).isNull();
  }

  @Test
  void avg_daily_gain_is_null_for_unknown_farm() {
    Double gmq = weighingSampleRepo.avgDailyGainGByFarmAndPeriod(999_999L, from, to);
    assertThat(gmq).isNull();
  }

  // ── Period KPI — laying rate & series ───────────────────────────────────

  @Test
  void avg_laying_rate_is_average_of_daily_egg_production_rates() {
    Double rate = dailyEggProductionRepo.avgLayingRateByFarmAndPeriod(farmId, from, to);
    // AVG(90.00, 95.00) = 92.5 %
    assertThat(rate).isNotNull();
    assertThat(rate).isCloseTo(92.5, within(0.01));
  }

  @Test
  void avg_laying_rate_is_null_when_no_egg_productions_in_window() {
    LocalDate future = LocalDate.now().plusDays(10);
    Double rate =
        dailyEggProductionRepo.avgLayingRateByFarmAndPeriod(farmId, future, future.plusDays(5));
    assertThat(rate).isNull();
  }

  @Test
  void avg_laying_rate_is_null_for_unknown_farm() {
    Double rate = dailyEggProductionRepo.avgLayingRateByFarmAndPeriod(999_999L, from, to);
    assertThat(rate).isNull();
  }

  @Test
  void laying_series_groups_eggs_by_day_ordered_asc() {
    List<Object[]> series = dailyEggProductionRepo.sumEggsByDayForFarm(farmId, from, to);
    assertThat(series).hasSize(2);
    assertThat((LocalDate) series.get(0)[0]).isEqualTo(day1);
    assertThat(((Number) series.get(0)[1]).longValue()).isEqualTo(180L);
    assertThat((LocalDate) series.get(1)[0]).isEqualTo(day2);
    assertThat(((Number) series.get(1)[1]).longValue()).isEqualTo(190L);
  }

  // ── Period KPI — health events ───────────────────────────────────────────

  @Test
  void vaccinations_count_equals_in_window_vaccinations() {
    long count = vaccinationRepo.countByFarmAndPeriod(farmId, from, to);
    assertThat(count).isEqualTo(1L);
  }

  @Test
  void vaccinations_count_is_zero_outside_window() {
    LocalDate future = LocalDate.now().plusDays(10);
    long count = vaccinationRepo.countByFarmAndPeriod(farmId, future, future.plusDays(5));
    assertThat(count).isZero();
  }

  @Test
  void treatments_count_equals_in_window_treatments() {
    long count = treatmentExecutedRepo.countByFarmAndPeriod(farmId, from, to);
    assertThat(count).isEqualTo(1L);
  }

  @Test
  void treatments_count_is_zero_outside_window() {
    LocalDate future = LocalDate.now().plusDays(10);
    long count = treatmentExecutedRepo.countByFarmAndPeriod(farmId, future, future.plusDays(5));
    assertThat(count).isZero();
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private void persistCreatedEvent(Long unitId, int delta, Long userId) {
    LifecycleEvent evt = new LifecycleEvent();
    evt.setProductionUnitId(unitId);
    evt.setEventType("CREATED");
    evt.setQuantityDelta(delta);
    evt.setReason("unit_created");
    evt.setDetails(Map.of("initial_count", delta));
    evt.setCreatedBy(userId);
    em.persist(evt);
  }

  private void persistDailyRecord(ProductionUnit unit, LocalDate date, int mortality, Long userId) {
    DailyRecord dr = new DailyRecord();
    dr.setProductionUnit(unit);
    dr.setRecordDate(date);
    dr.setMortalityCount(mortality);
    dr.setFeedKg(BigDecimal.ZERO);
    dr.setWaterL(BigDecimal.ZERO);
    dr.setCreatedBy(userId);
    em.persist(dr);
  }

  private void persistWeighingSample(
      Long batchId, LocalDate date, int ageDays, BigDecimal avgWeight, Long userId) {
    WeighingSample ws = new WeighingSample();
    ws.setPoultryBatchId(batchId);
    ws.setSampleDate(date);
    ws.setAgeDays(ageDays);
    ws.setSampleSize(30);
    ws.setIndividualWeights(
        List.of(avgWeight.intValue(), avgWeight.intValue(), avgWeight.intValue()));
    ws.setAvgWeightG(avgWeight);
    ws.setRecordedBy(userId);
    em.persist(ws);
  }

  private void persistDailyEggProduction(
      ProductionUnit unit,
      LocalDate date,
      int eggs,
      BigDecimal layingRatePct,
      int activeLayers,
      Long userId) {
    DailyEggProduction dep = new DailyEggProduction();
    dep.setProductionUnit(unit);
    dep.setProductionDate(date);
    dep.setTotalEggsCollected(eggs);
    dep.setTotalBrokenEggs(0);
    dep.setGradesAggregate(Map.of());
    dep.setLayingRatePct(layingRatePct);
    dep.setActiveLayersCount(activeLayers);
    dep.setClosedAt(date.atStartOfDay());
    dep.setClosedById(userId);
    em.persist(dep);
  }

  private void persistVaccination(ProductionUnit unit, LocalDate date, String key, Long userId) {
    Vaccination vacc = new Vaccination();
    vacc.setProductionUnit(unit);
    vacc.setVaccineKey(key);
    vacc.setAdministeredDate(date);
    vacc.setSubjectsCount(90);
    vacc.setCreatedBy(userId);
    em.persist(vacc);
  }

  private void persistTreatment(ProductionUnit unit, LocalDate startDate, String key, Long userId) {
    TreatmentExecuted treat = new TreatmentExecuted();
    treat.setProductionUnit(unit);
    treat.setTreatmentKey(key);
    treat.setStartDate(startDate);
    treat.setDurationDays(5);
    treat.setEndDate(startDate.plusDays(4));
    treat.setDoseAmount(new BigDecimal("0.5000"));
    treat.setDoseUnit("ml/kg");
    treat.setRoute("oral");
    treat.setSubjectsCount(90);
    treat.setCreatedBy(userId);
    em.persist(treat);
  }
}
