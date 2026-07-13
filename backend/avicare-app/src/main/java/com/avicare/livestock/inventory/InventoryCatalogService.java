package com.avicare.livestock.inventory;

import com.avicare.livestock.domain.ArticleSource;
import com.avicare.livestock.health.HealthCatalogService;
import com.avicare.parameters.api.ParametersFacade;
import com.avicare.parameters.api.dto.CatalogEntryInfo;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Unified, read-only catalog of articles that can be stocked (Sprint B4-1). Bridges two platform
 * catalogs without duplicating data:
 *
 * <ul>
 *   <li>{@code inventory_items} (V15) — feeds, consumables, equipment, products, read through
 *       {@link ParametersFacade#listPlatform};
 *   <li>{@code treatments} (V12) — medications, read through {@link HealthCatalogService} (the
 *       health context owns that catalog, so we go through its service, not its repository).
 * </ul>
 *
 * The {@code listAllAvailableArticles} union is what the frontend lists when the user picks an
 * article to stock. Medications carry no unit/price, so those are {@code null} for them.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class InventoryCatalogService {

  static final String CAT_INVENTORY_ITEMS = "inventory_items";
  static final String MEDICATION_SUBCATEGORY = "MEDICATION";

  private final ParametersFacade parametersFacade;
  private final HealthCatalogService healthCatalogService;

  public List<InventoryCatalogItemDto> listInventoryArticles(Long farmId) {
    return parametersFacade.listForFarm(farmId, CAT_INVENTORY_ITEMS).stream()
        .map(InventoryCatalogService::toInventoryDto)
        .toList();
  }

  public List<InventoryCatalogItemDto> listMedicationArticles(Long farmId) {
    return healthCatalogService.listTreatments(farmId).stream()
        .map(
            t ->
                new InventoryCatalogItemDto(
                    t.key(),
                    ArticleSource.TREATMENT,
                    t.label(),
                    MEDICATION_SUBCATEGORY,
                    null,
                    null,
                    false))
        .toList();
  }

  /** The full list of stockable articles: inventory items ∪ medications. */
  public List<InventoryCatalogItemDto> listAllAvailableArticles(Long farmId) {
    return Stream.concat(
            listInventoryArticles(farmId).stream(), listMedicationArticles(farmId).stream())
        .toList();
  }

  private static InventoryCatalogItemDto toInventoryDto(CatalogEntryInfo e) {
    Map<String, Object> v = e.value();
    return new InventoryCatalogItemDto(
        e.key(),
        ArticleSource.INVENTORY,
        str(v, "label"),
        str(v, "subcategory"),
        str(v, "unit"),
        intg(v, "typical_unit_price_xof"),
        e.custom());
  }

  private static String str(Map<String, Object> v, String key) {
    Object o = v.get(key);
    return o != null ? o.toString() : null;
  }

  private static Integer intg(Map<String, Object> v, String key) {
    return v.get(key) instanceof Number n ? n.intValue() : null;
  }
}
