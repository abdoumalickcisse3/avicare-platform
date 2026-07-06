package com.avicare.finance.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.avicare.finance.dto.response.FarmAnalyticsResponse;
import com.avicare.finance.repository.ExpenseRepository;
import com.avicare.livestock.api.LivestockFacade;
import com.avicare.livestock.api.dto.ProductionUnitInfo;
import com.avicare.livestock.commercial.CommercialFacade;
import com.avicare.livestock.domain.Species;
import com.avicare.livestock.domain.UnitKind;
import com.avicare.livestock.domain.UnitStatus;
import com.avicare.parameters.api.ParametersFacade;
import com.avicare.parameters.api.dto.CatalogEntryInfo;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

/** Unit test for {@link FinanceAnalyticsService#farmAnalytics}: all dependencies mocked. */
class FinanceAnalyticsServiceTest {

  private ExpenseRepository expenseRepository;
  private LivestockFacade livestockFacade;
  private CommercialFacade commercialFacade;
  private ParametersFacade parametersFacade;
  private FinanceAnalyticsService service;

  @BeforeEach
  void setUp() {
    expenseRepository = Mockito.mock(ExpenseRepository.class);
    livestockFacade = Mockito.mock(LivestockFacade.class);
    commercialFacade = Mockito.mock(CommercialFacade.class);
    parametersFacade = Mockito.mock(ParametersFacade.class);
    service =
        new FinanceAnalyticsService(
            expenseRepository, livestockFacade, commercialFacade, parametersFacade);
  }

  private static ProductionUnitInfo unit(Long id, Long farmId, String name) {
    return new ProductionUnitInfo(
        id, farmId, Species.POULTRY, UnitKind.BATCH, 1L, name, 100, UnitStatus.ACTIVE);
  }

  @Test
  void farmAnalytics_revenueMinusExpensesIsMargin_withCategoryLabelsAndPerUnitRevenue() {
    long farmId = 3L;
    when(commercialFacade.totalSalesRevenue(farmId)).thenReturn(700_000L);
    when(commercialFacade.totalPaidFromDeliveryInvoices(farmId)).thenReturn(50_000L);
    when(expenseRepository.sumByCategory(farmId, null, null))
        .thenReturn(
            List.<Object[]>of(
                new Object[] {"feed", 344_000L}, new Object[] {"veterinary", 6_000L}));
    when(parametersFacade.listForFarm(farmId, "expense_categories"))
        .thenReturn(
            List.of(
                new CatalogEntryInfo(
                    "expense_categories", "feed", Map.of("label", "Aliment"), false)));
    when(livestockFacade.listFarmUnits(farmId))
        .thenReturn(List.of(unit(10L, farmId, "Lot A"), unit(11L, farmId, "Lot B")));
    when(commercialFacade.revenueByProductionUnit(farmId, 10L)).thenReturn(700_000L);
    when(commercialFacade.revenueByProductionUnit(farmId, 11L)).thenReturn(0L);

    FarmAnalyticsResponse r = service.farmAnalytics(farmId);

    assertThat(r.directSalesXof()).isEqualTo(700_000L);
    assertThat(r.paidOrdersXof()).isEqualTo(50_000L);
    assertThat(r.totalRevenueXof()).isEqualTo(750_000L);
    assertThat(r.totalExpenseXof()).isEqualTo(350_000L);
    assertThat(r.marginXof()).isEqualTo(400_000L);

    assertThat(r.expensesByCategory())
        .extracting(FarmAnalyticsResponse.CategoryCost::categoryKey)
        .containsExactlyInAnyOrder("feed", "veterinary");
    FarmAnalyticsResponse.CategoryCost feed =
        r.expensesByCategory().stream()
            .filter(c -> c.categoryKey().equals("feed"))
            .findFirst()
            .orElseThrow();
    assertThat(feed.label()).isEqualTo("Aliment");
    assertThat(feed.amountXof()).isEqualTo(344_000L);
    // libellé absent du catalogue mocké -> fallback sur la clé
    FarmAnalyticsResponse.CategoryCost vet =
        r.expensesByCategory().stream()
            .filter(c -> c.categoryKey().equals("veterinary"))
            .findFirst()
            .orElseThrow();
    assertThat(vet.label()).isEqualTo("veterinary");

    // Seuls les lots à revenu > 0 sont listés.
    assertThat(r.revenueByUnit()).hasSize(1);
    assertThat(r.revenueByUnit().get(0).unitId()).isEqualTo(10L);
    assertThat(r.revenueByUnit().get(0).unitName()).isEqualTo("Lot A");
    assertThat(r.revenueByUnit().get(0).revenueXof()).isEqualTo(700_000L);
  }

  @Test
  void farmAnalytics_noData_allZero() {
    long farmId = 5L;
    when(commercialFacade.totalSalesRevenue(farmId)).thenReturn(0L);
    when(commercialFacade.totalPaidFromDeliveryInvoices(farmId)).thenReturn(0L);
    when(expenseRepository.sumByCategory(farmId, null, null)).thenReturn(List.of());
    when(parametersFacade.listForFarm(farmId, "expense_categories")).thenReturn(List.of());
    when(livestockFacade.listFarmUnits(farmId)).thenReturn(List.of());

    FarmAnalyticsResponse r = service.farmAnalytics(farmId);

    assertThat(r.totalRevenueXof()).isZero();
    assertThat(r.totalExpenseXof()).isZero();
    assertThat(r.marginXof()).isZero();
    assertThat(r.expensesByCategory()).isEmpty();
    assertThat(r.revenueByUnit()).isEmpty();
  }
}
