package com.avicare.livestock.inventory.dto;

import com.avicare.livestock.domain.MovementReason;
import com.avicare.livestock.domain.MovementType;
import com.avicare.livestock.domain.StockMovement;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * One entry of a stock item's append-only journal (Sprint B4-6). {@code articleKey} is read through
 * the (lazy) stock item — safe under open-session-in-view, as in the other livestock controllers.
 */
public record StockMovementResponse(
    Long id,
    Long stockItemId,
    String articleKey,
    MovementType movementType,
    LocalDate movementDate,
    BigDecimal quantity,
    BigDecimal quantityBefore,
    BigDecimal quantityAfter,
    MovementReason reason,
    Long productionUnitId,
    Long purchaseOrderId,
    Long dailyRecordId,
    Long vaccinationId,
    Long treatmentExecutedId,
    Integer unitPriceXof,
    Long totalValueXof,
    String notes) {

  public static StockMovementResponse from(StockMovement m) {
    return new StockMovementResponse(
        m.getId(),
        m.getStockItem().getId(),
        m.getStockItem().getArticleKey(),
        m.getMovementType(),
        m.getMovementDate(),
        m.getQuantity(),
        m.getQuantityBefore(),
        m.getQuantityAfter(),
        m.getReason(),
        m.getProductionUnitId(),
        m.getPurchaseOrderId(),
        m.getDailyRecordId(),
        m.getVaccinationId(),
        m.getTreatmentExecutedId(),
        m.getUnitPriceXof(),
        m.getTotalValueXof(),
        m.getNotes());
  }
}
