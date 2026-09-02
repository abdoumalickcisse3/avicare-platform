package com.avicare.livestock.closure;

import com.avicare.livestock.domain.StockMovement;
import com.avicare.livestock.repository.StockMovementRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Values what a production unit consumed, at closing time rather than at each outflow (design
 * decision D1). Feed leaves stock in kilos and never in XOF today — {@code StockConsumptionService}
 * passes no unit price — so this is the only way to reach a per-batch cost without touching the
 * daily write path that farmers use every day.
 *
 * <p>Also returns the valuation coverage: {@code typical_unit_price_xof} is nullable, so an article
 * with no price weighs zero in the total. A report that stayed silent about that would understate
 * the cost, and always in the same direction.
 */
@Service
@RequiredArgsConstructor
public class UnitCostService {

  private final StockMovementRepository stockMovementRepository;

  /**
   * @param costXof total valued, in whole XOF
   * @param consumedArticles distinct articles that left stock towards the unit
   * @param valuedArticles those a price could be found for
   */
  public record FeedCost(long costXof, int consumedArticles, int valuedArticles) {}

  @Transactional(readOnly = true)
  public FeedCost feedCost(Long productionUnitId) {
    List<StockMovement> movements =
        stockMovementRepository.findOutMovementsForUnit(productionUnitId);

    long total = 0;
    Set<Long> consumed = new HashSet<>();
    Set<Long> valued = new HashSet<>();

    for (StockMovement m : movements) {
      Long itemId = m.getStockItem().getId();
      consumed.add(itemId);

      Long value = valueOf(m);
      if (value != null) {
        total += value;
        valued.add(itemId);
      }
    }
    return new FeedCost(total, consumed.size(), valued.size());
  }

  /**
   * Value of one outflow: the one the movement carries when it has one — null on every consumption
   * today, but filled the day outflows get priced, which makes this calculation exact without a
   * rewrite — otherwise quantity times the article's price. Null when no price is known at all.
   */
  private static Long valueOf(StockMovement m) {
    if (m.getTotalValueXof() != null) {
      return m.getTotalValueXof();
    }
    Integer unitPrice = m.getStockItem().getTypicalUnitPriceXof();
    if (unitPrice == null) {
      return null;
    }
    return m.getQuantity()
        .multiply(BigDecimal.valueOf(unitPrice))
        .setScale(0, RoundingMode.HALF_UP)
        .longValue();
  }
}
