package com.avicare.livestock.inventory;

import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.common.api.exception.NotFoundException;
import com.avicare.common.api.exception.ValidationException;
import com.avicare.finance.api.FinanceFacade;
import com.avicare.livestock.domain.MovementReason;
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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
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
 *   <li>{@code OUT} → remove it (&gt; 0); {@code after = before - quantity}, <b>refusé</b> (422
 *       {@code STOCK_INSUFFICIENT}) s'il passerait sous zéro — ADR-018, révision de la décision 19.
 *       Trois exceptions : {@code IN} et {@code ADJUSTMENT}, qui sont les deux seules portes de
 *       sortie d'une ligne déjà négative, et la vente ({@code reason=SALE}), gardée en amont par la
 *       décision 27 ;
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
  private final FinanceFacade financeFacade;
  private final InventoryCatalogService inventoryCatalogService;
  private final StockShortagePolicy stockShortagePolicy;

  @Transactional
  public StockMovement recordMovement(Long farmId, StockMovementCommand cmd, Long userId) {
    if (cmd.quantity() == null) {
      throw new ValidationException("STOCK_QUANTITY_REQUIRED", "quantity is required");
    }
    StockItem item =
        stockItemRepository
            .findByFarmIdAndIdForUpdate(farmId, cmd.stockItemId())
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
      // La garde ne vise que la CONSOMMATION. Une vente en est exclue : refuser une vente déjà
      // encaissée ferait perdre la recette au lieu d'améliorer la donnée, et vendre plus de
      // sujets que la bande n'en porte est déjà refusé en amont (décision 27).
      if (cmd.movementType() == MovementType.OUT
          && cmd.reason() != MovementReason.SALE
          && after.signum() < 0
          && stockShortagePolicy.isBlockingFor(farmId)) {
        throw shortage(farmId, item, before, magnitude);
      }
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
    movement = stockMovementRepository.save(movement);

    // Finance P1: a manual valued inflow is an expense (spec B6 §4, source STOCK_ENTRY).
    boolean manual =
        cmd.purchaseOrderId() == null
            && cmd.dailyRecordId() == null
            && cmd.vaccinationId() == null
            && cmd.treatmentExecutedId() == null;
    boolean inflow =
        cmd.movementType() == MovementType.IN
            || (cmd.movementType() == MovementType.ADJUSTMENT
                && movement.getQuantityAfter().compareTo(movement.getQuantityBefore()) > 0);
    if (manual
        && inflow
        && movement.getTotalValueXof() != null
        && movement.getTotalValueXof() > 0) {
      InventoryCatalogItemDto article =
          inventoryCatalogService.listAllAvailableArticles(farmId).stream()
              .filter(a -> a.articleKey().equals(item.getArticleKey()))
              .findFirst()
              .orElse(null);
      financeFacade.recordStockEntryExpense(
          farmId,
          movement.getId(),
          item.getArticleSource().name(),
          article != null ? article.subcategory() : null,
          article != null ? article.label() : item.getArticleKey(),
          movement.getTotalValueXof(),
          movement.getMovementDate(),
          cmd.productionUnitId(),
          userId);
    }

    return movement;
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

  /**
   * What the farm consumed over a window — outflows and the reversals that cancel them, valued by
   * the caller through {@link StockValuation#netValueOf}.
   */
  @Transactional(readOnly = true)
  public List<StockMovement> consumptionMovementsForFarmBetween(
      Long farmId, LocalDate from, LocalDate to) {
    return stockMovementRepository.findConsumptionMovementsForFarmBetween(farmId, from, to);
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

  /**
   * Le refus d'une sortie à découvert, avec de quoi la réparer.
   *
   * <p>Le libellé n'est résolu qu'ici : la lecture du catalogue est un aller-retour qu'on ne paie
   * que sur le chemin d'échec. Les propriétés sont ce dont l'écran a besoin pour proposer les deux
   * gestes qui débloquent — enregistrer l'entrée manquante, ou compter ce qu'il y a — au lieu de
   * laisser l'ouvrier devant un mur.
   */
  private BusinessRuleException shortage(
      Long farmId, StockItem item, BigDecimal available, BigDecimal requested) {
    String label =
        inventoryCatalogService.listAllAvailableArticles(farmId).stream()
            .filter(a -> a.articleKey().equals(item.getArticleKey()))
            .map(InventoryCatalogItemDto::label)
            .filter(java.util.Objects::nonNull)
            .findFirst()
            .orElse(item.getArticleKey());
    String unit = item.getUnit() != null ? " " + item.getUnit() : "";
    Map<String, Object> details = new LinkedHashMap<>();
    details.put("stockItemId", item.getId());
    details.put("articleKey", item.getArticleKey());
    details.put("articleLabel", label);
    details.put("unit", item.getUnit());
    details.put("available", available);
    details.put("requested", requested);
    return new BusinessRuleException(
        "STOCK_INSUFFICIENT",
        "Stock insuffisant : il reste "
            + plain(available)
            + unit
            + " de "
            + label
            + ", vous en sortez "
            + plain(requested)
            + unit
            + ".",
        details);
  }

  /** {@code 2.000} se dit « 2 » : un zéro de queue dans un message se lit comme une erreur. */
  private static String plain(BigDecimal value) {
    return value.stripTrailingZeros().toPlainString();
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
