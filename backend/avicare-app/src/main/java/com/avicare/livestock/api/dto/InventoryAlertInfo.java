package com.avicare.livestock.api.dto;

/**
 * Neutral, cross-context view of one inventory alert condition, exposed through {@link
 * com.avicare.livestock.api.InventoryFacade#inventoryAlerts(Long)} so the notification context can
 * materialize alerts without touching the inventory entities (Sprint C1).
 *
 * @param kind one of {@code LOW_STOCK}, {@code NEGATIVE_STOCK}, {@code PO_OVERDUE}
 * @param refId stock item id (LOW_STOCK / NEGATIVE_STOCK) or purchase order id (PO_OVERDUE)
 * @param label human label for the message
 * @param daysOverdue days past the expected delivery date (PO_OVERDUE only; 0 otherwise)
 */
public record InventoryAlertInfo(String kind, Long refId, String label, long daysOverdue) {}
