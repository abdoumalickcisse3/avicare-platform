package com.avicare.livestock.closure.dto;

import com.avicare.livestock.closure.UnitClosure;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * HTTP view of a frozen end-of-cycle report.
 *
 * <p>{@code valuationIncomplete} is derived, not stored: it is the one flag the interface must act
 * on. When some consumed article carried no price, the cost is understated — and always in the same
 * direction — so the reader has to be told rather than left with a flattering figure.
 */
public record UnitClosureResponse(
    Long productionUnitId,
    LocalDateTime closedAt,
    LocalDate startDate,
    LocalDate endDate,
    int durationDays,
    int initialCount,
    int remainingCount,
    int deaths,
    BigDecimal mortalityPercent,
    BigDecimal exitWeightG,
    BigDecimal avgDailyGainG,
    BigDecimal totalFeedKg,
    BigDecimal feedConversionRatio,
    long revenueXof,
    long feedCostXof,
    long chickCostXof,
    long otherExpenseXof,
    long totalCostXof,
    long marginXof,
    Integer costPerKgXof,
    int consumedArticles,
    int valuedArticles,
    boolean valuationIncomplete,
    String notes) {

  public static UnitClosureResponse from(UnitClosure c) {
    return new UnitClosureResponse(
        c.getProductionUnitId(),
        c.getClosedAt(),
        c.getStartDate(),
        c.getEndDate(),
        c.getDurationDays(),
        c.getInitialCount(),
        c.getRemainingCount(),
        c.getDeaths(),
        c.getMortalityPercent(),
        c.getExitWeightG(),
        c.getAvgDailyGainG(),
        c.getTotalFeedKg(),
        c.getFeedConversionRatio(),
        c.getRevenueXof(),
        c.getFeedCostXof(),
        c.getChickCostXof(),
        c.getOtherExpenseXof(),
        c.getTotalCostXof(),
        c.getMarginXof(),
        c.getCostPerKgXof(),
        c.getConsumedArticles(),
        c.getValuedArticles(),
        c.getValuedArticles() < c.getConsumedArticles(),
        c.getNotes());
  }
}
