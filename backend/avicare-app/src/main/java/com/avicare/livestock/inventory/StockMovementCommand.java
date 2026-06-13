package com.avicare.livestock.inventory;

import com.avicare.livestock.domain.MovementReason;
import com.avicare.livestock.domain.MovementType;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Input to record a stock movement (Sprint B4-2). For {@code IN}/{@code OUT}, {@code quantity} is
 * the amount to add/remove (&gt; 0). For {@code ADJUSTMENT}, {@code quantity} is the counted
 * absolute target the stock becomes (&ge; 0). {@code movementDate} defaults to today when null. The
 * cross-module {@code *Id} fields are optional traceability backrefs.
 */
public record StockMovementCommand(
    Long stockItemId,
    MovementType movementType,
    BigDecimal quantity,
    MovementReason reason,
    LocalDate movementDate,
    Long productionUnitId,
    Long dailyRecordId,
    Long vaccinationId,
    Long treatmentExecutedId,
    Integer unitPriceXof,
    String notes) {}
