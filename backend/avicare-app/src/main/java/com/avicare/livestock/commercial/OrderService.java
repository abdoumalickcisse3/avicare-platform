package com.avicare.livestock.commercial;

import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.common.api.exception.NotFoundException;
import com.avicare.common.api.exception.ValidationException;
import com.avicare.livestock.api.ProductType;
import com.avicare.livestock.domain.ArticleSource;
import com.avicare.livestock.domain.Client;
import com.avicare.livestock.domain.Order;
import com.avicare.livestock.domain.OrderItem;
import com.avicare.livestock.domain.OrderStatus;
import com.avicare.livestock.inventory.InventoryCatalogItemDto;
import com.avicare.livestock.inventory.InventoryCatalogService;
import com.avicare.livestock.repository.ClientRepository;
import com.avicare.livestock.repository.OrderRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Sales order workflow (Sprint B5-1): a strict 5-state machine {@code PENDING → CONFIRMED →
 * IN_PROGRESS → DELIVERED}, with {@code CANCELLED} reachable from any non-terminal state (D23). All
 * transitions are guarded (illegal transition → {@link BusinessRuleException} 422). Order numbers
 * are minted {@code ORD-YYYY-NNN} per farm per year (D24, no lock in V1). Lines may reference a
 * sellable PRODUCT-subcategory catalog article (INVENTORY/TREATMENT) or a PRODUCTION unit (D27).
 * Label and unit are snapshot at order time. Totals are HT only (D25). Delivery does NOT touch
 * stock here — that cascade lands in B5-2 / D27 via {@link DeliveryService}; {@link #markDelivered}
 * only flips the status. Credit is never checked as a blocker (D26 — see {@link
 * ClientService#projectCredit}). RBAC is enforced at the controller layer (B5-5).
 */
@Service
@RequiredArgsConstructor
public class OrderService {

  private static final String PRODUCT_SUBCATEGORY = "PRODUCT";

  private final OrderRepository orderRepository;
  private final ClientRepository clientRepository;
  private final InventoryCatalogService inventoryCatalogService;

  @Transactional
  public Order createDraft(Long farmId, OrderDraftCommand cmd, Long userId) {
    Client client = loadClient(farmId, cmd.clientId());
    requireLines(cmd.lines());

    Order order = new Order();
    order.setFarmId(farmId);
    order.setClient(client);
    order.setStatus(OrderStatus.PENDING);
    order.setOrderDate(cmd.orderDate() != null ? cmd.orderDate() : LocalDate.now());
    order.setExpectedDeliveryDate(cmd.expectedDeliveryDate());
    order.setDeliveryAddress(cmd.deliveryAddress());
    order.setDeliveryNotes(cmd.deliveryNotes());
    order.setExpectedPaymentMethod(cmd.expectedPaymentMethod());
    order.setExpectedPaymentDueDate(cmd.expectedPaymentDueDate());
    order.setNotes(cmd.notes());
    order.setCreatedBy(userId);
    order.setOrderNumber(generateOrderNumber(farmId, order.getOrderDate().getYear()));
    applyLines(farmId, order, cmd.lines());
    return orderRepository.save(order);
  }

  /** PENDING → CONFIRMED. */
  @Transactional
  public Order confirm(Long farmId, Long orderId, Long userId) {
    Order order = load(farmId, orderId);
    requireStatus(order, OrderStatus.PENDING, "confirm");
    order.setStatus(OrderStatus.CONFIRMED);
    order.setConfirmedBy(userId);
    order.setConfirmedAt(LocalDateTime.now());
    return order;
  }

  /** CONFIRMED → IN_PROGRESS. */
  @Transactional
  public Order markInProgress(Long farmId, Long orderId, Long userId) {
    Order order = load(farmId, orderId);
    requireStatus(order, OrderStatus.CONFIRMED, "start preparing");
    order.setStatus(OrderStatus.IN_PROGRESS);
    return order;
  }

  /** IN_PROGRESS → DELIVERED. In B5-1 this only flips status; the stock cascade lands in B5-2. */
  @Transactional
  public Order markDelivered(Long farmId, Long orderId, LocalDate actualDeliveryDate, Long userId) {
    Order order = load(farmId, orderId);
    requireStatus(order, OrderStatus.IN_PROGRESS, "deliver");
    order.setStatus(OrderStatus.DELIVERED);
    order.setActualDeliveryDate(actualDeliveryDate != null ? actualDeliveryDate : LocalDate.now());
    order.setDeliveredBy(userId);
    order.setDeliveredAt(LocalDateTime.now());
    return order;
  }

  /**
   * DELIVERED → IN_PROGRESS. Used when a delivery is cancelled (B5-2): the order reopens so it can
   * be delivered again. Not a public workflow step.
   */
  @Transactional
  public Order reopenForRedelivery(Long farmId, Long orderId, Long userId) {
    Order order = load(farmId, orderId);
    requireStatus(order, OrderStatus.DELIVERED, "reopen");
    order.setStatus(OrderStatus.IN_PROGRESS);
    order.setDeliveredBy(null);
    order.setDeliveredAt(null);
    order.setActualDeliveryDate(null);
    return order;
  }

  /** PENDING / CONFIRMED / IN_PROGRESS → CANCELLED (never from DELIVERED or CANCELLED). */
  @Transactional
  public Order cancel(Long farmId, Long orderId, String reason, Long userId) {
    Order order = load(farmId, orderId);
    if (order.getStatus() == OrderStatus.DELIVERED || order.getStatus() == OrderStatus.CANCELLED) {
      throw new BusinessRuleException(
          "INVALID_ORDER_TRANSITION", "Cannot cancel an order in status " + order.getStatus());
    }
    order.setStatus(OrderStatus.CANCELLED);
    order.setCancelledBy(userId);
    order.setCancelledAt(LocalDateTime.now());
    order.setCancellationReason(reason);
    return order;
  }

  @Transactional(readOnly = true)
  public Order getById(Long farmId, Long orderId) {
    return load(farmId, orderId);
  }

  @Transactional(readOnly = true)
  public List<Order> listForFarm(Long farmId, OrderStatus statusFilter) {
    return statusFilter != null
        ? orderRepository.findByFarmIdAndStatusOrderByOrderDateDescIdDesc(farmId, statusFilter)
        : orderRepository.findByFarmIdOrderByOrderDateDescIdDesc(farmId);
  }

  @Transactional(readOnly = true)
  public List<Order> listForClient(Long farmId, Long clientId) {
    return orderRepository.findByFarmIdAndClientIdOrderByOrderDateDescIdDesc(farmId, clientId);
  }

  // --- internals ------------------------------------------------------

  private Order load(Long farmId, Long orderId) {
    return orderRepository
        .findByFarmIdAndId(farmId, orderId)
        .orElseThrow(() -> NotFoundException.of("Order", orderId));
  }

  private Client loadClient(Long farmId, Long clientId) {
    return clientRepository
        .findByFarmIdAndId(farmId, clientId)
        .orElseThrow(() -> NotFoundException.of("Client", clientId));
  }

  private static void requireLines(List<OrderDraftCommand.Line> lines) {
    if (lines == null || lines.isEmpty()) {
      throw new ValidationException("ORDER_NO_LINES", "An order needs at least one line");
    }
  }

  private void applyLines(Long farmId, Order order, List<OrderDraftCommand.Line> lines) {
    Map<String, InventoryCatalogItemDto> catalog =
        inventoryCatalogService.listInventoryArticles(farmId).stream()
            .collect(
                Collectors.toMap(
                    InventoryCatalogItemDto::articleKey, Function.identity(), (a, b) -> a));
    long total = 0;
    for (OrderDraftCommand.Line line : lines) {
      if (line.quantity() == null || line.quantity().signum() <= 0) {
        throw new ValidationException("ORDER_LINE_QUANTITY", "Quantity must be greater than 0");
      }
      if (line.unitPriceXof() == null || line.unitPriceXof() < 0) {
        throw new ValidationException("ORDER_LINE_PRICE", "Unit price must be 0 or more");
      }
      OrderItem item = new OrderItem();
      if (line.articleSource() == ArticleSource.PRODUCTION) {
        validateProductionLine(line);
        item.setArticleKey(line.articleKey());
        item.setArticleSource(ArticleSource.PRODUCTION);
        item.setArticleLabelSnapshot(productionLabelFor(line.productType()));
        item.setUnit(productionUnitFor(line.productType()));
        item.setProductionUnitId(line.productionUnitId());
        item.setProductType(line.productType());
      } else {
        InventoryCatalogItemDto article = catalog.get(line.articleKey());
        if (article == null) {
          throw new NotFoundException("ARTICLE_NOT_FOUND", "Unknown article " + line.articleKey());
        }
        if (!PRODUCT_SUBCATEGORY.equals(article.subcategory())) {
          throw new ValidationException(
              "ARTICLE_NOT_SELLABLE",
              "Article " + line.articleKey() + " is not a product and cannot be sold");
        }
        item.setArticleKey(line.articleKey());
        item.setArticleSource(line.articleSource());
        item.setArticleLabelSnapshot(article.label());
        item.setUnit(article.unit());
      }
      item.setQuantity(line.quantity());
      item.setUnitPriceXof(line.unitPriceXof());
      long lineTotal = lineTotal(line.quantity(), line.unitPriceXof());
      item.setLineTotalXof(lineTotal);
      item.setNotes(line.notes());
      order.addItem(item);
      total += lineTotal;
    }
    order.setTotalXof(total);
  }

  private static void validateProductionLine(OrderDraftCommand.Line line) {
    if (line.productType() == null) {
      throw new BusinessRuleException(
          "PRODUCTION_LINE_TYPE_REQUIRED", "productType is required for PRODUCTION lines");
    }
    if (line.productType() == ProductType.BROILER && line.productionUnitId() == null) {
      throw new BusinessRuleException(
          "PRODUCTION_LINE_UNIT_REQUIRED", "productionUnitId is required for BROILER lines");
    }
    if (line.productType() == ProductType.EGGS && line.productionUnitId() != null) {
      throw new BusinessRuleException(
          "PRODUCTION_LINE_UNIT_FORBIDDEN", "productionUnitId must be null for EGGS lines");
    }
    if (line.quantity().stripTrailingZeros().scale() > 0) {
      throw new BusinessRuleException(
          "PRODUCTION_LINE_QUANTITY_INTEGER",
          "Quantity must be a whole number for PRODUCTION lines");
    }
  }

  private static String productionUnitFor(ProductType type) {
    return type == ProductType.BROILER ? "tête" : "plateau";
  }

  private static String productionLabelFor(ProductType type) {
    return type == ProductType.BROILER ? "Poulet de chair" : "Œufs";
  }

  private String generateOrderNumber(Long farmId, int year) {
    int next = orderRepository.findMaxSequence(farmId, "ORD-" + year + "-%") + 1;
    return String.format("ORD-%d-%03d", year, next);
  }

  private static long lineTotal(BigDecimal quantity, Integer unitPriceXof) {
    return quantity
        .multiply(BigDecimal.valueOf(unitPriceXof))
        .setScale(0, RoundingMode.HALF_UP)
        .longValueExact();
  }

  private static void requireStatus(Order order, OrderStatus expected, String action) {
    if (order.getStatus() != expected) {
      throw new BusinessRuleException(
          "INVALID_ORDER_TRANSITION",
          "Cannot " + action + " an order in status " + order.getStatus());
    }
  }
}
