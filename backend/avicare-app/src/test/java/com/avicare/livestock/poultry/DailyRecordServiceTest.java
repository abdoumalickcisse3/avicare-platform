package com.avicare.livestock.poultry;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.livestock.domain.ArticleSource;
import com.avicare.livestock.domain.DailyRecord;
import com.avicare.livestock.domain.FormulaIngredient;
import com.avicare.livestock.domain.ProductionUnit;
import com.avicare.livestock.inventory.ConsumptionSource;
import com.avicare.livestock.inventory.FeedFormulaService;
import com.avicare.livestock.inventory.StockConsumption;
import com.avicare.livestock.inventory.StockConsumptionService;
import com.avicare.livestock.repository.DailyRecordRepository;
import com.avicare.livestock.repository.LifecycleEventRepository;
import com.avicare.livestock.service.LivestockService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/** Unit test for the feed-formula decomposition in {@link DailyRecordService#record}. */
@ExtendWith(MockitoExtension.class)
class DailyRecordServiceTest {

  @Mock DailyRecordRepository dailyRecordRepository;
  @Mock LifecycleEventRepository lifecycleEventRepository;
  @Mock LivestockService livestockService;
  @Mock StockConsumptionService stockConsumptionService;
  @Mock FeedFormulaService feedFormulaService;

  DailyRecordService service;

  static final Long UNIT = 9L;
  static final Long FARM = 1L;
  static final Long USER = 42L;
  static final LocalDate DAY = LocalDate.of(2026, 7, 12);

  @BeforeEach
  void setUp() {
    service =
        new DailyRecordService(
            dailyRecordRepository,
            lifecycleEventRepository,
            livestockService,
            stockConsumptionService,
            feedFormulaService);

    ProductionUnit unit = new ProductionUnit();
    unit.setFarmId(FARM);
    unit.setCurrentCount(1000);
    // lenient: bothFeedSourcesRejected throws on the xor guard before these are ever consulted.
    org.mockito.Mockito.lenient().when(livestockService.getUnit(UNIT)).thenReturn(unit);
    org.mockito.Mockito.lenient()
        .when(dailyRecordRepository.findByProductionUnitIdAndRecordDate(UNIT, DAY))
        .thenReturn(Optional.empty());
    org.mockito.Mockito.lenient()
        .when(dailyRecordRepository.save(any(DailyRecord.class)))
        .thenAnswer(inv -> inv.getArgument(0));
  }

  private static FormulaIngredient ing(String key, int pct) {
    return new FormulaIngredient(key, ArticleSource.INVENTORY, new BigDecimal(pct));
  }

  private static DailyRecordCommand cmd(StockConsumption fc, FormulaConsumption ff) {
    return new DailyRecordCommand(DAY, 0, new BigDecimal("100"), BigDecimal.ZERO, null, fc, ff);
  }

  @Test
  void formulaDecomposesIntoOneMovementPerIngredient() {
    when(feedFormulaService.resolveIngredients(FARM, null, 5L))
        .thenReturn(List.of(ing("mais", 50), ing("soja", 30), ing("son", 20)));

    service.record(
        UNIT, cmd(null, new FormulaConsumption(null, 5L, new BigDecimal("100"), null)), USER);

    ArgumentCaptor<StockConsumption> cap = ArgumentCaptor.forClass(StockConsumption.class);
    verify(stockConsumptionService, times(3))
        .applyConsumption(eq(FARM), cap.capture(), any(ConsumptionSource.class), eq(USER));
    assertThat(cap.getAllValues())
        .extracting(StockConsumption::articleKey, c -> c.quantity().stripTrailingZeros())
        .containsExactly(
            org.assertj.core.groups.Tuple.tuple("mais", new BigDecimal("50").stripTrailingZeros()),
            org.assertj.core.groups.Tuple.tuple("soja", new BigDecimal("30").stripTrailingZeros()),
            org.assertj.core.groups.Tuple.tuple("son", new BigDecimal("20").stripTrailingZeros()));
  }

  @Test
  void zeroPercentIngredientIsSkipped() {
    when(feedFormulaService.resolveIngredients(FARM, null, 5L))
        .thenReturn(List.of(ing("mais", 100), ing("additif", 0)));

    service.record(
        UNIT, cmd(null, new FormulaConsumption(null, 5L, new BigDecimal("100"), null)), USER);

    verify(stockConsumptionService, times(1)).applyConsumption(eq(FARM), any(), any(), eq(USER));
  }

  @Test
  void bothFeedSourcesRejected() {
    StockConsumption fc =
        new StockConsumption("mais", ArticleSource.INVENTORY, BigDecimal.ONE, null);
    FormulaConsumption ff = new FormulaConsumption(null, 5L, new BigDecimal("100"), null);
    assertThatThrownBy(() -> service.record(UNIT, cmd(fc, ff), USER))
        .isInstanceOf(BusinessRuleException.class);
  }

  @Test
  void nonPositiveTotalKgRejected() {
    FormulaConsumption ff = new FormulaConsumption(null, 5L, BigDecimal.ZERO, null);
    assertThatThrownBy(() -> service.record(UNIT, cmd(null, ff), USER))
        .isInstanceOf(BusinessRuleException.class);
    verify(stockConsumptionService, never()).applyConsumption(anyLong(), any(), any(), anyLong());
  }

  @Test
  void singleArticleStillWorks() {
    StockConsumption fc =
        new StockConsumption("mais", ArticleSource.INVENTORY, BigDecimal.TEN, null);
    service.record(UNIT, cmd(fc, null), USER);
    verify(stockConsumptionService, times(1)).applyConsumption(eq(FARM), eq(fc), any(), eq(USER));
  }

  @Test
  void neitherFeedSourceMovesNoStock() {
    service.record(UNIT, cmd(null, null), USER);
    verify(stockConsumptionService, never()).applyConsumption(anyLong(), any(), any(), anyLong());
  }
}
