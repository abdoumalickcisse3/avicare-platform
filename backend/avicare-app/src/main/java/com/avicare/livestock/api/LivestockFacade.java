package com.avicare.livestock.api;

import com.avicare.livestock.api.dto.LivestockStats;
import com.avicare.livestock.api.dto.ProductionUnitInfo;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * Public contract of the livestock bounded context (doc 03 §4). Transverse business contexts read
 * production units through this facade, species-agnostically.
 */
public interface LivestockFacade {

  Optional<ProductionUnitInfo> findUnit(Long unitId);

  List<ProductionUnitInfo> listFarmUnits(Long farmId);

  long countActiveUnits(Long farmId);

  /**
   * Aggregated livestock dashboard stats for {@code farmId}. Snapshot KPIs ({@code activeBatches},
   * {@code totalHeadcount}) ignore the period; period KPIs honour the inclusive {@code [from, to]}
   * window.
   */
  LivestockStats livestockStats(Long farmId, LocalDate from, LocalDate to);

  /**
   * Returns the quantity of {@code type} available on {@code farmId}: heads (BROILER, from {@code
   * production_units.current_count} of the given unit) or full trays (EGGS, farm-wide pool). {@code
   * unitId} is ignored for EGGS.
   */
  long productionAvailable(Long farmId, ProductType type, Long unitId);

  /**
   * Blocking decrement (D27): deducts {@code qty} units of production. Throws HTTP-422 {@code
   * PRODUCTION_INSUFFICIENT} when quantity is unavailable; {@code PRODUCTION_UNIT_NOT_OPEN} when
   * the unit is CLOSED/CANCELLED (BROILER only); {@code PRODUCTION_TYPE_MISMATCH} when the unit's
   * species does not match the requested type.
   */
  void consumeProduction(Long farmId, ProductType type, Long unitId, long qty);

  /**
   * Cancels a previous {@link #consumeProduction}: re-increments the stock by {@code qty}. For
   * BROILER, records a SALE_CANCEL lifecycle event. For EGGS, adds trays back to the farm pool.
   */
  void restockProduction(Long farmId, ProductType type, Long unitId, long qty);

  /** Initial headcount of a unit = sum of CREATED lifecycle event deltas (0 if none). */
  long initialCountOf(Long unitId);
}
