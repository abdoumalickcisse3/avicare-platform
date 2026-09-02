package com.avicare.livestock.closure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.avicare.livestock.domain.MovementType;
import com.avicare.livestock.domain.StockItem;
import com.avicare.livestock.domain.StockMovement;
import com.avicare.livestock.repository.StockMovementRepository;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

/**
 * Valuing what a batch consumed, and telling the truth about what could not be valued. An article
 * with no price weighs zero in the total, and a report that hid that would always flatter.
 */
class UnitCostServiceTest {

  private StockMovementRepository stockMovementRepository;
  private UnitCostService service;

  @BeforeEach
  void setUp() {
    stockMovementRepository = Mockito.mock(StockMovementRepository.class);
    service = new UnitCostService(stockMovementRepository);
  }

  private static StockItem item(long id, Integer priceXof) {
    StockItem i = new StockItem();
    i.setId(id);
    i.setTypicalUnitPriceXof(priceXof);
    return i;
  }

  private static StockMovement out(StockItem item, String qty, Long totalValueXof) {
    StockMovement m = new StockMovement();
    m.setStockItem(item);
    m.setMovementType(MovementType.OUT);
    m.setQuantity(new BigDecimal(qty));
    m.setTotalValueXof(totalValueXof);
    return m;
  }

  @Test
  void valuesConsumption_atTheArticlePrice() {
    StockItem feed = item(1L, 400); // 400 XOF per kg
    when(stockMovementRepository.findOutMovementsForUnit(42L))
        .thenReturn(List.of(out(feed, "150", null), out(feed, "50", null)));

    UnitCostService.FeedCost cost = service.feedCost(42L);

    assertThat(cost.costXof()).isEqualTo(80_000L); // 200 kg x 400
    assertThat(cost.consumedArticles()).isEqualTo(1);
    assertThat(cost.valuedArticles()).isEqualTo(1);
  }

  @Test
  void articleWithoutPrice_countsAsUnvalued_andAddsNothing() {
    StockItem feed = item(1L, 400);
    StockItem maize = item(2L, null); // never priced
    when(stockMovementRepository.findOutMovementsForUnit(42L))
        .thenReturn(List.of(out(feed, "100", null), out(maize, "300", null)));

    UnitCostService.FeedCost cost = service.feedCost(42L);

    assertThat(cost.costXof()).isEqualTo(40_000L);
    assertThat(cost.consumedArticles()).isEqualTo(2);
    assertThat(cost.valuedArticles()).isEqualTo(1); // the report must say so
  }

  @Test
  void movementCarryingItsOwnValue_winsOverTheArticlePrice() {
    StockItem feed = item(1L, 400);
    when(stockMovementRepository.findOutMovementsForUnit(42L))
        .thenReturn(List.of(out(feed, "100", 35_000L))); // priced at 350 when it left

    UnitCostService.FeedCost cost = service.feedCost(42L);

    assertThat(cost.costXof()).isEqualTo(35_000L);
    assertThat(cost.valuedArticles()).isEqualTo(1);
  }

  @Test
  void noConsumption_yieldsZeroAndEmptyCoverage() {
    when(stockMovementRepository.findOutMovementsForUnit(42L)).thenReturn(List.of());

    UnitCostService.FeedCost cost = service.feedCost(42L);

    assertThat(cost.costXof()).isZero();
    assertThat(cost.consumedArticles()).isZero();
    assertThat(cost.valuedArticles()).isZero();
  }

  @Test
  void sameArticleValuedOnce_andUnvaluedOnce_countsAsValued() {
    StockItem feed = item(1L, null);
    when(stockMovementRepository.findOutMovementsForUnit(42L))
        .thenReturn(List.of(out(feed, "100", 20_000L), out(feed, "50", null)));

    UnitCostService.FeedCost cost = service.feedCost(42L);

    assertThat(cost.costXof()).isEqualTo(20_000L);
    assertThat(cost.consumedArticles()).isEqualTo(1);
    assertThat(cost.valuedArticles()).isEqualTo(1);
  }

  @Test
  void fractionalQuantity_isRoundedToWholeXof() {
    StockItem vitamin = item(1L, 1_250);
    when(stockMovementRepository.findOutMovementsForUnit(42L))
        .thenReturn(List.of(out(vitamin, "0.750", null)));

    UnitCostService.FeedCost cost = service.feedCost(42L);

    assertThat(cost.costXof()).isEqualTo(938L); // 937.5 rounded half-up
  }
}
