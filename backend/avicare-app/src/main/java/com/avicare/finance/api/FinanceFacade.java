package com.avicare.finance.api;

import java.time.LocalDate;
import java.util.List;

/**
 * Public contract for auto-recording expenses from other bounded contexts (inventory/purchases,
 * stock movements, payroll). No import of {@code com.avicare.livestock.*} — callers pre-resolve
 * their own catalog data into raw strings before calling here (per ADR-008, no cross-context
 * imports).
 */
public interface FinanceFacade {

  /** One received PO line, pre-resolved by the caller (inventory owns the catalog). */
  record PurchaseExpenseLine(String articleSource, String subcategory, long lineTotalXof) {}

  /** Records PURCHASE expenses for a received purchase order, grouped by expense category. */
  void recordPurchaseExpenses(
      Long farmId,
      Long purchaseOrderId,
      String orderNumber,
      LocalDate date,
      List<PurchaseExpenseLine> lines,
      Long userId);

  /** Records a STOCK_ENTRY expense for a valued manual IN/positive-adjustment movement. */
  void recordStockEntryExpense(
      Long farmId,
      Long stockMovementId,
      String articleSource,
      String subcategory,
      String articleLabel,
      long totalValueXof,
      LocalDate date,
      Long productionUnitId,
      Long userId);
}
