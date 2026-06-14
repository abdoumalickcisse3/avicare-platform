package com.avicare.livestock.inventory;

import com.avicare.livestock.domain.PurchaseOrder;
import com.avicare.livestock.domain.PurchaseOrderStatus;
import com.avicare.livestock.domain.StockItem;
import com.avicare.livestock.domain.StockMovement;
import com.avicare.livestock.inventory.InventoryAlertsResponse.PendingPurchaseOrderItem;
import com.avicare.livestock.inventory.StockAlertsResponse.LowStockItem;
import com.avicare.livestock.inventory.StockAlertsResponse.NegativeStockItem;
import com.avicare.livestock.inventory.StockAlertsResponse.RecentMovementItem;
import com.avicare.livestock.repository.StockItemRepository;
import com.avicare.livestock.repository.StockMovementRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Compute-on-read stock alerts for a farm (Sprint B4-2) — same pattern as the health {@code
 * AlertService}, but dedicated to the inventory context (no coupling into the health service).
 * Labels are resolved from the unified catalog; the dashboard layer (C2) will consolidate stock and
 * health alerts.
 */
@Service
@RequiredArgsConstructor
public class InventoryAlertService {

  private static final int RECENT_MOVEMENTS_LIMIT = 10;

  private final StockItemRepository stockItemRepository;
  private final StockMovementRepository stockMovementRepository;
  private final InventoryCatalogService inventoryCatalogService;
  private final PurchaseOrderService purchaseOrderService;

  /**
   * The full inventory alert set (Sprint B4-6): the stock alerts plus purchase orders that are
   * {@code SENT} but past their expected delivery date.
   */
  @Transactional(readOnly = true)
  public InventoryAlertsResponse computeInventoryAlerts(Long farmId) {
    StockAlertsResponse stock = computeStockAlertsForFarm(farmId);
    LocalDate today = LocalDate.now();
    List<PendingPurchaseOrderItem> pending =
        purchaseOrderService.listForFarm(farmId, PurchaseOrderStatus.SENT).stream()
            .filter(po -> po.getExpectedDeliveryDate() != null)
            .filter(po -> po.getExpectedDeliveryDate().isBefore(today))
            .map(po -> toPending(po, today))
            .toList();
    return new InventoryAlertsResponse(
        stock.lowStockItems(), stock.negativeStockItems(), pending, stock.recentMovements());
  }

  @Transactional(readOnly = true)
  public StockAlertsResponse computeStockAlertsForFarm(Long farmId) {
    Map<String, String> labels =
        inventoryCatalogService.listAllAvailableArticles().stream()
            .collect(
                Collectors.toMap(
                    InventoryCatalogItemDto::articleKey,
                    InventoryCatalogItemDto::label,
                    (a, b) -> a));

    List<LowStockItem> low =
        stockItemRepository.findLowStockByFarmId(farmId).stream()
            .map(s -> toLow(s, labels))
            .toList();

    List<NegativeStockItem> negative =
        stockItemRepository
            .findByFarmIdAndActiveTrueAndCurrentQuantityLessThanOrderByArticleKey(
                farmId, BigDecimal.ZERO)
            .stream()
            .map(
                s ->
                    new NegativeStockItem(
                        s.getId(),
                        s.getArticleKey(),
                        labels.get(s.getArticleKey()),
                        s.getCurrentQuantity(),
                        s.getUnit()))
            .toList();

    List<RecentMovementItem> recent =
        stockMovementRepository.findByStockItem_FarmIdOrderByMovementDateDescIdDesc(farmId).stream()
            .limit(RECENT_MOVEMENTS_LIMIT)
            .map(InventoryAlertService::toRecent)
            .toList();

    return new StockAlertsResponse(low, negative, recent);
  }

  private static PendingPurchaseOrderItem toPending(PurchaseOrder po, LocalDate today) {
    return new PendingPurchaseOrderItem(
        po.getId(),
        po.getOrderNumber(),
        po.getSupplier().getId(),
        po.getSupplier().getCommercialName(),
        po.getExpectedDeliveryDate(),
        ChronoUnit.DAYS.between(po.getExpectedDeliveryDate(), today),
        po.getTotalXof());
  }

  private static LowStockItem toLow(StockItem s, Map<String, String> labels) {
    BigDecimal threshold = s.getAlertThreshold();
    BigDecimal percentBelow = null;
    if (threshold != null && threshold.signum() > 0) {
      percentBelow =
          threshold
              .subtract(s.getCurrentQuantity())
              .multiply(BigDecimal.valueOf(100))
              .divide(threshold, 1, RoundingMode.HALF_UP);
    }
    return new LowStockItem(
        s.getId(),
        s.getArticleKey(),
        labels.get(s.getArticleKey()),
        s.getCurrentQuantity(),
        threshold,
        s.getUnit(),
        percentBelow);
  }

  private static RecentMovementItem toRecent(StockMovement m) {
    return new RecentMovementItem(
        m.getId(),
        m.getStockItem().getId(),
        m.getStockItem().getArticleKey(),
        m.getMovementType(),
        m.getQuantity(),
        m.getQuantityAfter(),
        m.getMovementDate());
  }
}
