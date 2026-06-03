package com.avicare.livestock.api;

import com.avicare.livestock.api.dto.ProductionUnitInfo;
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
}
