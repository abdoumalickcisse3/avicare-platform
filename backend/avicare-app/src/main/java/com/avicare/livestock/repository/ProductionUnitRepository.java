package com.avicare.livestock.repository;

import com.avicare.livestock.domain.ProductionUnit;
import com.avicare.livestock.domain.UnitStatus;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Generic data access over the {@link ProductionUnit} hierarchy (JPA JOINED). Transverse contexts
 * query units by farm/status without knowing the species. Soft-deleted rows are filtered by the
 * entity's {@code @SQLRestriction}.
 */
public interface ProductionUnitRepository extends JpaRepository<ProductionUnit, Long> {

  List<ProductionUnit> findByFarmId(Long farmId);

  List<ProductionUnit> findByFarmIdAndStatus(Long farmId, UnitStatus status);
}
