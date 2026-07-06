package com.avicare.finance.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import com.avicare.common.api.exception.NotFoundException;
import com.avicare.finance.dto.response.UnitAnalyticsResponse;
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
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

/** Unit test for {@link FinanceAnalyticsService}: all dependencies mocked. */
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

  private static ProductionUnitInfo unitInfo(Long id, Long farmId) {
    return new ProductionUnitInfo(
        id, farmId, Species.POULTRY, UnitKind.BATCH, 1L, "Lot test", 100, UnitStatus.ACTIVE);
  }

  @Test
  void unitAnalytics_computesCostsRevenueAndMargin() {
    when(livestockFacade.findUnit(42L)).thenReturn(Optional.of(unitInfo(42L, 3L)));
    when(expenseRepository.sumByCategoryForUnit(3L, 42L))
        .thenReturn(
            List.<Object[]>of(new Object[] {"feed", 50000L}, new Object[] {"veterinary", 5000L}));
    when(parametersFacade.listForFarm(3L, "expense_categories"))
        .thenReturn(
            List.of(
                new CatalogEntryInfo(
                    "expense_categories", "feed", Map.of("label", "Aliment"), false)));
    when(commercialFacade.revenueByProductionUnit(3L, 42L)).thenReturn(120000L);
    when(livestockFacade.initialCountOf(42L)).thenReturn(100L);

    UnitAnalyticsResponse response = service.unitAnalytics(3L, 42L);

    assertThat(response.unitId()).isEqualTo(42L);
    assertThat(response.totalCostXof()).isEqualTo(55000L);
    assertThat(response.costPerHeadXof()).isEqualTo(550L);
    assertThat(response.revenueXof()).isEqualTo(120000L);
    assertThat(response.marginXof()).isEqualTo(65000L);

    assertThat(response.costs())
        .extracting(UnitAnalyticsResponse.CategoryCost::categoryKey)
        .containsExactlyInAnyOrder("feed", "veterinary");
    UnitAnalyticsResponse.CategoryCost feedCost =
        response.costs().stream()
            .filter(c -> c.categoryKey().equals("feed"))
            .findFirst()
            .orElseThrow();
    assertThat(feedCost.label()).isEqualTo("Aliment");
    assertThat(feedCost.amountXof()).isEqualTo(50000L);
    UnitAnalyticsResponse.CategoryCost vetCost =
        response.costs().stream()
            .filter(c -> c.categoryKey().equals("veterinary"))
            .findFirst()
            .orElseThrow();
    // fallback: label absent from the (mocked) catalog -> falls back to the key itself.
    assertThat(vetCost.label()).isEqualTo("veterinary");
  }

  @Test
  void unitAnalytics_crossFarmUnit_throwsNotFound() {
    when(livestockFacade.findUnit(42L)).thenReturn(Optional.of(unitInfo(42L, 99L)));

    assertThatThrownBy(() -> service.unitAnalytics(3L, 42L)).isInstanceOf(NotFoundException.class);
  }

  @Test
  void unitAnalytics_unknownUnit_throwsNotFound() {
    when(livestockFacade.findUnit(42L)).thenReturn(Optional.empty());

    assertThatThrownBy(() -> service.unitAnalytics(3L, 42L)).isInstanceOf(NotFoundException.class);
  }

  @Test
  void unitAnalytics_zeroInitialCount_costPerHeadIsNull() {
    when(livestockFacade.findUnit(42L)).thenReturn(Optional.of(unitInfo(42L, 3L)));
    when(expenseRepository.sumByCategoryForUnit(3L, 42L))
        .thenReturn(List.<Object[]>of(new Object[] {"feed", 10000L}));
    when(parametersFacade.listForFarm(3L, "expense_categories")).thenReturn(List.of());
    when(commercialFacade.revenueByProductionUnit(3L, 42L)).thenReturn(0L);
    when(livestockFacade.initialCountOf(42L)).thenReturn(0L);

    UnitAnalyticsResponse response = service.unitAnalytics(3L, 42L);

    assertThat(response.costPerHeadXof()).isNull();
    assertThat(response.totalCostXof()).isEqualTo(10000L);
    assertThat(response.marginXof()).isEqualTo(-10000L);
  }
}
