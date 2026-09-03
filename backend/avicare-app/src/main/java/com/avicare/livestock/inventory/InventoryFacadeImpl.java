package com.avicare.livestock.inventory;

import com.avicare.livestock.api.InventoryFacade;
import com.avicare.livestock.api.dto.InventoryAlertInfo;
import com.avicare.livestock.api.dto.InventoryStats;
import com.avicare.livestock.api.dto.InventoryStockInfo;
import com.avicare.livestock.api.dto.LowStockInfo;
import com.avicare.livestock.api.dto.SupplierInfo;
import com.avicare.livestock.domain.MovementReason;
import com.avicare.livestock.domain.MovementType;
import com.avicare.livestock.domain.StockItem;
import com.avicare.livestock.domain.Supplier;
import com.avicare.livestock.inventory.StockAlertsResponse.LowStockItem;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Read-only inventory facade, delegating to {@link StockItemService} and {@link SupplierService}.
 * Maps the {@code StockItem} / {@code Supplier} entities to the public {@link InventoryStockInfo} /
 * {@link SupplierInfo} so transverse contexts never touch the entities.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class InventoryFacadeImpl implements InventoryFacade {

  private final StockItemService stockItems;
  private final SupplierService suppliers;
  private final InventoryAlertService inventoryAlertService;
  private final StockMovementService stockMovementService;

  @Override
  public List<InventoryStockInfo> listStock(Long farmId) {
    return stockItems.listForFarm(farmId).stream().map(InventoryFacadeImpl::toInfo).toList();
  }

  @Override
  public Optional<InventoryStockInfo> findStock(Long farmId, String articleKey) {
    return stockItems.listForFarm(farmId).stream()
        .filter(s -> articleKey.equals(s.getArticleKey()))
        .findFirst()
        .map(InventoryFacadeImpl::toInfo);
  }

  @Override
  public List<SupplierInfo> listSuppliers(Long farmId) {
    return suppliers.listForFarm(farmId).stream().map(InventoryFacadeImpl::toInfo).toList();
  }

  @Override
  public List<LowStockInfo> lowStock(Long farmId) {
    return inventoryAlertService.computeStockAlertsForFarm(farmId).lowStockItems().stream()
        .map(InventoryFacadeImpl::toInfo)
        .toList();
  }

  @Override
  public InventoryStats inventoryStats(Long farmId, LocalDate from, LocalDate to) {
    StockValuationResponse valuation = stockMovementService.getStockValuation(farmId);
    int totalArticles = stockItems.listForFarm(farmId).size();
    long lowStockCount =
        inventoryAlertService.computeStockAlertsForFarm(farmId).lowStockItems().size();

    // Consumption is recorded in quantities, never in XOF, so it is valued here through the
    // shared rule — the same one the end-of-cycle report uses, so the two never disagree.
    long consumedValueXof =
        stockMovementService.outMovementsForFarmBetween(farmId, from, to).stream()
            .map(StockValuation::valueOf)
            .filter(java.util.Objects::nonNull)
            .mapToLong(Long::longValue)
            .sum();

    return new InventoryStats(
        lowStockCount,
        valuation.totalValueXof(),
        valuation.items().size(),
        totalArticles,
        consumedValueXof);
  }

  @Override
  public List<InventoryAlertInfo> inventoryAlerts(Long farmId) {
    InventoryAlertsResponse alerts = inventoryAlertService.computeInventoryAlerts(farmId);
    List<InventoryAlertInfo> out = new ArrayList<>();
    alerts
        .lowStockItems()
        .forEach(i -> out.add(new InventoryAlertInfo("LOW_STOCK", i.stockItemId(), i.label(), 0L)));
    alerts
        .negativeStockItems()
        .forEach(
            i -> out.add(new InventoryAlertInfo("NEGATIVE_STOCK", i.stockItemId(), i.label(), 0L)));
    alerts
        .pendingPurchaseOrders()
        .forEach(
            po ->
                out.add(
                    new InventoryAlertInfo(
                        "PO_OVERDUE", po.purchaseOrderId(), po.orderNumber(), po.daysOverdue())));
    return out;
  }

  @Override
  @Transactional
  public void recordStockMovement(Long farmId, Long stockItemId, long delta, Long userId) {
    boolean reception = delta >= 0;
    StockMovementCommand cmd =
        new StockMovementCommand(
            stockItemId,
            reception ? MovementType.IN : MovementType.OUT,
            BigDecimal.valueOf(Math.abs(delta)),
            reception ? MovementReason.RECEPTION_PURCHASE : MovementReason.LOSS,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null);
    stockMovementService.recordMovement(farmId, cmd, userId);
  }

  private static LowStockInfo toInfo(LowStockItem item) {
    return new LowStockInfo(
        item.articleKey(),
        item.label(),
        item.currentQuantity() == null ? 0L : item.currentQuantity().longValue(),
        item.alertThreshold() == null ? 0L : item.alertThreshold().longValue(),
        item.unit());
  }

  private static InventoryStockInfo toInfo(StockItem item) {
    long qty = item.getCurrentQuantity() == null ? 0L : item.getCurrentQuantity().longValue();
    return new InventoryStockInfo(
        item.getId(), item.getArticleKey(), item.getArticleSource().name(), item.getUnit(), qty);
  }

  private static SupplierInfo toInfo(Supplier supplier) {
    return new SupplierInfo(supplier.getId(), supplier.getCommercialName());
  }
}
