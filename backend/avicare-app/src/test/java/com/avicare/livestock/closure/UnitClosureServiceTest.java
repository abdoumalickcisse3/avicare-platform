package com.avicare.livestock.closure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.common.api.exception.ConflictException;
import com.avicare.common.api.exception.NotFoundException;
import com.avicare.finance.api.FinanceFacade;
import com.avicare.livestock.commercial.CommercialFacade;
import com.avicare.livestock.domain.GrowthPerformance;
import com.avicare.livestock.domain.PoultryBatch;
import com.avicare.livestock.poultry.GrowthAnalysisService;
import com.avicare.livestock.repository.LifecycleEventRepository;
import com.avicare.livestock.service.LivestockService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

/**
 * The report gathers four sources and freezes. This locks the arithmetic and the two lifecycle
 * rules: a unit is not closed twice, and reopening erases.
 *
 * <p>Reference batch: 1000 placed, 20 died, 180 still on hand, weighed at 2000 g.
 */
class UnitClosureServiceTest {

  private UnitClosureRepository unitClosureRepository;
  private UnitCostService unitCostService;
  private LifecycleEventRepository lifecycleEventRepository;
  private GrowthAnalysisService growthAnalysisService;
  private LivestockService livestockService;
  private CommercialFacade commercialFacade;
  private FinanceFacade financeFacade;
  private UnitClosureService service;

  @BeforeEach
  void setUp() {
    unitClosureRepository = Mockito.mock(UnitClosureRepository.class);
    unitCostService = Mockito.mock(UnitCostService.class);
    lifecycleEventRepository = Mockito.mock(LifecycleEventRepository.class);
    growthAnalysisService = Mockito.mock(GrowthAnalysisService.class);
    livestockService = Mockito.mock(LivestockService.class);
    commercialFacade = Mockito.mock(CommercialFacade.class);
    financeFacade = Mockito.mock(FinanceFacade.class);
    service =
        new UnitClosureService(
            unitClosureRepository,
            unitCostService,
            lifecycleEventRepository,
            growthAnalysisService,
            livestockService,
            commercialFacade,
            financeFacade);

    PoultryBatch unit = new PoultryBatch();
    unit.setId(42L);
    unit.setFarmId(7L);
    unit.setCurrentCount(180);
    unit.setStartDate(LocalDate.now().minusDays(45));
    lenient().when(livestockService.getUnit(42L)).thenReturn(unit);

    lenient().when(unitClosureRepository.findByProductionUnitId(42L)).thenReturn(Optional.empty());
    lenient()
        .when(unitClosureRepository.save(any(UnitClosure.class)))
        .thenAnswer(inv -> inv.getArgument(0));
    lenient().when(lifecycleEventRepository.sumInitialCountByUnit(42L)).thenReturn(1000L);
    lenient().when(lifecycleEventRepository.sumMortalityDelta(42L)).thenReturn(-20L);
    lenient().when(commercialFacade.revenueByProductionUnit(7L, 42L)).thenReturn(1_800_000L);
    lenient()
        .when(unitCostService.feedCost(42L))
        .thenReturn(new UnitCostService.FeedCost(900_000L, 1, 1));
    lenient().when(financeFacade.directExpensesForUnit(7L, 42L)).thenReturn(90_000L);
    lenient()
        .when(growthAnalysisService.computePerformance(anyLong(), any()))
        .thenReturn(performance("2000", "44.44", "2250", "1.148"));
  }

  private static GrowthPerformance performance(
      String weightG, String gmq, String feedKg, String fcr) {
    GrowthPerformance p = new GrowthPerformance();
    p.setCurrentWeightG(new BigDecimal(weightG));
    p.setGmqGPerDay(new BigDecimal(gmq));
    p.setCumulativeFeedKg(new BigDecimal(feedKg));
    p.setFeedConversionRatio(new BigDecimal(fcr));
    return p;
  }

  @Test
  void close_freezesRevenueMinusCosts() {
    // 1 800 000 in, 900 000 feed + 250 000 chicks + 90 000 other = 1 240 000 out.
    // 980 birds produced at 2000 g = 1960 kg -> 1 240 000 / 1960 = 633 XOF per kg.
    UnitClosure closure = service.close(7L, 42L, 250_000L, null, 3L);

    assertThat(closure.getRevenueXof()).isEqualTo(1_800_000L);
    assertThat(closure.getTotalCostXof()).isEqualTo(1_240_000L);
    assertThat(closure.getMarginXof()).isEqualTo(560_000L);
    assertThat(closure.getDeaths()).isEqualTo(20);
    assertThat(closure.getInitialCount()).isEqualTo(1000);
    assertThat(closure.getRemainingCount()).isEqualTo(180);
    assertThat(closure.getMortalityPercent()).isEqualByComparingTo("2.00");
    assertThat(closure.getCostPerKgXof()).isEqualTo(633);
  }

