package com.avicare.finance.service;

import com.avicare.finance.api.FinanceFacade;
import com.avicare.finance.domain.Expense;
import com.avicare.finance.domain.ExpenseSource;
import com.avicare.finance.repository.ExpenseRepository;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Default {@link FinanceFacade} implementation: auto-records PURCHASE and STOCK_ENTRY expenses on
 * behalf of the inventory/purchase-order bounded context. Category classification is delegated to
 * {@link ExpenseCategoryMapper} (pure, no livestock import).
 */
@Service
@RequiredArgsConstructor
public class FinanceFacadeImpl implements FinanceFacade {

  private final ExpenseRepository expenseRepository;

  @Override
  @Transactional
  public void recordPurchaseExpenses(
      Long farmId,
      Long purchaseOrderId,
      String orderNumber,
      LocalDate date,
      List<PurchaseExpenseLine> lines,
      Long userId) {
    Map<String, Long> totalsByCategory = new LinkedHashMap<>();
    for (PurchaseExpenseLine line : lines) {
      String category =
          ExpenseCategoryMapper.expenseCategoryFor(line.articleSource(), line.subcategory());
      totalsByCategory.merge(category, line.lineTotalXof(), Long::sum);
    }

    totalsByCategory.forEach(
        (category, total) -> {
          if (total <= 0) return;
          Expense expense = new Expense();
          expense.setFarmId(farmId);
          expense.setCategoryKey(category);
          expense.setAmountXof(total);
          expense.setExpenseDate(date);
          expense.setLabel("Achat " + orderNumber);
          expense.setSource(ExpenseSource.PURCHASE);
          expense.setPurchaseOrderId(purchaseOrderId);
          expense.setCreatedBy(userId);
          expenseRepository.save(expense);
        });
  }

  @Override
  @Transactional
  public void recordStockEntryExpense(
      Long farmId,
      Long stockMovementId,
      String articleSource,
      String subcategory,
      String articleLabel,
      long totalValueXof,
      LocalDate date,
      Long productionUnitId,
      Long userId) {
    if (totalValueXof <= 0) return;

    Expense expense = new Expense();
    expense.setFarmId(farmId);
    expense.setCategoryKey(ExpenseCategoryMapper.expenseCategoryFor(articleSource, subcategory));
    expense.setAmountXof(totalValueXof);
    expense.setExpenseDate(date);
    expense.setLabel("Entrée stock — " + articleLabel);
    expense.setSource(ExpenseSource.STOCK_ENTRY);
    expense.setStockMovementId(stockMovementId);
    expense.setProductionUnitId(productionUnitId);
    expense.setCreatedBy(userId);
    expenseRepository.save(expense);
  }
}
