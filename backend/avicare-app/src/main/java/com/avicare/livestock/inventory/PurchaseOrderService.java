package com.avicare.livestock.inventory;

import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.common.api.exception.NotFoundException;
import com.avicare.common.api.exception.ValidationException;
import com.avicare.livestock.domain.ArticleSource;
import com.avicare.livestock.domain.MovementReason;
import com.avicare.livestock.domain.MovementType;
import com.avicare.livestock.domain.PurchaseOrder;
import com.avicare.livestock.domain.PurchaseOrderItem;
import com.avicare.livestock.domain.PurchaseOrderStatus;
import com.avicare.livestock.domain.StockItem;
import com.avicare.livestock.domain.Supplier;
import com.avicare.livestock.repository.PurchaseOrderRepository;
import com.avicare.livestock.repository.SupplierRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Purchase order workflow (Sprint B4-3): {@code DRAFT → SENT → RECEIVED}, with {@code CANCELLED}
 * reachable from {@code DRAFT}/{@code SENT}. All transitions are guarded by {@link #requireStatus}
 * (illegal transition → {@link BusinessRuleException} 422). Reception is the business core: for
 * each received line it creates an {@code IN} stock movement (backref'd to the order) through
 * {@link StockMovementService}, all in one transaction — if any movement fails the whole reception
 * rolls back. Order numbers are minted {@code BC-YYYY-NNN} per farm per year (no lock in V1). RBAC
 * is enforced at the controller layer (B4-6).
 */
@Service
@RequiredArgsConstructor
public class PurchaseOrderService {

  private final PurchaseOrderRepository purchaseOrderRepository;
  private final SupplierRepository supplierRepository;
  private final InventoryCatalogService inventoryCatalogService;
  private final StockItemService stockItemService;
  private final StockMovementService stockMovementService;

  @Transactional
  public PurchaseOrder createDraft(Long farmId, PurchaseOrderDraftCommand cmd, Long userId) {
    Supplier supplier = loadSupplier(farmId, cmd.supplierId());
    requireLines(cmd.lines());

    PurchaseOrder po = new PurchaseOrder();
    po.setFarmId(farmId);
    po.setSupplier(supplier);
    po.setStatus(PurchaseOrderStatus.DRAFT);
    po.setOrderDate(cmd.orderDate() != null ? cmd.orderDate() : LocalDate.now());
    po.setExpectedDeliveryDate(cmd.expectedDeliveryDate());
    po.setNotes(cmd.notes());
    po.setCreatedBy(userId);
    po.setOrderNumber(generateOrderNumber(farmId, po.getOrderDate().getYear()));
    applyLines(po, cmd.lines());
    return purchaseOrderRepository.save(po);
  }

  @Transactional
  public PurchaseOrder updateDraft(
      Long farmId, Long poId, PurchaseOrderDraftCommand cmd, Long userId) {
    PurchaseOrder po = load(farmId, poId);
    requireStatus(po, PurchaseOrderStatus.DRAFT, "update");
    requireLines(cmd.lines());

    po.setSupplier(loadSupplier(farmId, cmd.supplierId()));
    if (cmd.orderDate() != null) {
      po.setOrderDate(cmd.orderDate());
    }
    po.setExpectedDeliveryDate(cmd.expectedDeliveryDate());
    po.setNotes(cmd.notes());
    po.getItems().clear(); // orphanRemoval deletes the old lines
    applyLines(po, cmd.lines());
    return po;
  }

  /** DRAFT → SENT. */
  @Transactional
  public PurchaseOrder submitToSupplier(Long farmId, Long poId, Long userId) {
    PurchaseOrder po = load(farmId, poId);
    requireStatus(po, PurchaseOrderStatus.DRAFT, "submit");
    po.setStatus(PurchaseOrderStatus.SENT);
    po.setSentBy(userId);
    po.setSentAt(LocalDateTime.now());
    return po;
  }

  /**
   * SENT → RECEIVED. For every line with a received quantity &gt; 0, creates a {@code RECEPTION_
   * PURCHASE} IN movement that cascades to the stock item — atomically.
   */
  @Transactional
  public PurchaseOrder receive(
      Long farmId, Long poId, PurchaseOrderReceiveCommand cmd, Long userId) {
    PurchaseOrder po = load(farmId, poId);
    requireStatus(po, PurchaseOrderStatus.SENT, "receive");

    Map<Long, BigDecimal> receipts = receiptsByItem(po, cmd);
    LocalDate deliveryDate =
        cmd.actualDeliveryDate() != null ? cmd.actualDeliveryDate() : LocalDate.now();

    for (PurchaseOrderItem item : po.getItems()) {
      BigDecimal received = receipts.getOrDefault(item.getId(), BigDecimal.ZERO);
      if (received.signum() < 0) {
        throw new ValidationException(
            "PO_RECEIVED_NEGATIVE",
            "Received quantity cannot be negative for line " + item.getId());
      }
      item.setReceivedQuantity(received);
      if (received.signum() > 0) {
        StockItem stockItem =
            stockItemService.createOrGet(
                farmId, item.getArticleSource(), item.getArticleKey(), userId);
        stockMovementService.recordMovement(
            farmId,
            new StockMovementCommand(
                stockItem.getId(),
                MovementType.IN,
                received,
                MovementReason.RECEPTION_PURCHASE,
                deliveryDate,
                null,
                null,
                null,
                null,
                item.getUnitPriceXof(),
                "PO " + po.getOrderNumber(),
                po.getId()),
            userId);
      }
    }

    po.setStatus(PurchaseOrderStatus.RECEIVED);
    po.setActualDeliveryDate(deliveryDate);
    po.setReceivedBy(userId);
    po.setReceivedAt(LocalDateTime.now());
    return po;
  }

  /** DRAFT or SENT → CANCELLED. */
  @Transactional
  public PurchaseOrder cancel(Long farmId, Long poId, String reason, Long userId) {
    PurchaseOrder po = load(farmId, poId);
    if (po.getStatus() != PurchaseOrderStatus.DRAFT && po.getStatus() != PurchaseOrderStatus.SENT) {
      throw new BusinessRuleException(
          "INVALID_PO_TRANSITION", "Cannot cancel a purchase order in status " + po.getStatus());
    }
    po.setStatus(PurchaseOrderStatus.CANCELLED);
    po.setCancelledBy(userId);
    po.setCancelledAt(LocalDateTime.now());
    po.setCancellationReason(reason);
    return po;
  }

  @Transactional(readOnly = true)
  public PurchaseOrder getById(Long farmId, Long poId) {
    return load(farmId, poId);
  }

  @Transactional(readOnly = true)
  public List<PurchaseOrder> listForFarm(Long farmId, PurchaseOrderStatus statusFilter) {
    return statusFilter != null
        ? purchaseOrderRepository.findByFarmIdAndStatusOrderByOrderDateDescIdDesc(
            farmId, statusFilter)
        : purchaseOrderRepository.findByFarmIdOrderByOrderDateDescIdDesc(farmId);
  }

  // --- internals ------------------------------------------------------

  private PurchaseOrder load(Long farmId, Long poId) {
    return purchaseOrderRepository
        .findByFarmIdAndId(farmId, poId)
        .orElseThrow(() -> NotFoundException.of("PurchaseOrder", poId));
  }

  private Supplier loadSupplier(Long farmId, Long supplierId) {
    return supplierRepository
        .findByFarmIdAndId(farmId, supplierId)
        .orElseThrow(() -> NotFoundException.of("Supplier", supplierId));
  }

  private static void requireLines(List<PurchaseOrderDraftCommand.Line> lines) {
    if (lines == null || lines.isEmpty()) {
      throw new ValidationException("PO_NO_LINES", "A purchase order needs at least one line");
    }
  }

  private void applyLines(PurchaseOrder po, List<PurchaseOrderDraftCommand.Line> lines) {
    Map<String, InventoryCatalogItemDto> catalog =
        inventoryCatalogService.listAllAvailableArticles().stream()
            .collect(
                Collectors.toMap(
                    d -> catalogKey(d.articleSource(), d.articleKey()),
                    Function.identity(),
                    (a, b) -> a));
    long total = 0;
    for (PurchaseOrderDraftCommand.Line line : lines) {
      if (line.orderedQuantity() == null || line.orderedQuantity().signum() <= 0) {
        throw new ValidationException(
            "PO_LINE_QUANTITY", "Ordered quantity must be greater than 0");
      }
      if (line.unitPriceXof() == null || line.unitPriceXof() < 0) {
        throw new ValidationException("PO_LINE_PRICE", "Unit price must be 0 or more");
      }
      InventoryCatalogItemDto article =
          catalog.get(catalogKey(line.articleSource(), line.articleKey()));
      if (article == null) {
        throw new NotFoundException(
            "ARTICLE_NOT_FOUND",
            "Unknown article " + line.articleKey() + " (source " + line.articleSource() + ")");
      }
      PurchaseOrderItem item = new PurchaseOrderItem();
      item.setArticleKey(line.articleKey());
      item.setArticleSource(line.articleSource());
      item.setArticleLabelSnapshot(article.label());
      item.setUnit(article.unit());
      item.setOrderedQuantity(line.orderedQuantity());
      item.setUnitPriceXof(line.unitPriceXof());
      long lineTotal = lineTotal(line.orderedQuantity(), line.unitPriceXof());
      item.setLineTotalXof(lineTotal);
      item.setNotes(line.notes());
      po.addItem(item);
      total += lineTotal;
    }
    po.setTotalXof(total);
  }

  private Map<Long, BigDecimal> receiptsByItem(PurchaseOrder po, PurchaseOrderReceiveCommand cmd) {
    if (cmd.lines() == null) {
      return Map.of();
    }
    Set<Long> itemIds = new HashSet<>();
    po.getItems().forEach(i -> itemIds.add(i.getId()));
    Map<Long, BigDecimal> receipts = new HashMap<>();
    for (PurchaseOrderReceiveCommand.LineReceipt receipt : cmd.lines()) {
      if (!itemIds.contains(receipt.itemId())) {
        throw new ValidationException(
            "PO_RECEIPT_UNKNOWN_LINE",
            "Line " + receipt.itemId() + " does not belong to this purchase order");
      }
      receipts.put(receipt.itemId(), receipt.receivedQuantity());
    }
    return receipts;
  }

  private String generateOrderNumber(Long farmId, int year) {
    int next = purchaseOrderRepository.findMaxSequence(farmId, "BC-" + year + "-%") + 1;
    return String.format("BC-%d-%03d", year, next);
  }

  private static String catalogKey(ArticleSource source, String articleKey) {
    return source + ":" + articleKey;
  }

  private static long lineTotal(BigDecimal orderedQuantity, Integer unitPriceXof) {
    return orderedQuantity
        .multiply(BigDecimal.valueOf(unitPriceXof))
        .setScale(0, RoundingMode.HALF_UP)
        .longValueExact();
  }

  private static void requireStatus(PurchaseOrder po, PurchaseOrderStatus expected, String action) {
    if (po.getStatus() != expected) {
      throw new BusinessRuleException(
          "INVALID_PO_TRANSITION",
          "Cannot " + action + " a purchase order in status " + po.getStatus());
    }
  }
}
