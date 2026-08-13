package com.avicare.livestock.inventory;

import com.avicare.livestock.api.InventoryFacade;
import com.avicare.livestock.api.dto.InventoryStockInfo;
import com.avicare.livestock.domain.StockItem;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Read-only inventory facade, delegating to {@link StockItemService}. Maps the {@code StockItem}
 * entity to the public {@link InventoryStockInfo} so transverse contexts never touch the entity.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class InventoryFacadeImpl implements InventoryFacade {

  private final StockItemService stockItems;

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

  private static InventoryStockInfo toInfo(StockItem item) {
    long qty = item.getCurrentQuantity() == null ? 0L : item.getCurrentQuantity().longValue();
    return new InventoryStockInfo(item.getArticleKey(), item.getUnit(), qty);
  }
}
