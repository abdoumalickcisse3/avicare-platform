package com.avicare.livestock.inventory;

import com.avicare.livestock.inventory.StockAlertsResponse.LowStockItem;
import com.avicare.livestock.inventory.StockAlertsResponse.NegativeStockItem;
import com.avicare.livestock.inventory.StockAlertsResponse.RecentMovementItem;
import java.time.LocalDate;
import java.util.List;

/**
 * Compute-on-read inventory alerts for a farm (Sprint B4-6) — the stock alerts ({@link
 * StockAlertsResponse}) plus purchase orders that are {@code SENT} but past their expected delivery
 * date. No notification table in V1 (same pattern as the health alerts aggregation).
 */
public record InventoryAlertsResponse(
    List<LowStockItem> lowStockItems,
    List<NegativeStockItem> negativeStockItems,
    List<PendingPurchaseOrderItem> pendingPurchaseOrders,
    List<RecentMovementItem> recentMovements) {

  public record PendingPurchaseOrderItem(
      Long purchaseOrderId,
      String orderNumber,
      Long supplierId,
      String supplierName,
      LocalDate expectedDeliveryDate,
      long daysOverdue,
      Long totalXof) {}
}
