package com.avicare.finance.dto.response;

import java.util.List;

/** Expense summary over a period: per-category totals plus the grand total. */
public record ExpenseSummaryResponse(List<CategoryTotal> categories, long totalXof) {

  /** One expense category's total for the period. */
  public record CategoryTotal(String categoryKey, long amountXof) {}
}