  @Test
  void close_carriesTheTechnicalSnapshot() {
    UnitClosure closure = service.close(7L, 42L, null, null, 3L);

    assertThat(closure.getExitWeightG()).isEqualByComparingTo("2000");
    assertThat(closure.getAvgDailyGainG()).isEqualByComparingTo("44.44");
    assertThat(closure.getTotalFeedKg()).isEqualByComparingTo("2250");
    assertThat(closure.getFeedConversionRatio()).isEqualByComparingTo("1.148");
    assertThat(closure.getDurationDays()).isEqualTo(45);
  }

  @Test
  void close_marksTheUnitClosed() {
    service.close(7L, 42L, null, null, 3L);

    verify(livestockService).closeUnit(42L);
  }

  @Test
  void close_rejectsAnAlreadyClosedUnit() {
    when(unitClosureRepository.findByProductionUnitId(42L))
        .thenReturn(Optional.of(new UnitClosure()));

    assertThatThrownBy(() -> service.close(7L, 42L, null, null, 3L))
        .isInstanceOf(ConflictException.class);
    verify(unitClosureRepository, never()).save(any());
  }

  @Test
  void close_refusesAUnitOfAnotherFarm() {
    assertThatThrownBy(() -> service.close(999L, 42L, null, null, 3L))
        .isInstanceOf(NotFoundException.class);
    verify(unitClosureRepository, never()).save(any());
  }

  @Test
  void close_withoutChickCost_countsItAsZero() {
    UnitClosure closure = service.close(7L, 42L, null, null, 3L);

    assertThat(closure.getChickCostXof()).isZero();
    assertThat(closure.getTotalCostXof()).isEqualTo(990_000L);
  }

  @Test
  void close_leavesCostPerKgNull_whenNoWeighingEverRecorded() {
    when(growthAnalysisService.computePerformance(anyLong(), any()))
        .thenReturn(new GrowthPerformance());

    UnitClosure closure = service.close(7L, 42L, null, null, 3L);

    assertThat(closure.getCostPerKgXof()).isNull(); // null rather than wrong
    assertThat(closure.getTotalCostXof()).isEqualTo(990_000L);
  }

  @Test
  void close_recordsTheValuationCoverage() {
    when(unitCostService.feedCost(42L)).thenReturn(new UnitCostService.FeedCost(900_000L, 4, 3));

    UnitClosure closure = service.close(7L, 42L, null, null, 3L);

    assertThat(closure.getConsumedArticles()).isEqualTo(4);
    assertThat(closure.getValuedArticles()).isEqualTo(3);
  }

  @Test
  void get_throwsNotFound_whenTheUnitIsStillOpen() {
    when(unitClosureRepository.findByProductionUnitId(42L)).thenReturn(Optional.empty());

    assertThatThrownBy(() -> service.get(7L, 42L)).isInstanceOf(NotFoundException.class);
  }

  @Test
  void reopen_deletesTheFrozenReport() {
    UnitClosure existing = new UnitClosure();
    existing.setFarmId(7L);
    existing.setProductionUnitId(42L);
    when(unitClosureRepository.findByProductionUnitId(42L)).thenReturn(Optional.of(existing));

    service.reopen(7L, 42L);

    verify(unitClosureRepository).deleteByProductionUnitId(42L);
    verify(livestockService).reopenUnit(42L);
  }

  @Test
  void listForFarm_pairsEachClosureWithItsUnitName_mostRecentFirst() {
    PoultryBatch a = new PoultryBatch();
    a.setId(42L);
    a.setFarmId(7L);
    a.setName("Bande A");
    PoultryBatch b = new PoultryBatch();
    b.setId(43L);
    b.setFarmId(7L);
    b.setName(null); // unnamed batches still have to be readable in the table
    when(livestockService.listByFarm(7L)).thenReturn(java.util.List.of(a, b));

    UnitClosure ca = new UnitClosure();
    ca.setProductionUnitId(42L);
    ca.setConsumedArticles(2);
    ca.setValuedArticles(1);
    UnitClosure cb = new UnitClosure();
    cb.setProductionUnitId(43L);
    cb.setConsumedArticles(1);
    cb.setValuedArticles(1);
    when(unitClosureRepository.findByFarmIdOrderByEndDateDescIdDesc(7L))
        .thenReturn(java.util.List.of(ca, cb));

    var rows = service.listForFarm(7L);

    assertThat(rows).hasSize(2);
    assertThat(rows.get(0).unitName()).isEqualTo("Bande A");
    assertThat(rows.get(0).valuationIncomplete()).isTrue();
    assertThat(rows.get(1).unitName()).isEqualTo("Lot #43");
    assertThat(rows.get(1).valuationIncomplete()).isFalse();
  }
}
