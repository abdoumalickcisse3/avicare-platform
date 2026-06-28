package com.avicare.livestock.commercial;

import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.common.api.exception.NotFoundException;
import com.avicare.livestock.api.LivestockFacade;
import com.avicare.livestock.domain.ArticleSource;
import com.avicare.livestock.domain.Delivery;
import com.avicare.livestock.domain.DeliveryItem;
import com.avicare.livestock.domain.DeliveryStatus;
import com.avicare.livestock.domain.MovementReason;
import com.avicare.livestock.domain.MovementType;
import com.avicare.livestock.domain.Order;
import com.avicare.livestock.domain.OrderItem;
import com.avicare.livestock.domain.OrderStatus;
import com.avicare.livestock.domain.StockItem;
import com.avicare.livestock.domain.StockMovement;
import com.avicare.livestock.inventory.StockItemService;
import com.avicare.livestock.inventory.StockMovementCommand;
import com.avicare.livestock.inventory.StockMovementService;
import com.avicare.livestock.repository.DeliveryRepository;
import com.avicare.livestock.repository.OrderRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Deliveries (Sprint B5-2, Décision D22). A delivery is created by converting a confirmed order
 * that is being prepared ({@code IN_PROGRESS}, per the D23 state machine): it snapshots the order
 * lines in full (no partial delivery in V1, D23), decrements PRODUCT stock per line — via {@link
 * LivestockFacade} for PRODUCTION lines (D27 blocking) or via {@link StockMovementService} for
 * INVENTORY/TREATMENT lines (D18/D19 non-blocking) — and marks the order DELIVERED, all atomically.
 * Delivery numbers are minted {@code LIV-YYYY-NNN} per farm per year (D24); amounts are HT only
 * (D25). The client balance is NOT touched here (only by payments, B5-4, D26). Cancelling a
 * delivery reverses the stock and reopens the order for re-delivery. RBAC is at the controller
 * layer (B5-5).
 */
@Service
@RequiredArgsConstructor
public class DeliveryService {

  private final DeliveryRepository deliveryRepository;
  private final OrderRepository orderRepository;
  private final OrderService orderService;
  private final StockItemService stockItemService;
  private final StockMovementService stockMovementService;
  private final LivestockFacade livestockFacade;

  @Transactional
  public Delivery createFromOrder(
      Long farmId, Long orderId, DeliveryFromOrderCommand cmd, Long userId) {
    Order order = loadOrder(farmId, orderId);
    if (order.getStatus() != OrderStatus.IN_PROGRESS) {
      throw new BusinessRuleException(
          "INVALID_DELIVERY_SOURCE",
          "Only an in-progress order can be delivered (was " + order.getStatus() + ")");
    }

    Delivery delivery = new Delivery();
    delivery.setFarmId(farmId);
    delivery.setOrder(order);
    delivery.setClient(order.getClient());
    delivery.setStatus(DeliveryStatus.DELIVERED);
    delivery.setDeliveryDate(cmd.deliveryDate() != null ? cmd.deliveryDate() : LocalDate.now());
    delivery.setCarrier(cmd.carrier());
    delivery.setNotes(cmd.notes());
    delivery.setCreatedBy(userId);
    delivery.setDeliveryNumber(
        generateDeliveryNumber(farmId, delivery.getDeliveryDate().getYear()));

    long total = 0;
    for (OrderItem source : order.getItems()) {
      DeliveryItem item = new DeliveryItem();
      item.setArticleKey(source.getArticleKey());
      item.setArticleSource(source.getArticleSource());
      item.setArticleLabelSnapshot(source.getArticleLabelSnapshot());
      item.setUnit(source.getUnit());
      item.setQuantity(source.getQuantity());
      item.setUnitPriceXof(source.getUnitPriceXof());
      item.setLineTotalXof(source.getLineTotalXof());
      // propagate PRODUCTION metadata so the stock cascade can consume the right unit/type
      item.setProductionUnitId(source.getProductionUnitId());
      item.setProductType(source.getProductType());
      delivery.addItem(item);
      total += source.getLineTotalXof();
    }
    delivery.setTotalXof(total);
    Delivery saved = deliveryRepository.save(delivery);

    // D21 / D27: decrement stock per delivered line.
    for (DeliveryItem item : saved.getItems()) {
      if (item.getArticleSource() == ArticleSource.PRODUCTION) {
        livestockFacade.consumeProduction(
            farmId,
            item.getProductType(),
            item.getProductionUnitId(),
            item.getQuantity().longValueExact());
      } else {
        recordStockMovement(
            farmId,
            item.getArticleSource(),
            item.getArticleKey(),
            MovementType.OUT,
            MovementReason.SALE,
            item.getQuantity(),
            item.getUnitPriceXof(),
            saved.getDeliveryDate(),
            "Delivery " + saved.getDeliveryNumber(),
            saved.getId(),
            userId);
      }
    }

    orderService.markDelivered(farmId, orderId, saved.getDeliveryDate(), userId);
    return saved;
  }

