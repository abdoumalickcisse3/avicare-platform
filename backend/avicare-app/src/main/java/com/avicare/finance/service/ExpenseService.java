package com.avicare.finance.service;

import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.common.api.exception.NotFoundException;
import com.avicare.finance.domain.Expense;
import com.avicare.finance.domain.ExpenseSource;
import com.avicare.finance.dto.request.ExpenseRequest;
import com.avicare.finance.dto.response.ExpenseResponse;
import com.avicare.finance.repository.ExpenseRepository;
import java.time.LocalDate;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Manual CRUD on the farm expense ledger. Auto-recorded expenses (PURCHASE, STOCK_ENTRY, SALARY)
 * are created via {@link FinanceFacadeImpl} and cannot be edited or deleted here (source guard).
 */
@Service
@RequiredArgsConstructor
public class ExpenseService {

  private final ExpenseRepository expenseRepository;

  @Transactional
  public ExpenseResponse create(Long farmId, ExpenseRequest request, Long userId) {
    Expense expense = new Expense();
    expense.setFarmId(farmId);
    expense.setSource(ExpenseSource.MANUAL);
    expense.setCreatedBy(userId);
    applyRequest(expense, request);
    return toResponse(expenseRepository.save(expense));
  }

  @Transactional
  public ExpenseResponse update(Long farmId, Long id, ExpenseRequest request) {
    Expense expense = loadEditable(farmId, id);
    applyRequest(expense, request);
    return toResponse(expenseRepository.save(expense));
  }

  @Transactional
  public void delete(Long farmId, Long id) {
    Expense expense = loadEditable(farmId, id);
    expenseRepository.delete(expense);
  }

  @Transactional(readOnly = true)
  public List<ExpenseResponse> list(
      Long farmId, LocalDate from, LocalDate to, String categoryKey, Long unitId) {
    return expenseRepository.search(farmId, from, to, categoryKey, unitId).stream()
        .map(ExpenseService::toResponse)
        .toList();
  }

  @Transactional(readOnly = true)
  public Summary summary(Long farmId, LocalDate from, LocalDate to) {
    List<CategoryTotal> categories =
        expenseRepository.sumByCategory(farmId, from, to).stream()
            .map(row -> new CategoryTotal((String) row[0], ((Number) row[1]).longValue()))
            .toList();
    long total = categories.stream().mapToLong(CategoryTotal::amountXof).sum();
    return new Summary(categories, total);
  }

  /** Loads an expense for a farm, guarding it is editable (MANUAL source only). */
  private Expense loadEditable(Long farmId, Long id) {
    Expense expense =
        expenseRepository
            .findById(id)
            .filter(e -> farmId.equals(e.getFarmId()))
            .orElseThrow(() -> NotFoundException.of("Expense", id));
    if (expense.getSource() != ExpenseSource.MANUAL) {
      throw new BusinessRuleException(
          "EXPENSE_NOT_EDITABLE",
          "Expense "
              + id
              + " was auto-recorded ("
              + expense.getSource()
              + ") and cannot be edited");
    }
    return expense;
  }

  private static void applyRequest(Expense expense, ExpenseRequest request) {
    expense.setCategoryKey(request.categoryKey());
    expense.setAmountXof(request.amountXof());
    expense.setExpenseDate(request.expenseDate());
    expense.setLabel(request.label());
    expense.setNotes(request.notes());
    expense.setProductionUnitId(request.productionUnitId());
  }

  static ExpenseResponse toResponse(Expense e) {
    return new ExpenseResponse(
        e.getId(),
        e.getCategoryKey(),
        e.getAmountXof(),
        e.getExpenseDate(),
        e.getLabel(),
        e.getNotes(),
        e.getProductionUnitId(),
        e.getSource().name(),
        e.getPurchaseOrderId(),
        e.getStockMovementId());
  }

  /** One category's total over the requested period. */
  public record CategoryTotal(String categoryKey, Long amountXof) {}

  /** Expense summary: per-category totals plus the grand total. */
  public record Summary(List<CategoryTotal> categories, Long totalXof) {}
}
