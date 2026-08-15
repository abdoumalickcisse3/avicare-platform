package com.avicare.livestock.api;

import com.avicare.livestock.api.dto.InventoryStockInfo;
import com.avicare.livestock.api.dto.LowStockInfo;
import com.avicare.livestock.api.dto.SupplierInfo;
import java.util.List;
import java.util.Optional;

/**
 * Public, read-only surface of the inventory sub-domain for transverse contexts. Today it serves
 * the assistant's stock-adjustment dry-run (show the real "before → after" on the confirmation
 * card). Writes stay on the inventory REST endpoints; this facade never mutates.
 */
public interface InventoryFacade {

  /** Current stock of every active article on the farm. */
  List<InventoryStockInfo> listStock(Long farmId);

  /** Current stock for one article key, if the farm carries it. */
  Optional<InventoryStockInfo> findStock(Long farmId, String articleKey);

  /** Active suppliers of the farm (for resolving a spoken supplier name), ordered by name. */
  List<SupplierInfo> listSuppliers(Long farmId);

  /** Articles at or below their alert threshold on the farm (low-stock consultation). */
  List<LowStockInfo> lowStock(Long farmId);

  /**
   * Record a manual stock movement of {@code delta} on a stock item (positive = reception, negative
   * = loss), validated in {@code farmId}. Serves the assistant's server-side confirm path.
   */
  void recordStockMovement(Long farmId, Long stockItemId, long delta, Long userId);
}
