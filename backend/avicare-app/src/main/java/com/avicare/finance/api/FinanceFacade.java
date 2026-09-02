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

  /**
   * Enregistre une dépense catégorie {@code veterinary}, source {@code VET_VISIT}, liée à la
   * visite. Idempotent : ne fait rien si une dépense existe déjà pour {@code vetVisitId}, ou si
   * {@code amountXof <= 0}.
   */
  void recordVetVisitExpense(
      Long farmId,
      Long vetVisitId,
      String label,
      long amountXof,
      LocalDate date,
      Long productionUnitId,
      Long userId);

  /** Réverse (soft-delete) la dépense liée à une visite supprimée. No-op si absente. */
  void reverseVetVisitExpense(Long farmId, Long vetVisitId);

  /**
   * Σ des dépenses directement rattachées à une unité de production, hors source {@code
   * STOCK_ENTRY} — celle-ci est déjà comptée à l'entrée en stock, la recompter au titre du lot
   * doublerait l'aliment. Sert le bilan de fin de bande.
   */
  long directExpensesForUnit(Long farmId, Long productionUnitId);

  /**
   * Read-only farm P&amp;L (revenue, expenses, margin) — the same figures as the finance dashboard.
   * Serves the assistant's consultation loop.
   */
  FarmPnl farmPnl(Long farmId);
}
