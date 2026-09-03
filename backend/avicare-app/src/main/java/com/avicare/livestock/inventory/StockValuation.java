package com.avicare.livestock.inventory;

import com.avicare.livestock.domain.StockMovement;
import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * The single rule for putting a price on a stock outflow.
 *
 * <p>Consumption leaves stock in quantities and never in XOF — {@code StockConsumptionService}
 * records no unit price — so anything that needs the money value of what was consumed has to derive
 * it. Two places need it (the end-of-cycle report and the dashboard's stock block), and two copies
 * of a valuation rule would drift into two different answers to the same question.
 *
 * <p>{@code typical_unit_price_xof} is nullable, so this can legitimately return {@code null}.
 * Callers must count what they could not value and say so rather than reporting a flattering zero.
 */
public final class StockValuation {

  private StockValuation() {}

  /**
   * Value of one movement: the one it carries when it has one — null on every consumption today,
   * but filled the day outflows get priced, which makes every caller exact without a rewrite —
   * otherwise quantity times the article's typical price. {@code null} when no price is known.
   */
  public static Long valueOf(StockMovement m) {
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
