package com.avicare.finance.export;

import com.avicare.admin.spi.FarmDataExporter;
import com.avicare.finance.domain.Expense;
import com.avicare.finance.repository.ExpenseRepository;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** Expenses recorded against the farm. */
@Component
@RequiredArgsConstructor
public class FinanceFarmExporter implements FarmDataExporter {

  private final ExpenseRepository expenses;

  @Override
  public String section() {
    return "finance";
  }

  @Override
  public Map<String, Object> export(Long farmId) {
    List<Map<String, Object>> rows =
        expenses.findByFarmIdOrderByExpenseDateDesc(farmId).stream()
            .map(FinanceFarmExporter::expense)
            .toList();
    return Map.of("expenses", rows);
  }

  private static Map<String, Object> expense(Expense e) {
    Map<String, Object> row = new LinkedHashMap<>();
    row.put("id", e.getId());
    row.put("date", e.getExpenseDate());
    row.put("categoryKey", e.getCategoryKey());
    row.put("label", e.getLabel());
    row.put("amountXof", e.getAmountXof());
    row.put("source", e.getSource() == null ? null : e.getSource().name());
    row.put("productionUnitId", e.getProductionUnitId());
    row.put("notes", e.getNotes());
    return row;
  }
}
