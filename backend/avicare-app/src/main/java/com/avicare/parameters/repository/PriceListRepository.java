package com.avicare.parameters.repository;

import com.avicare.parameters.domain.PriceList;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Data access for {@link PriceList}. Soft-deleted rows are filtered out automatically by the
 * entity's {@code @SQLRestriction}.
 */
public interface PriceListRepository extends JpaRepository<PriceList, Long> {

  List<PriceList> findByFarmId(Long farmId);

  // Property name is 'defaultList' (column is_default) — derived from the field, not the column.
  Optional<PriceList> findByFarmIdAndDefaultListTrue(Long farmId);
}
