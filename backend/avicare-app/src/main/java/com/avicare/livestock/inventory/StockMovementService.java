package com.avicare.livestock.inventory;

import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.common.api.exception.NotFoundException;
import com.avicare.common.api.exception.ValidationException;
import com.avicare.livestock.domain.MovementType;
import com.avicare.livestock.domain.StockItem;
import com.avicare.livestock.domain.StockMovement;
import com.avicare.livestock.repository.StockItemRepository;
import com.avicare.livestock.repository.StockMovementRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Records stock movements and cascades them to the stock item (Sprint B4-2). Every {@link
 * #recordMovement} is atomic (@Transactional): the {@link StockItem}'s {@code currentQuantity} and
 * {@code lastMovementAt} are updated in the same unit of work as the journal insert, so the stock
 * level always equals the sum of its movements.
 *
 * <p>Semantics of {@code quantity} on the command:
 *
 * <ul>
 *   <li>{@code IN} → add it (must be &gt; 0); {@code after = before + quantity};
 *   <li>{@code OUT} → remove it (&gt; 0); {@code after = before - quantity} — may go negative
 *       (Décision 19, non-blocking);
 *   <li>{@code ADJUSTMENT} → it is the counted absolute target (&ge; 0); {@code after = target},
 *       and the journalled magnitude is {@code |target - before|}; a no-op (target == before) is
 *       rejected.
 * </ul>
 *
 * No pessimistic lock in V1 — the single-user-per-action assumption holds; optimistic
 * {@code @Version} is a V2 candidate. RBAC is enforced at the controller layer (B4-6). No
 * LifecycleEvent is emitted — this table IS the stock journal.
 */
@Service
@RequiredArgsConstructor
public class StockMovementService {

  private final StockMovementRepository stockMovementRepository;
  private final StockItemRepository stockItemRepository;

  @Transactional
  public StockMovement recordMovement(Long farmId, StockMovementCommand cmd, Long userId) {
    if (cmd.quantity() == null) {
      throw new ValidationException("STOCK_QUANTITY_REQUIRED", "quantity is required");
    }
    StockItem item =
        stockItemRepository
            .findByFarmIdAndId(farmId, cmd.stockItemId())
            .orElseThrow(() -> NotFoundException.of("StockItem", cmd.stockItemId()));

    BigDecimal before = item.getCurrentQuantity();
    BigDecimal magnitude;
    BigDecimal after;
    if (cmd.movementType() == MovementType.ADJUSTMENT) {
      BigDecimal target = cmd.quantity();
      if (target.signum() < 0) {
        throw new ValidationException(
            "STOCK_ADJUSTMENT_NEGATIVE", "An adjustment target cannot be negative");
      }
      magnitude = target.subtract(before).abs();
      if (magnitude.signum() == 0) {
        throw new BusinessRuleException(
            "STOCK_ADJUSTMENT_NOOP", "Adjustment target equals the current quantity");
      }
      after = target;
    } else {
      if (cmd.quantity().signum() <= 0) {
        throw new ValidationException(
            "STOCK_QUANTITY_NOT_POSITIVE", "An IN/OUT quantity must be greater than 0");
      }
      magnitude = cmd.quantity();
      after =
          cmd.movementType() == MovementType.IN
              ? before.add(magnitude)
              : before.subtract(magnitude);
    }

    item.setCurrentQuantity(after);
    item.setLastMovementAt(LocalDateTime.now());
    stockItemRepository.save(item);

    StockMovement movement = new StockMovement();
    movement.setStockItem(item);
    movement.setMovementType(cmd.movementType());
    movement.setMovementDate(cmd.movementDate() != null ? cmd.movementDate() : LocalDate.now());
    movement.setQuantity(magnitude);
    movement.setQuantityBefore(before);
    movement.setQuantityAfter(after);
    movement.setReason(cmd.reason());
    movement.setProductionUnitId(cmd.productionUnitId());
    movement.setDailyRecordId(cmd.dailyRecordId());
    movement.setVaccinationId(cmd.vaccinationId());
    movement.setTreatmentExecutedId(cmd.treatmentExecutedId());
    movement.setPurchaseOrderId(cmd.purchaseOrderId());
    movement.setUnitPriceXof(cmd.unitPriceXof());
    movement.setTotalValueXof(totalValue(magnitude, cmd.unitPriceXof()));
    movement.setNotes(cmd.notes());
    movement.setPerformedByUserId(userId);
    movement.setCreatedBy(userId);
    return stockMovementRepository.save(movement);
  }

  @Transactional(readOnly = true)
  public List<StockMovement> listForStockItem(Long farmId, Long stockItemId) {
    stockItemRepository
        .findByFarmIdAndId(farmId, stockItemId)
        .orElseThrow(() -> NotFoundException.of("StockItem", stockItemId));
    return stockMovementRepository.findByStockItemIdOrderByMovementDateDescIdDesc(stockItemId);
  }

  /** A single movement, scoped to the farm via its stock item (404 cross-farm). */
  @Transactional(readOnly = true)
  public StockMovement get(Long farmId, Long movementId) {
    StockMovement movement =
        stockMovementRepository
            .findById(movementId)
            .orElseThrow(() -> NotFoundException.of("StockMovement", movementId));
    if (!movement.getStockItem().getFarmId().equals(farmId)) {
      throw NotFoundException.of("StockMovement", movementId);
    }
    return movement;
  }

  @Transactional(readOnly = true)
  public List<StockMovement> listForProductionUnit(Long productionUnitId) {
    return stockMovementRepository.findByProductionUnitIdOrderByMovementDateDesc(productionUnitId);
  }

  @Transactional(readOnly = true)
  public StockValuationResponse getStockValuation(Long farmId) {
    List<StockValuationResponse.Item> items = new ArrayList<>();
    long total = 0;
    for (StockItem item : stockItemRepository.findByFarmIdAndActiveTrueOrderByArticleKey(farmId)) {
      if (item.getTypicalUnitPriceXof() == null) {
        continue;
      }
      long value = totalValue(item.getCurrentQuantity(), item.getTypicalUnitPriceXof());
      total += value;
      items.add(
          new StockValuationResponse.Item(
              item.getId(),
              item.getArticleKey(),
              item.getArticleSource(),
              item.getCurrentQuantity(),
              item.getTypicalUnitPriceXof(),
              value));
    }
    return new StockValuationResponse(items, total);
  }

  /** {@code quantity × unitPrice}, rounded to whole XOF; null when no price. */
  private static Long totalValue(BigDecimal quantity, Integer unitPriceXof) {
    if (unitPriceXof == null) {
      return null;
    }
    return quantity
        .multiply(BigDecimal.valueOf(unitPriceXof))
        .setScale(0, RoundingMode.HALF_UP)
        .longValueExact();
  }
}