  /** DELIVERED → CANCELLED: reverse the stock (compensating IN / restock) and reopen the order. */
  @Transactional
  public Delivery cancel(Long farmId, Long deliveryId, String reason, Long userId) {
    Delivery delivery = load(farmId, deliveryId);
    if (delivery.getStatus() != DeliveryStatus.DELIVERED) {
      throw new BusinessRuleException(
          "INVALID_DELIVERY_TRANSITION",
          "Cannot cancel a delivery in status " + delivery.getStatus());
    }
    for (DeliveryItem item : delivery.getItems()) {
      if (item.getArticleSource() == ArticleSource.PRODUCTION) {
        livestockFacade.restockProduction(
            farmId,
            item.getProductType(),
            item.getProductionUnitId(),
            item.getQuantity().longValueExact());
      } else {
        recordStockMovement(
            farmId,
            item.getArticleSource(),
            item.getArticleKey(),
            MovementType.IN,
            MovementReason.ERROR_CORRECTION,
            item.getQuantity(),
            item.getUnitPriceXof(),
            LocalDate.now(),
            "Cancel delivery " + delivery.getDeliveryNumber(),
            delivery.getId(),
            userId);
      }
    }
    orderService.reopenForRedelivery(farmId, delivery.getOrder().getId(), userId);
    delivery.setStatus(DeliveryStatus.CANCELLED);
    delivery.setCancelledBy(userId);
    delivery.setCancelledAt(LocalDateTime.now());
    delivery.setCancellationReason(reason);
    return delivery;
  }

  @Transactional(readOnly = true)
  public Delivery getById(Long farmId, Long deliveryId) {
    return load(farmId, deliveryId);
  }

  @Transactional(readOnly = true)
  public List<Delivery> listForFarm(Long farmId, DeliveryStatus statusFilter) {
    return statusFilter != null
        ? deliveryRepository.findByFarmIdAndStatusOrderByDeliveryDateDescIdDesc(
            farmId, statusFilter)
        : deliveryRepository.findByFarmIdOrderByDeliveryDateDescIdDesc(farmId);
  }

  // --- internals ------------------------------------------------------

  private Delivery load(Long farmId, Long deliveryId) {
    return deliveryRepository
        .findByFarmIdAndId(farmId, deliveryId)
        .orElseThrow(() -> NotFoundException.of("Delivery", deliveryId));
  }

  private Order loadOrder(Long farmId, Long orderId) {
    return orderRepository
        .findByFarmIdAndId(farmId, orderId)
        .orElseThrow(() -> NotFoundException.of("Order", orderId));
  }

  private void recordStockMovement(
      Long farmId,
      ArticleSource source,
      String articleKey,
      MovementType type,
      MovementReason reason,
      BigDecimal quantity,
      Integer unitPriceXof,
      LocalDate date,
      String note,
      Long deliveryId,
      Long userId) {
    StockItem stockItem = stockItemService.createOrGet(farmId, source, articleKey, userId);
    StockMovement movement =
        stockMovementService.recordMovement(
            farmId,
            new StockMovementCommand(
                stockItem.getId(),
                type,
                quantity,
                reason,
                date,
                null,
                null,
                null,
                null,
                unitPriceXof,
                note,
                null),
            userId);
    movement.setDeliveryId(deliveryId);
  }

  private String generateDeliveryNumber(Long farmId, int year) {
    int next = deliveryRepository.findMaxSequence(farmId, "LIV-" + year + "-%") + 1;
    return String.format("LIV-%d-%03d", year, next);
  }
}
