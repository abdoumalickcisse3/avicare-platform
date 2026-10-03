package com.avicare.livestock.inventory;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.avicare.livestock.health.HealthCatalogService;
import com.avicare.parameters.api.ParametersFacade;
import com.avicare.parameters.api.dto.CatalogEntryInfo;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

/** Unit test: farm-merged inventory articles carry the platform/custom flag. */
class InventoryCatalogServiceTest {

  private ParametersFacade parametersFacade;
  private HealthCatalogService healthCatalogService;
  private InventoryCatalogService service;

  @BeforeEach
  void setUp() {
    parametersFacade = Mockito.mock(ParametersFacade.class);
    healthCatalogService = Mockito.mock(HealthCatalogService.class);
    service = new InventoryCatalogService(parametersFacade, healthCatalogService);
  }

  @Test
  void listInventoryArticles_mergesFarmCatalog_andFlagsCustom() {
    when(parametersFacade.listForFarm(7L, "inventory_items"))
        .thenReturn(
            List.of(
                new CatalogEntryInfo(
                    "inventory_items",
                    "feed_starter_broiler",
                    Map.of(
                        "label", "Démarrage poulet chair",
                        "subcategory", "FEED",
                        "unit", "kg",
                        "typical_unit_price_xof", 500),
                    false),
                new CatalogEntryInfo(
                    "inventory_items",
                    "melange-maison",
                    Map.of("label", "Mélange maison", "subcategory", "FEED", "unit", "sac"),
                    true)));

    List<InventoryCatalogItemDto> items = service.listInventoryArticles(7L);

    assertThat(items).hasSize(2);
    InventoryCatalogItemDto platform =
        items.stream()
            .filter(i -> i.articleKey().equals("feed_starter_broiler"))
            .findFirst()
            .orElseThrow();
    assertThat(platform.custom()).isFalse();
    assertThat(platform.typicalUnitPriceXof()).isEqualTo(500);
    InventoryCatalogItemDto custom =
        items.stream()
            .filter(i -> i.articleKey().equals("melange-maison"))
            .findFirst()
            .orElseThrow();
    assertThat(custom.custom()).isTrue();
    assertThat(custom.label()).isEqualTo("Mélange maison");
    assertThat(custom.typicalUnitPriceXof()).isNull();
  }

  /**
   * A stock row carries no label snapshot, so every response that names an article resolves it
   * here. An entry whose catalog value has no {@code label} must simply be absent from the map —
   * {@code Collectors.toMap} would blow up on the null value.
   */
  @Test
  void labelsByKey_mapsEveryArticle_andSkipsAMissingLabel() {
    when(parametersFacade.listForFarm(7L, "inventory_items"))
        .thenReturn(
            List.of(
                new CatalogEntryInfo(
                    "inventory_items",
                    "feed_starter_broiler",
                    Map.of("label", "Démarrage poulet chair", "unit", "kg"),
                    false),
                new CatalogEntryInfo(
                    "inventory_items", "sans_libelle", Map.of("unit", "kg"), true)));
    when(healthCatalogService.listTreatments(7L)).thenReturn(List.of());

    Map<String, String> labels = service.labelsByKey(7L);

    assertThat(labels).containsExactly(Map.entry("feed_starter_broiler", "Démarrage poulet chair"));
  }
}
