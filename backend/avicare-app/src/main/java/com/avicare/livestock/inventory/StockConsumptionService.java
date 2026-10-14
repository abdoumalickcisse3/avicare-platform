package com.avicare.livestock.inventory;

import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.common.api.exception.ValidationException;
import com.avicare.livestock.domain.MovementReason;
import com.avicare.livestock.domain.MovementType;
import com.avicare.livestock.domain.StockItem;
import com.avicare.livestock.domain.StockMovement;
import com.avicare.livestock.repository.StockMovementRepository;
import com.avicare.subscription.api.SubscriptionFacade;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Cross-context orchestrator that turns an optional {@link StockConsumption} into a stock movement
 * (Sprint B4-5, Décision D18). Reusable by any source action that draws from stock — daily feed,
 * vaccination, treatment today; sales etc. later. The caller runs inside its own transaction, so
 * this method joins it (Propagation.REQUIRED): if the consumption fails (article inconnu, stock
 * insuffisant…), the whole source action rolls back. Depuis ADR-018 une consommation qui ferait
 * passer le stock sous zéro est refusée en 422.
 */
@Service
@RequiredArgsConstructor
public class StockConsumptionService {

  static final String MODULE_INVENTORY = "module.inventory";
  static final String REVERSAL_NOTE = "Reversal of a corrected or deleted entry";

  private final StockItemService stockItemService;
  private final StockMovementService stockMovementService;
  private final SubscriptionFacade subscriptionFacade;
  private final StockMovementRepository stockMovementRepository;

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
    // Option α (B4-6): a coupling payload is only honoured when the farm has the inventory module.
    // Well-formed request, unmet business precondition → 422 (BusinessRuleException), not 400.
    // Runs inside the caller's transaction, so the whole source action rolls back on refusal.
    if (!subscriptionFacade.isModuleEnabled(farmId, MODULE_INVENTORY)) {
      throw new BusinessRuleException(
          "MODULE_INVENTORY_REQUIRED",
          "module.inventory non activé pour cette ferme — couplage stock impossible");
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

  /**
   * Undo whatever the source action already took out of stock, by posting one compensating {@code
   * IN} per article. Called when a daily record is re-saved (it is an upsert — without this, the
   * second save debits the stock a second time) and when a vaccination or treatment is deleted (its
   * movement row used to be cascade-deleted, leaving the quantity down and nothing to explain it).
   *
   * <p>Nothing is ever deleted: the journal is append-only, so the credit is a movement of its own.
   * It carries the same backref as the outflow it cancels, which makes the operation idempotent — a
   * second call nets the credit against the debit and writes nothing. Each credit is dated like the
   * outflow it cancels, so a correction does not move cost from one period into another.
   *
   * <p>No module check here, unlike {@link #applyConsumption}: this undoes a write the platform
   * itself made, and must keep working even if the inventory module was switched off since.
   */
  @Transactional
  public void reverseConsumptions(Long farmId, ConsumptionSource source, Long userId) {
    Map<Long, BigDecimal> netByItem = new LinkedHashMap<>();
    Map<Long, LocalDate> dateByItem = new HashMap<>();
    for (StockMovement m : movementsOf(source)) {
      Long itemId = m.getStockItem().getId();
      if (m.getMovementType() == MovementType.OUT) {
        netByItem.merge(itemId, m.getQuantity(), BigDecimal::add);
        dateByItem.merge(itemId, m.getMovementDate(), (a, b) -> b.isAfter(a) ? b : a);
      } else if (m.getMovementType() == MovementType.IN) {
        netByItem.merge(itemId, m.getQuantity().negate(), BigDecimal::add);
      }
    }
    for (Map.Entry<Long, BigDecimal> e : netByItem.entrySet()) {
      if (e.getValue().signum() <= 0) {
        continue;
      }
      stockMovementService.recordMovement(
          farmId,
          new StockMovementCommand(
              e.getKey(),
              MovementType.IN,
              e.getValue(),
              MovementReason.ERROR_CORRECTION,
              dateByItem.getOrDefault(e.getKey(), LocalDate.now()),
              source.productionUnitId(),
              source.dailyRecordId(),
              source.vaccinationId(),
              source.treatmentExecutedId(),
              null,
              REVERSAL_NOTE,
              null),
          userId);
    }
  }

  private List<StockMovement> movementsOf(ConsumptionSource source) {
    if (source.vaccinationId() != null) {
      return stockMovementRepository.findByVaccinationId(source.vaccinationId());
    }
    if (source.treatmentExecutedId() != null) {
      return stockMovementRepository.findByTreatmentExecutedId(source.treatmentExecutedId());
    }
    if (source.dailyRecordId() != null) {
      return stockMovementRepository.findByDailyRecordId(source.dailyRecordId());
    }
    return List.of();
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
