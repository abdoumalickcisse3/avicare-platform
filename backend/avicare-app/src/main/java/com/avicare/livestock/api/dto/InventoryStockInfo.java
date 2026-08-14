package com.avicare.livestock.api.dto;

/**
 * Public, cross-context view of a farm's current stock for one article. Transverse contexts (the
 * assistant) read stock through this record, never the {@code StockItem} entity.
 *
 * @param stockItemId the stock row id — needed to post a stock movement (the movement endpoint
 *     references the stock item, not the article key)
 * @param articleKey catalog key of the article
 * @param articleSource where the article is defined ({@code INVENTORY}, {@code TREATMENT}…), as the
 *     enum name — carried so a purchase/adjustment references the right catalog
 * @param unit unit of measure (kg, sac, L…), may be null
 * @param currentQuantity units currently in stock
 */
public record InventoryStockInfo(
    Long stockItemId, String articleKey, String articleSource, String unit, long currentQuantity) {}
