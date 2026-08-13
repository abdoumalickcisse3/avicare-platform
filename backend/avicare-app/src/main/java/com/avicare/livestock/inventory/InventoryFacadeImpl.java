package com.avicare.livestock.inventory;

import com.avicare.livestock.api.InventoryFacade;
import com.avicare.livestock.api.dto.InventoryStockInfo;
import com.avicare.livestock.api.dto.LowStockInfo;
import com.avicare.livestock.api.dto.SupplierInfo;
import com.avicare.livestock.domain.StockItem;
import com.avicare.livestock.domain.Supplier;
import com.avicare.livestock.inventory.StockAlertsResponse.LowStockItem;
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
        item.getArticleKey(), item.getArticleSource().name(), item.getUnit(), qty);
  }

  private static SupplierInfo toInfo(Supplier supplier) {
    return new SupplierInfo(supplier.getId(), supplier.getCommercialName());
  }
}
