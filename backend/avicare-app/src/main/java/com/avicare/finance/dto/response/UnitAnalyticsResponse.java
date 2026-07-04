package com.avicare.finance.dto.response;

import java.util.List;

/**
 * Per-unit financial analytics (Sprint B6 P1, task B4): costs by category, revenue, and margin for
 * a single production unit (lot). {@code costPerHeadXof} is {@code null} when the unit's initial
 * headcount is unknown/zero.
 */
public record UnitAnalyticsResponse(
    Long unitId,
    List<CategoryCost> costs,
    long totalCostXof,
    Long costPerHeadXof,
    long revenueXof,
    long marginXof) {

  /** One expense category's total for the unit, with its human-readable catalog label. */
  public record CategoryCost(String categoryKey, String label, long amountXof) {}
}
