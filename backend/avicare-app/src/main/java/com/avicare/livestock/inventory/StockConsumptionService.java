package com.avicare.livestock.inventory;

import com.avicare.common.api.exception.ValidationException;
import com.avicare.livestock.domain.MovementReason;
import com.avicare.livestock.domain.MovementType;
import com.avicare.livestock.domain.StockItem;
import com.avicare.livestock.domain.StockMovement;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Cross-context orchestrator that turns an optional {@link StockConsumption} into a stock movement
 * (Sprint B4-5, Décision D18). Reusable by any source action that draws from stock — daily feed,
 * vaccination, treatment today; sales etc. later. The caller runs inside its own transaction, so
 * this method joins it (Propagation.REQUIRED): if the consumption fails (unknown article…), the
 * whole source action rolls back. Stock may go negative (Décision 19, non-blocking).
 */
@Service
@RequiredArgsConstructor
public class StockConsumptionService {

  private final StockItemService stockItemService;
  private final StockMovementService stockMovementService;

  /**
   * Apply a consumption as an {@code OUT} movement, inferring the reason and backref from {@code
   * source}. Returns the created movement, or {@code null} when {@code consumption} is absent.
   */
  @Transactional
  public StockMovement applyConsumption(
      Long farmId, StockConsumption consumption, ConsumptionSource source, Long userId) {
    if (consumption == null) {
      return null;
    }
    if (consumption.quantity() == null || consumption.quantity().signum() <= 0) {
      throw new ValidationException(
          "STOCK_CONSUMPTION_QUANTITY", "Consumption quantity must be greater than 0");
    }

    StockItem item =
        stockItemService.createOrGet(
            farmId, consumption.articleSource(), consumption.articleKey(), userId);

    StockMovementCommand cmd =
        new StockMovementCommand(
            item.getId(),
            MovementType.OUT,
            consumption.quantity(),
            reasonFor(source),
            LocalDate.now(),
            source.productionUnitId(),
            source.dailyRecordId(),
            source.vaccinationId(),
            source.treatmentExecutedId(),
            null,
            consumption.notes(),
            null);
    return stockMovementService.recordMovement(farmId, cmd, userId);
  }

  private static MovementReason reasonFor(ConsumptionSource source) {
    if (source.vaccinationId() != null) {
      return MovementReason.CONSUMPTION_VACCINATION;
    }
    if (source.treatmentExecutedId() != null) {
      return MovementReason.CONSUMPTION_TREATMENT;
    }
    return MovementReason.CONSUMPTION_LOT;
  }
}
