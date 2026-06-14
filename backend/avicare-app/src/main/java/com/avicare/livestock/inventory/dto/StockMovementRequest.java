package com.avicare.livestock.inventory.dto;

import com.avicare.livestock.domain.MovementReason;
import com.avicare.livestock.domain.MovementType;
import com.avicare.livestock.inventory.StockMovementCommand;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Create a manual stock movement (Sprint B4-6). The cross-module backref columns are not settable
 * here — automatic coupling movements go through {@code StockConsumptionService}; manual entries
 * only carry an optional {@code productionUnitId}.
 */
public record StockMovementRequest(
    @NotNull Long stockItemId,
    @NotNull MovementType movementType,
    @NotNull BigDecimal quantity,
    @NotNull MovementReason reason,
    LocalDate movementDate,
    Long productionUnitId,
    Integer unitPriceXof,
    @Size(max = 500) String notes) {

  public StockMovementCommand toCommand() {
    return new StockMovementCommand(
        stockItemId,
        movementType,
        quantity,
        reason,
        movementDate,
        productionUnitId,
        null,
        null,
        null,
        unitPriceXof,
        notes,
        null);
  }
}
