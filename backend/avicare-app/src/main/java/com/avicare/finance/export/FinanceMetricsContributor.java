package com.avicare.finance.export;

import com.avicare.admin.spi.PlatformMetricsContributor;
import com.avicare.finance.repository.ExpenseRepository;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** Bookkeeping volume. */
@Component
@RequiredArgsConstructor
public class FinanceMetricsContributor implements PlatformMetricsContributor {

  private final ExpenseRepository expenses;

  @Override
  public Map<String, Long> counters() {
    return Map.of("expenses", expenses.count());
  }
}
