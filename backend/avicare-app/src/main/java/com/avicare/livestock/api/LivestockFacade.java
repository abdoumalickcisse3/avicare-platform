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
}
