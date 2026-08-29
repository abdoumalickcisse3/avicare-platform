package com.avicare.parameters.service;

import com.avicare.parameters.domain.CatalogItem;
import com.avicare.parameters.domain.FarmCatalogItem;
import com.avicare.parameters.repository.CatalogItemRepository;
import com.avicare.parameters.repository.FarmCatalogItemRepository;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Reads and customizes the platform catalog at the farm level (doc 06 §3, layer 1 + farm
 * overrides). {@link #listForFarm} merges the active platform items of a category with the farm's
 * {@code farm_catalog_items}: an override replaces a platform item's value, a disable hides it, and
 * a parent-less farm row is a pure custom addition.
 */
@Service
@RequiredArgsConstructor
public class CatalogService {

  private final CatalogItemRepository catalogItemRepository;
  private final FarmCatalogItemRepository farmCatalogItemRepository;

  /** The platform catalog for a category (active items only), ignoring farm customizations. */
  @Transactional(readOnly = true)
  public List<CatalogEntry> listPlatform(String category) {
    return catalogItemRepository.findByCategory(category).stream()
        .filter(CatalogItem::isActive)
        .map(c -> new CatalogEntry(c.getCategory(), c.getKey(), c.getValue(), false))
        .toList();
  }

  /**
   * The effective catalog of a category for a farm: active platform items (overridden values when
   * the farm customized them, hidden when disabled) plus the farm's custom additions. Keyed by
   * {@code key}, farm rows win.
   */
  @Transactional(readOnly = true)
  public List<CatalogEntry> listForFarm(Long farmId, String category) {
    Map<String, CatalogEntry> byKey = new LinkedHashMap<>();

    for (CatalogItem platform : catalogItemRepository.findByCategory(category)) {
      if (platform.isActive()) {
        byKey.put(
            platform.getKey(),
            new CatalogEntry(category, platform.getKey(), platform.getValue(), false));
      }
    }

    for (FarmCatalogItem farmItem :
        farmCatalogItemRepository.findByFarmIdAndCategory(farmId, category)) {
      if (farmItem.isDisabled()) {
        byKey.remove(farmItem.getKey());
      } else {
        boolean custom = farmItem.getCatalogItemId() == null;
        byKey.put(
            farmItem.getKey(),
            new CatalogEntry(category, farmItem.getKey(), farmItem.getValue(), custom));
      }
    }

    return new ArrayList<>(byKey.values());
  }

  /**
   * Override (or add) a catalog entry for a farm. If a platform item with the same (category, key)
   * exists, the override links to it; otherwise it is a pure custom item.
   */
  @Transactional
  public FarmCatalogItem override(
      Long farmId, String category, String key, Map<String, Object> value) {
    FarmCatalogItem item =
        farmCatalogItemRepository
            .findByFarmIdAndCategoryAndKey(farmId, category, key)
            .orElseGet(FarmCatalogItem::new);
    item.setFarmId(farmId);
    item.setCategory(category);
    item.setKey(key);
    item.setValue(value);
    item.setDisabled(false);
    if (item.getCatalogItemId() == null) {
      catalogItemRepository
          .findByCategoryAndKeyAndLocale(category, key, null)
          .ifPresent(platform -> item.setCatalogItemId(platform.getId()));
    }
    return farmCatalogItemRepository.save(item);
  }

  /** Hide a platform catalog entry for a farm. */
  @Transactional
  public void disable(Long farmId, String category, String key) {
    FarmCatalogItem item =
        farmCatalogItemRepository
            .findByFarmIdAndCategoryAndKey(farmId, category, key)
            .orElseGet(FarmCatalogItem::new);
    item.setFarmId(farmId);
    item.setCategory(category);
    item.setKey(key);
    if (item.getValue() == null) {
      item.setValue(Map.of());
    }
    item.setDisabled(true);
    farmCatalogItemRepository.save(item);
  }

  /**
   * Upsert a platform-level catalog entry (layer 1).
   *
   * <p>Used by the screens that own a platform setting — health thresholds, benchmark floor. The
   * key is created if it is missing, so a setting introduced by a migration and one introduced by a
   * screen behave the same.
   */
  @Transactional
  public CatalogItem setPlatformEntry(String category, String key, Map<String, Object> value) {
    CatalogItem item =
        catalogItemRepository
            .findByCategoryAndKeyAndLocale(category, key, null)
            .orElseGet(
                () -> {
                  CatalogItem fresh = new CatalogItem();
                  fresh.setCategory(category);
                  fresh.setKey(key);
                  return fresh;
                });
    item.setValue(value);
    item.setActive(true);
    return catalogItemRepository.save(item);
  }
}
