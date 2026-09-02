package com.avicare.livestock.poultry;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

import com.avicare.livestock.domain.GrowthPerformance;
import com.avicare.livestock.domain.PoultryBatch;
import com.avicare.livestock.domain.WeighingSample;
import com.avicare.livestock.repository.DailyRecordRepository;
import com.avicare.livestock.repository.GrowthPerformanceRepository;
import com.avicare.livestock.repository.LifecycleEventRepository;
import com.avicare.livestock.repository.PoultryBatchRepository;
import com.avicare.livestock.repository.WeighingSampleRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.ObjectProvider;

/**
 * A sale decrements {@code current_count} exactly like a death does, so mortality and FCR must read
 * the MORTALITY event ledger rather than the gap between the initial and current headcount.
 */
class GrowthAnalysisMortalityTest {

  private WeighingSampleRepository weighingSampleRepository;
  private GrowthPerformanceRepository growthPerformanceRepository;
  private PoultryBatchRepository poultryBatchRepository;
  private DailyRecordRepository dailyRecordRepository;
  private LifecycleEventRepository lifecycleEventRepository;
  private GrowthAnalysisService service;

  @BeforeEach
  void setUp() {
    weighingSampleRepository = Mockito.mock(WeighingSampleRepository.class);
    growthPerformanceRepository = Mockito.mock(GrowthPerformanceRepository.class);
    poultryBatchRepository = Mockito.mock(PoultryBatchRepository.class);
    dailyRecordRepository = Mockito.mock(DailyRecordRepository.class);
    lifecycleEventRepository = Mockito.mock(LifecycleEventRepository.class);
    @SuppressWarnings("unchecked")
    ObjectProvider<GrowthAnalysisService> self = Mockito.mock(ObjectProvider.class);
    service =
        new GrowthAnalysisService(
            weighingSampleRepository,
            growthPerformanceRepository,
            poultryBatchRepository,
            dailyRecordRepository,
            lifecycleEventRepository,
            self);

    lenient()
        .when(growthPerformanceRepository.findByPoultryBatchIdAndSnapshotDate(anyLong(), any()))
        .thenReturn(Optional.empty());
    lenient()
        .when(growthPerformanceRepository.save(any(GrowthPerformance.class)))
        .thenAnswer(inv -> inv.getArgument(0));
    lenient()
        .when(weighingSampleRepository.findFirstByPoultryBatchIdOrderBySampleDateDesc(anyLong()))
        .thenReturn(Optional.empty());
    lenient()
        .when(dailyRecordRepository.sumFeedKgUpTo(anyLong(), any()))
        .thenReturn(BigDecimal.ZERO);
    lenient()
        .when(dailyRecordRepository.sumWaterLUpTo(anyLong(), any()))
        .thenReturn(BigDecimal.ZERO);
  }

  private void batch(int initialCount, int currentCount) {
    PoultryBatch b = new PoultryBatch();
    b.setId(1L);
    b.setInitialCount(initialCount);
    b.setCurrentCount(currentCount);
    b.setStartDate(LocalDate.now().minusDays(45));
    when(poultryBatchRepository.findById(1L)).thenReturn(Optional.of(b));
  }

  private static WeighingSample weighing(String avgWeightG) {
    WeighingSample s = new WeighingSample();
    s.setAvgWeightG(new BigDecimal(avgWeightG));
    return s;
  }

  @Test
  void mortality_countsOnlyMortalityEvents_notSales() {
    // 1000 placed, 20 died, 800 sold — 180 left on the farm.
    batch(1000, 180);
    when(lifecycleEventRepository.sumMortalityDelta(1L)).thenReturn(-20L);

    GrowthPerformance perf = service.computePerformance(1L, LocalDate.now());

    // Before the fix: (1000 - 180) / 1000 = 82.00 %.
    assertThat(perf.getCumulativeMortalityPercent()).isEqualByComparingTo("2.00");
  }

  @Test
  void mortality_isZero_whenNoMortalityEventRecorded() {
    batch(500, 500);
    when(lifecycleEventRepository.sumMortalityDelta(1L)).thenReturn(0L);

    GrowthPerformance perf = service.computePerformance(1L, LocalDate.now());

    assertThat(perf.getCumulativeMortalityPercent()).isEqualByComparingTo("0.00");
  }

  @Test
  void mortality_isNull_whenInitialCountIsZero() {
    batch(0, 0);
    lenient().when(lifecycleEventRepository.sumMortalityDelta(1L)).thenReturn(0L);

    GrowthPerformance perf = service.computePerformance(1L, LocalDate.now());

    assertThat(perf.getCumulativeMortalityPercent()).isNull();
  }

  @Test
  void fcr_usesLiveBirdsProduced_notRemainingHeadcount() {
    // 1000 placed, 20 died -> 980 birds produced, weighed at 2000 g, fed 3920 kg.
    // Expected FCR = 3920 / (980 x 2.0 kg) = 2.000.
    batch(1000, 180);
    when(lifecycleEventRepository.sumMortalityDelta(1L)).thenReturn(-20L);
    when(weighingSampleRepository.findFirstByPoultryBatchIdOrderBySampleDateDesc(1L))
        .thenReturn(Optional.of(weighing("2000")));
    when(dailyRecordRepository.sumFeedKgUpTo(anyLong(), any())).thenReturn(new BigDecimal("3920"));

    GrowthPerformance perf = service.computePerformance(1L, LocalDate.now());

    // Before the fix: 3920 / (180 x 2.0) = 10.889.
    assertThat(perf.getFeedConversionRatio()).isEqualByComparingTo("2.000");
  }
}
