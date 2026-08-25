package com.avicare.livestock.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.avicare.livestock.api.dto.BatchCycleInfo;
import com.avicare.livestock.domain.GrowthPerformance;
import com.avicare.livestock.domain.PoultryBatch;
import com.avicare.livestock.domain.Species;
import com.avicare.livestock.domain.UnitKind;
import com.avicare.livestock.domain.UnitStatus;
import com.avicare.livestock.repository.GrowthPerformanceRepository;
import com.avicare.livestock.repository.PoultryBatchRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

/**
 * Unit coverage of {@link LivestockFacadeImpl#activeBatchCycles}: which end date wins, and when a
 * batch is deliberately left out. The rest of the facade is exercised by the Testcontainers ITs.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class LivestockFacadeBatchCyclesTest {

  private static final Long FARM_ID = 8L;

  @Mock PoultryBatchRepository poultryBatchRepository;
  @Mock GrowthPerformanceRepository growthPerformanceRepository;

  @InjectMocks LivestockFacadeImpl facade;

  private PoultryBatch batch(Long id, LocalDate startDate, Integer targetAgeDays) {
    PoultryBatch b = new PoultryBatch();
    b.setId(id);
    b.setFarmId(FARM_ID);
    b.setSpecies(Species.POULTRY);
    b.setUnitKind(UnitKind.BATCH);
    b.setName("Bande " + id);
    b.setStartDate(startDate);
    b.setCurrentCount(480);
    b.setStatus(UnitStatus.ACTIVE);
    b.setTargetAgeDays(targetAgeDays);
    return b;
  }

  private void batches(PoultryBatch... all) {
    when(poultryBatchRepository.findByFarmIdAndStatus(FARM_ID, UnitStatus.ACTIVE))
        .thenReturn(List.of(all));
  }

  private void growthForecast(Long batchId, LocalDate forecast) {
    GrowthPerformance p = new GrowthPerformance();
    p.setForecastedTargetDate(forecast);
    when(growthPerformanceRepository.findFirstByPoultryBatchIdOrderBySnapshotDateDesc(batchId))
        .thenReturn(Optional.of(p));
  }

  @Test
  void prefersTheGrowthProjectionOverTheTheoreticalAge() {
    LocalDate start = LocalDate.now().minusDays(20);
    batches(batch(1L, start, 42));
    // The batch is growing faster than plan: the projection lands before start + 42 days.
    growthForecast(1L, start.plusDays(38));

    List<BatchCycleInfo> cycles = facade.activeBatchCycles(FARM_ID);

    assertThat(cycles).hasSize(1);
    assertThat(cycles.get(0).expectedEndDate()).isEqualTo(start.plusDays(38));
    assertThat(cycles.get(0).forecastMethod()).isEqualTo(BatchCycleInfo.METHOD_GROWTH);
    assertThat(cycles.get(0).headcount()).isEqualTo(480);
  }

  @Test
  void fallsBackToTheTargetAgeWhenNothingHasBeenWeighed() {
    LocalDate start = LocalDate.now().minusDays(10);
    batches(batch(2L, start, 42));
    when(growthPerformanceRepository.findFirstByPoultryBatchIdOrderBySnapshotDateDesc(2L))
        .thenReturn(Optional.empty());

    List<BatchCycleInfo> cycles = facade.activeBatchCycles(FARM_ID);

    assertThat(cycles.get(0).expectedEndDate()).isEqualTo(start.plusDays(42));
    assertThat(cycles.get(0).forecastMethod()).isEqualTo(BatchCycleInfo.METHOD_THEORETICAL);
  }

  @Test
  void fallsBackWhenTheSnapshotCarriesNoForecast() {
    LocalDate start = LocalDate.now().minusDays(5);
    batches(batch(3L, start, 40));
    // A snapshot exists but the forecast could not be computed (no target weight, or no gain yet).
    growthForecast(3L, null);

    List<BatchCycleInfo> cycles = facade.activeBatchCycles(FARM_ID);

    assertThat(cycles.get(0).expectedEndDate()).isEqualTo(start.plusDays(40));
    assertThat(cycles.get(0).forecastMethod()).isEqualTo(BatchCycleInfo.METHOD_THEORETICAL);
  }

  @Test
  void omitsABatchWhoseEndDateCannotBeEstablished() {
    batches(batch(4L, LocalDate.now().minusDays(3), null));
    when(growthPerformanceRepository.findFirstByPoultryBatchIdOrderBySnapshotDateDesc(4L))
        .thenReturn(Optional.empty());

    // An invented end date would put a partner in front of a delivery window that does not exist.
    assertThat(facade.activeBatchCycles(FARM_ID)).isEmpty();
  }

  @Test
  void readsOnlyActiveBatches() {
    when(poultryBatchRepository.findByFarmIdAndStatus(FARM_ID, UnitStatus.ACTIVE))
        .thenReturn(List.of());

    assertThat(facade.activeBatchCycles(FARM_ID)).isEmpty();
  }
}
