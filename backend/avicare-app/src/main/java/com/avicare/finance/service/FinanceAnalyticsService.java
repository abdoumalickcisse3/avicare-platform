package com.avicare.finance.service;

import com.avicare.finance.dto.response.FarmAnalyticsResponse;
import com.avicare.finance.repository.ExpenseRepository;
import com.avicare.livestock.api.LivestockFacade;
import com.avicare.livestock.commercial.CommercialFacade;
import com.avicare.parameters.api.ParametersFacade;
import com.avicare.parameters.api.dto.CatalogEntryInfo;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Analytique financière au niveau ferme (Sprint B6) : compte de résultat cumulé — total revenus
 * (ventes directes COMPLETED + montants encaissés sur les factures de livraison) moins le total des
 * dépenses = marge ; ventilation des dépenses par catégorie (jointe au catalogue pour les libellés)
 * et revenu attribué par lot.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class FinanceAnalyticsService {

  private final ExpenseRepository expenseRepository;
  private final LivestockFacade livestockFacade;
  private final CommercialFacade commercialFacade;
  private final ParametersFacade parametersFacade;

  public FarmAnalyticsResponse farmAnalytics(Long farmId) {
    long directSalesXof = commercialFacade.totalSalesRevenue(farmId);
    long paidOrdersXof = commercialFacade.totalPaidFromDeliveryInvoices(farmId);
    long totalRevenueXof = directSalesXof + paidOrdersXof;

    Map<String, String> labelsByKey =
        parametersFacade.listForFarm(farmId, "expense_categories").stream()
            .collect(Collectors.toMap(CatalogEntryInfo::key, FinanceAnalyticsService::labelOf));

    List<FarmAnalyticsResponse.CategoryCost> expensesByCategory =
        expenseRepository.sumByCategory(farmId, null, null).stream()
            .map(
                row -> {
                  String categoryKey = (String) row[0];
                  long amountXof = ((Number) row[1]).longValue();
                  return new FarmAnalyticsResponse.CategoryCost(
                      categoryKey, labelsByKey.getOrDefault(categoryKey, categoryKey), amountXof);
                })
            .toList();

    long totalExpenseXof =
        expensesByCategory.stream().mapToLong(FarmAnalyticsResponse.CategoryCost::amountXof).sum();

    List<FarmAnalyticsResponse.UnitRevenue> revenueByUnit =
        livestockFacade.listFarmUnits(farmId).stream()
            .map(
                u ->
                    new FarmAnalyticsResponse.UnitRevenue(
                        u.id(), u.name(), commercialFacade.revenueByProductionUnit(farmId, u.id())))
            .filter(r -> r.revenueXof() > 0)
            .sorted(
                Comparator.comparingLong(FarmAnalyticsResponse.UnitRevenue::revenueXof).reversed())
            .toList();

    long marginXof = totalRevenueXof - totalExpenseXof;

    return new FarmAnalyticsResponse(
        totalRevenueXof,
        directSalesXof,
        paidOrdersXof,
        totalExpenseXof,
        marginXof,
        expensesByCategory,
        revenueByUnit);
  }

  private static String labelOf(CatalogEntryInfo entry) {
    Object label = entry.value() != null ? entry.value().get("label") : null;
    return label != null ? label.toString() : entry.key();
  }
}
