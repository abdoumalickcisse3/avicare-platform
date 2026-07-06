package com.avicare.finance.dto.response;

import java.util.List;

/**
 * Compte de résultat au niveau ferme (Sprint B6) : total revenus (ventes directes + commandes
 * payées) − total dépenses = marge, avec ventilation des dépenses par catégorie et revenu par lot.
 * Totaux cumulés (pas de fenêtre temporelle en V1).
 */
public record FarmAnalyticsResponse(
    long totalRevenueXof,
    long directSalesXof,
    long paidOrdersXof,
    long totalExpenseXof,
    long marginXof,
    List<CategoryCost> expensesByCategory,
    List<UnitRevenue> revenueByUnit) {

  /** Une catégorie de dépense et son total, avec le libellé lisible du catalogue. */
  public record CategoryCost(String categoryKey, String label, long amountXof) {}

  /** Revenu (ventes attribuées) d'un lot. */
  public record UnitRevenue(Long unitId, String unitName, long revenueXof) {}
}
