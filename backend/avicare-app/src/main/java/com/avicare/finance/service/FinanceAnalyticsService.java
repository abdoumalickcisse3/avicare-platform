package com.avicare.finance.service;

import com.avicare.common.api.exception.NotFoundException;
import com.avicare.finance.dto.response.UnitAnalyticsResponse;
import com.avicare.finance.repository.ExpenseRepository;
import com.avicare.livestock.api.LivestockFacade;
import com.avicare.livestock.api.dto.ProductionUnitInfo;
import com.avicare.livestock.commercial.CommercialFacade;
import com.avicare.parameters.api.ParametersFacade;
import com.avicare.parameters.api.dto.CatalogEntryInfo;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Per-unit financial analytics (Sprint B6 P1, task B4): costs by category (joined with the farm's
 * expense-category catalog for human-readable labels), revenue attributed to the unit (via {@link
 * CommercialFacade}), and the resulting margin / cost-per-head.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class FinanceAnalyticsService {

  private final ExpenseRepository expenseRepository;
  private final LivestockFacade livestockFacade;
  private final CommercialFacade commercialFacade;
  private final ParametersFacade parametersFacade;

  public UnitAnalyticsResponse unitAnalytics(Long farmId, Long unitId) {
    ProductionUnitInfo unit =
        livestockFacade
            .findUnit(unitId)
            .filter(u -> farmId.equals(u.farmId()))
            .orElseThrow(() -> NotFoundException.of("ProductionUnit", unitId));

    Map<String, String> labelsByKey =
        parametersFacade.listForFarm(farmId, "expense_categories").stream()
            .collect(Collectors.toMap(CatalogEntryInfo::key, FinanceAnalyticsService::labelOf));

    List<UnitAnalyticsResponse.CategoryCost> costs =
        expenseRepository.sumByCategoryForUnit(farmId, unit.id()).stream()
            .map(
                row -> {
                  String categoryKey = (String) row[0];
                  long amountXof = ((Number) row[1]).longValue();
                  String label = labelsByKey.getOrDefault(categoryKey, categoryKey);
                  return new UnitAnalyticsResponse.CategoryCost(categoryKey, label, amountXof);
                })
            .toList();

    long totalCostXof =
        costs.stream().mapToLong(UnitAnalyticsResponse.CategoryCost::amountXof).sum();
    long revenueXof = commercialFacade.revenueByProductionUnit(farmId, unit.id());
    long initialCount = livestockFacade.initialCountOf(unit.id());
    Long costPerHeadXof =
        initialCount > 0 ? Math.round((double) totalCostXof / initialCount) : null;
    long marginXof = revenueXof - totalCostXof;

    return new UnitAnalyticsResponse(
        unit.id(), costs, totalCostXof, costPerHeadXof, revenueXof, marginXof);
  }

  private static String labelOf(CatalogEntryInfo entry) {
    Object label = entry.value() != null ? entry.value().get("label") : null;
    return label != null ? label.toString() : entry.key();
  }
}
