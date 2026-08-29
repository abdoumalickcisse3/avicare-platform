package com.avicare.livestock.repository;

import com.avicare.livestock.domain.PoultryBatch;
import com.avicare.livestock.domain.UnitStatus;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Data access for {@link PoultryBatch} (the broiler extension table joined onto {@code
 * production_units}). Queries on inherited fields (farm, status) are derived; soft-deleted units
 * are filtered by the parent's {@code @SQLRestriction}.
 */
public interface PoultryBatchRepository extends JpaRepository<PoultryBatch, Long> {

  List<PoultryBatch> findByFarmId(Long farmId);

  List<PoultryBatch> findByFarmIdAndStatus(Long farmId, UnitStatus status);

  /** All batches across the farms the caller can access (tenant scoping done by the caller). */
  @Query("SELECT b FROM PoultryBatch b WHERE b.farmId IN :farmIds")
  List<PoultryBatch> findAccessibleBatches(@Param("farmIds") List<Long> farmIds);

  /** Birds placed per farm — the denominator of the mortality benchmark. */
  @Query(
      """
      SELECT b.farmId AS farmId, SUM(b.initialCount) AS total
      FROM PoultryBatch b
      WHERE b.initialCount > 0
      GROUP BY b.farmId
      """)
  List<FarmTotal> sumInitialCountByFarm();
}
