package com.avicare.livestock.inventory;

import com.avicare.livestock.domain.MovementType;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Compute-on-read stock alerts for a farm (Sprint B4-2, no notification table — V1; pattern from
 * the health AlertService). Low-stock items are at/below their alert threshold; negative-stock
 * items have gone below zero (Décision 19 fallout); recent movements give a short overview.
 */
public record StockAlertsResponse(
    List<LowStockItem> lowStockItems,
    List<NegativeStockItem> negativeStockItems,
    List<RecentMovementItem> recentMovements) {

  public record LowStockItem(
      Long stockItemId,
      String articleKey,
      String label,
      BigDecimal currentQuantity,
      BigDecimal alertThreshold,
      String unit,
      BigDecimal percentBelowThreshold) {}

  public record NegativeStockItem(
      Long stockItemId, String articleKey, String label, BigDecimal currentQuantity, String unit) {}

  public record RecentMovementItem(
      Long movementId,
      Long stockItemId,
      String articleKey,
      MovementType movementType,
      BigDecimal quantity,
      BigDecimal quantityAfter,
      LocalDate movementDate) {}
}
