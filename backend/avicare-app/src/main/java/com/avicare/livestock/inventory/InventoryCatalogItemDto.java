package com.avicare.livestock.inventory;

import com.avicare.livestock.domain.ArticleSource;

/**
 * A unified, cross-context view of an article that can be stocked (Sprint B4-1): either a platform
 * inventory item (category {@code inventory_items}, {@code source=INVENTORY}) or a medication
 * referenced from the health catalog (category {@code treatments}, {@code source=TREATMENT}).
 * Medications carry no unit/price in their catalog, so those fields are {@code null} for them.
 */
public record InventoryCatalogItemDto(
    String articleKey,
    ArticleSource articleSource,
    String label,
    String subcategory,
    String unit,
    Integer typicalUnitPriceXof) {}
