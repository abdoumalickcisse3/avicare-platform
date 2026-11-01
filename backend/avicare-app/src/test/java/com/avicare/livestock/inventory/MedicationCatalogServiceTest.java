package com.avicare.livestock.inventory;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.livestock.health.HealthCatalogService;
import com.avicare.livestock.health.TreatmentDto;
import com.avicare.parameters.api.ParametersFacade;
import com.avicare.parameters.api.dto.CatalogEntryInfo;
import com.avicare.subscription.api.SubscriptionFacade;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;

/**
 * Unit test for the medication bridge (ADR-020): one product, one sheet written on both faces — the
 * stock article the farmer buys against, and the medical sheet the treatment form reads.
 *
 * <p>The farm that forced this existed in production: medications bought as {@code PRODUCT} stock
 * articles never appeared in the treatment picker, so the same bottle was declared twice under two
 * spellings and the treatment was recorded against an entry holding no stock.
 */
class MedicationCatalogServiceTest {

  private ParametersFacade parametersFacade;
  private HealthCatalogService healthCatalogService;
  private SubscriptionFacade subscriptionFacade;
  private MedicationCatalogService service;

  @BeforeEach
  void setUp() {
    parametersFacade = Mockito.mock(ParametersFacade.class);
    healthCatalogService = Mockito.mock(HealthCatalogService.class);
    subscriptionFacade = Mockito.mock(SubscriptionFacade.class);
    service =
        new MedicationCatalogService(parametersFacade, healthCatalogService, subscriptionFacade);
    when(parametersFacade.override(anyLong(), anyString(), anyString(), any()))
        .thenAnswer(
            i -> new CatalogEntryInfo(i.getArgument(1), i.getArgument(2), i.getArgument(3), true));
    when(healthCatalogService.saveTreatment(anyLong(), anyString(), any()))
        .thenReturn(
            new TreatmentDto("hepaturyl", "Hepaturyl", null, null, 7, 3, List.of(), null, true));
  }

  private static MedicationCommand hepaturyl() {
    return new MedicationCommand(
        "hepaturyl", "Hepaturyl", "L", 4500, "sorbitol", List.of("DRINKING_WATER"), 7, 3);
  }

  @Test
  void save_writesTheStockArticleAndTheMedicalSheetUnderTheSameKey() {
    when(subscriptionFacade.isModuleEnabled(22L, "module.health.advanced")).thenReturn(true);

    MedicationDto saved = service.save(22L, hepaturyl());

    @SuppressWarnings("unchecked")
    ArgumentCaptor<Map<String, Object>> article = ArgumentCaptor.forClass(Map.class);
    verify(parametersFacade)
        .override(
            Mockito.eq(22L),
            Mockito.eq("inventory_items"),
            Mockito.eq("hepaturyl"),
            article.capture());
    assertThat(article.getValue())
        .containsEntry("label", "Hepaturyl")
        .containsEntry("subcategory", "MEDICATION")
        .containsEntry("unit", "L")
        .containsEntry("typical_unit_price_xof", 4500);

    @SuppressWarnings("unchecked")
    ArgumentCaptor<Map<String, Object>> sheet = ArgumentCaptor.forClass(Map.class);
    verify(healthCatalogService)
        .saveTreatment(Mockito.eq(22L), Mockito.eq("hepaturyl"), sheet.capture());
    assertThat(sheet.getValue())
        .containsEntry("label", "Hepaturyl")
        .containsEntry("molecule", "sorbitol")
        .containsEntry("withdrawal_days_meat", 7)
        .containsEntry("withdrawal_days_eggs", 3)
        .containsEntry("routes", List.of("DRINKING_WATER"));

    assertThat(saved.key()).isEqualTo("hepaturyl");
    assertThat(saved.medicalSheetWritten()).isTrue();
  }

  /**
   * The stock article is the farm's own data and must land whatever their subscription says; the
   * medical sheet belongs to a module they may not hold. Writing it anyway would turn this route
   * into a side door onto a module-gated catalog — the sibling-path bypass we have been bitten by
   * before — so it is skipped, and the caller is told so rather than being left to assume.
   */
  @Test
  void save_withoutTheAdvancedHealthModule_writesOnlyTheStockArticle() {
    when(subscriptionFacade.isModuleEnabled(22L, "module.health.advanced")).thenReturn(false);

    MedicationDto saved = service.save(22L, hepaturyl());

    verify(parametersFacade)
        .override(Mockito.eq(22L), Mockito.eq("inventory_items"), Mockito.eq("hepaturyl"), any());
    verify(healthCatalogService, never()).saveTreatment(anyLong(), anyString(), any());
    assertThat(saved.medicalSheetWritten()).isFalse();
  }

  @Test
  void delete_removesBothFaces() {
    when(subscriptionFacade.isModuleEnabled(22L, "module.health.advanced")).thenReturn(true);

    service.delete(22L, "hepaturyl");

    verify(parametersFacade).delete(22L, "inventory_items", "hepaturyl");
    verify(healthCatalogService).deleteTreatment(22L, "hepaturyl");
  }

  @Test
  void delete_withoutTheAdvancedHealthModule_removesOnlyTheStockArticle() {
    when(subscriptionFacade.isModuleEnabled(22L, "module.health.advanced")).thenReturn(false);

    service.delete(22L, "hepaturyl");

    verify(parametersFacade).delete(22L, "inventory_items", "hepaturyl");
    verify(healthCatalogService, never()).deleteTreatment(anyLong(), anyString());
  }
}
