package com.avicare.livestock.api.dto;

/**
 * Public, cross-context view of a farm's current stock for one article. Transverse contexts (the
 * assistant) read stock through this record, never the {@code StockItem} entity.
 *
 * @param articleKey catalog key of the article
 * @param unit unit of measure (kg, sac, L…), may be null
 * @param currentQuantity units currently in stock
 */
public record InventoryStockInfo(String articleKey, String unit, long currentQuantity) {}
