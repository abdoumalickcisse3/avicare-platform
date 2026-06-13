package com.avicare.livestock.inventory;

import com.avicare.livestock.domain.StockItem;
import com.avicare.livestock.domain.StockMovement;
import com.avicare.livestock.inventory.StockAlertsResponse.LowStockItem;
import com.avicare.livestock.inventory.StockAlertsResponse.NegativeStockItem;
import com.avicare.livestock.inventory.StockAlertsResponse.RecentMovementItem;
import com.avicare.livestock.repository.StockItemRepository;
import com.avicare.livestock.repository.StockMovementRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
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
