package com.avicare.livestock.closure.dto;

import com.avicare.livestock.closure.UnitClosure;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * One row of the closed-cycle comparison table: the columns a manager actually ranks on.
 *
 * <p>Deliberately not a score. Turning these into Or/Argent/Bronze would mean inventing thresholds,
 * and a threshold that contradicts what a farmer knows of his own trade destroys the credibility of
 * every other figure on the screen. The reader sorts and judges.
 *
 * <p>{@code valuationIncomplete} travels with each row because a batch whose feed could not be
 * fully priced has an understated cost — comparing it to a fully priced one without saying so would
 * rank it too favourably.
 */
public record ClosureSummaryResponse(
    Long productionUnitId,
    String unitName,
    LocalDate startDate,
    LocalDate endDate,
    int durationDays,
    int initialCount,
    int deaths,
    BigDecimal mortalityPercent,
    BigDecimal exitWeightG,
    BigDecimal feedConversionRatio,
    long revenueXof,
    long totalCostXof,
    long marginXof,
    Integer costPerKgXof,
    boolean valuationIncomplete) {

  public static ClosureSummaryResponse from(UnitClosure c, String unitName) {
    return new ClosureSummaryResponse(
        c.getProductionUnitId(),
        unitName,
        c.getStartDate(),
        c.getEndDate(),
        c.getDurationDays(),
        c.getInitialCount(),
        c.getDeaths(),
        c.getMortalityPercent(),
        c.getExitWeightG(),
        c.getFeedConversionRatio(),
        c.getRevenueXof(),
        c.getTotalCostXof(),
        c.getMarginXof(),
        c.getCostPerKgXof(),
        c.getValuedArticles() < c.getConsumedArticles());
  }
}
