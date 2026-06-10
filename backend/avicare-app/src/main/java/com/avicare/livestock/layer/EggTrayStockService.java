package com.avicare.livestock.layer;

import com.avicare.common.api.exception.ValidationException;
import com.avicare.livestock.domain.EggTrayStock;
import com.avicare.livestock.repository.EggTrayStockRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Farm-scoped egg tray inventory (Sprint B2-1). One row per farm, auto-created on first access. In
 * V1 the stock is maintained manually (no automatic decrement from egg collections) — this service
 * is just data entry / consultation, enforcing the non-negative invariant.
 */
@Service
@RequiredArgsConstructor
public class EggTrayStockService {

  private final EggTrayStockRepository eggTrayStockRepository;

  /** The farm's tray stock, creating an empty row on first access. */
  @Transactional
  public EggTrayStock getOrCreateForFarm(Long farmId) {
    return eggTrayStockRepository
        .findByFarmId(farmId)
        .orElseGet(
            () -> {
              EggTrayStock stock = new EggTrayStock();
              stock.setFarmId(farmId);
              return eggTrayStockRepository.save(stock);
            });
  }

  /** Apply signed deltas to the full/empty tray counts; rejects any result below 0. */
  @Transactional
  public EggTrayStock adjustStock(Long farmId, int fullDelta, int emptyDelta) {
    EggTrayStock stock = getOrCreateForFarm(farmId);
    int newFull = stock.getFullTraysCount() + fullDelta;
    int newEmpty = stock.getEmptyTraysCount() + emptyDelta;
    requireNonNegative(newFull, newEmpty);
    stock.setFullTraysCount(newFull);
    stock.setEmptyTraysCount(newEmpty);
    return stock;
  }

  /** Set the farm's tray stock to exact values (both must be &gt;= 0). */
  @Transactional
  public EggTrayStock record(Long farmId, EggTrayStockUpdate cmd) {
    requireNonNegative(cmd.fullTraysCount(), cmd.emptyTraysCount());
    EggTrayStock stock = getOrCreateForFarm(farmId);
    stock.setFullTraysCount(cmd.fullTraysCount());
    stock.setEmptyTraysCount(cmd.emptyTraysCount());
    return stock;
  }

  private void requireNonNegative(int full, int empty) {
    if (full < 0 || empty < 0) {
      throw new ValidationException(
          "TRAY_STOCK_BELOW_ZERO",
          "Tray counts cannot go below 0 (full=" + full + ", empty=" + empty + ")");
    }
  }
}
