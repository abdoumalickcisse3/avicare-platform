package com.avicare.livestock.closure;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/** Access to the frozen end-of-cycle reports. At most one row per production unit. */
public interface UnitClosureRepository extends JpaRepository<UnitClosure, Long> {

  Optional<UnitClosure> findByProductionUnitId(Long productionUnitId);

  void deleteByProductionUnitId(Long productionUnitId);
}
