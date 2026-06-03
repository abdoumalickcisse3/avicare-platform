package com.avicare.livestock.service;

import com.avicare.livestock.api.LivestockFacade;
import com.avicare.livestock.api.dto.ProductionUnitInfo;
import com.avicare.livestock.domain.ProductionUnit;
import com.avicare.livestock.domain.UnitStatus;
import com.avicare.livestock.repository.ProductionUnitRepository;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Default {@link LivestockFacade} implementation. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class LivestockFacadeImpl implements LivestockFacade {

  private final ProductionUnitRepository productionUnitRepository;

  @Override
  public Optional<ProductionUnitInfo> findUnit(Long unitId) {
    return productionUnitRepository.findById(unitId).map(LivestockFacadeImpl::toInfo);
  }

  @Override
  public List<ProductionUnitInfo> listFarmUnits(Long farmId) {
    return productionUnitRepository.findByFarmId(farmId).stream()
        .map(LivestockFacadeImpl::toInfo)
        .toList();
  }

  @Override
  public long countActiveUnits(Long farmId) {
    return productionUnitRepository.findByFarmIdAndStatus(farmId, UnitStatus.ACTIVE).size();
  }

  private static ProductionUnitInfo toInfo(ProductionUnit u) {
    return new ProductionUnitInfo(
        u.getId(),
        u.getFarmId(),
        u.getSpecies(),
        u.getUnitKind(),
        u.getBreedId(),
        u.getCurrentCount(),
        u.getStatus());
  }
}
