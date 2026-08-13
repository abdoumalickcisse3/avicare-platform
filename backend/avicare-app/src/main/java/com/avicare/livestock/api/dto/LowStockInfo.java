package com.avicare.livestock.api.dto;

/**
 * Public, cross-context view of an article whose stock has fallen at or below its alert threshold.
 * Exposed through {@link com.avicare.livestock.api.InventoryFacade} so the assistant can answer
 * "quels articles sont bas ?" without touching the inventory entities.
 */
public record LowStockInfo(
    String articleKey, String label, long currentQuantity, long alertThreshold, String unit) {}
