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
 * What the farmer actually reads: AHEAD / ON_TARGET / BEHIND. The straight-line target made this
 * verdict wrong for the whole first fortnight of every batch, which is when a wrong verdict costs
 * the most — a farmer who is told his chicks are behind feeds or medicates them.
 */
class GrowthAnalysisTargetScoreTest {

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
    lenient().when(lifecycleEventRepository.sumMortalityDelta(anyLong())).thenReturn(0L);
    lenient()
        .when(dailyRecordRepository.sumFeedKgUpTo(anyLong(), any()))
        .thenReturn(BigDecimal.ZERO);
    lenient()
        .when(dailyRecordRepository.sumWaterLUpTo(anyLong(), any()))
        .thenReturn(BigDecimal.ZERO);
  }

  /** A batch aiming at 2 kg on day 42, weighed today at {@code avgWeightG}, {@code ageDays} old. */
  private void batchWeighed(int ageDays, String avgWeightG) {
    PoultryBatch b = new PoultryBatch();
    b.setId(1L);
    b.setInitialCount(500);
    b.setCurrentCount(500);
    b.setStartDate(LocalDate.now().minusDays(ageDays));
    b.setTargetWeightG(2000);
    b.setTargetAgeDays(42);
    when(poultryBatchRepository.findById(1L)).thenReturn(Optional.of(b));

    WeighingSample s = new WeighingSample();
    s.setAvgWeightG(new BigDecimal(avgWeightG));
    when(weighingSampleRepository.findFirstByPoultryBatchIdOrderBySampleDateDesc(1L))
        .thenReturn(Optional.of(s));
  }

  @Test
  void aHealthyChickAtOneWeekIsOnTarget_notBehind() {
    // 150 g at seven days is a normal chick. The straight line asked 366 g and called it BEHIND.
    batchWeighed(7, "150");

    GrowthPerformance perf = service.computePerformance(1L, LocalDate.now());

    assertThat(perf.getPerformanceScore()).isEqualTo(GrowthAnalysisService.SCORE_ON_TARGET);
  }

  @Test
  void aGenuinelyStuntedChickIsStillFlagged() {
    // Half the expected 148 g. The curve must not have become permissive, only correct.
    batchWeighed(7, "75");

    GrowthPerformance perf = service.computePerformance(1L, LocalDate.now());

    assertThat(perf.getPerformanceScore()).isEqualTo(GrowthAnalysisService.SCORE_BEHIND);
  }

  @Test
  void aFastChickAtOneWeekIsAhead() {
    batchWeighed(7, "200");

    GrowthPerformance perf = service.computePerformance(1L, LocalDate.now());

    assertThat(perf.getPerformanceScore()).isEqualTo(GrowthAnalysisService.SCORE_AHEAD);
  }

  @Test
  void midCycleReadsAgainstAThirdOfTheGain() {
    // Day 21 expects ~677 g, not the 1020 g of the line: a 700 g batch is on target.
    batchWeighed(21, "700");

    GrowthPerformance perf = service.computePerformance(1L, LocalDate.now());

    assertThat(perf.getPerformanceScore()).isEqualTo(GrowthAnalysisService.SCORE_ON_TARGET);
  }

  @Test
  void theVerdictOnTheTargetDayIsUnchanged() {
    // The line and the curve meet at both ends; a batch at its target on day 42 was and stays
    // ON_TARGET. This is the guard against having moved the finish line.
    batchWeighed(42, "2000");

    GrowthPerformance perf = service.computePerformance(1L, LocalDate.now());

    assertThat(perf.getPerformanceScore()).isEqualTo(GrowthAnalysisService.SCORE_ON_TARGET);
  }

  @Test
  void noScoreWithoutATarget() {
    PoultryBatch b = new PoultryBatch();
    b.setId(1L);
    b.setInitialCount(500);
    b.setCurrentCount(500);
    b.setStartDate(LocalDate.now().minusDays(20));
    when(poultryBatchRepository.findById(1L)).thenReturn(Optional.of(b));
    WeighingSample s = new WeighingSample();
    s.setAvgWeightG(new BigDecimal("800"));
    when(weighingSampleRepository.findFirstByPoultryBatchIdOrderBySampleDateDesc(1L))
        .thenReturn(Optional.of(s));

    GrowthPerformance perf = service.computePerformance(1L, LocalDate.now());

    assertThat(perf.getPerformanceScore()).isNull();
  }
}
