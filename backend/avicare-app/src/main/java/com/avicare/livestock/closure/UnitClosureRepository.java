package com.avicare.livestock.closure;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/** Access to the frozen end-of-cycle reports. At most one row per production unit. */
public interface UnitClosureRepository extends JpaRepository<UnitClosure, Long> {

  Optional<UnitClosure> findByProductionUnitId(Long productionUnitId);

  /** Every closed cycle of a farm, most recently ended first — the comparison table. */
  List<UnitClosure> findByFarmIdOrderByEndDateDescIdDesc(Long farmId);

  void deleteByProductionUnitId(Long productionUnitId);
}
