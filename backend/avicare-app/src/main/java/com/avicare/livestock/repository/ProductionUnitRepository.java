package com.avicare.livestock.repository;

import com.avicare.livestock.domain.ProductionUnit;
import com.avicare.livestock.domain.UnitStatus;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Generic data access over the {@link ProductionUnit} hierarchy (JPA JOINED). Transverse contexts
 * query units by farm/status without knowing the species. Soft-deleted rows are filtered by the
 * entity's {@code @SQLRestriction}.
 */
public interface ProductionUnitRepository extends JpaRepository<ProductionUnit, Long> {

  List<ProductionUnit> findByFarmId(Long farmId);

  /**
   * Locks the unit's row until the transaction ends. Native and id-only on purpose: a locking JPQL
   * query over this JOINED hierarchy would lock the subclass tables through outer joins, which
   * PostgreSQL refuses. The result is only there to make the statement run; the caller loads the
   * entity afterwards, once it holds the lock.
   */
  @Query(value = "SELECT id FROM production_units WHERE id = :id FOR UPDATE", nativeQuery = true)
  List<Long> lockRow(@Param("id") Long id);

  List<ProductionUnit> findByFarmIdAndStatus(Long farmId, UnitStatus status);

  // ── Dashboard aggregations (Task 2.1, Spec B) ────────────────────────────

  /** Count of ACTIVE (non-soft-deleted) units for a farm. Snapshot — ignores period. */
  @Query(
      "SELECT COUNT(u) FROM ProductionUnit u WHERE u.farmId = :farmId "
          + "AND u.status = com.avicare.livestock.domain.UnitStatus.ACTIVE")
  long countActiveByFarmId(@Param("farmId") Long farmId);

  /**
   * Sum of {@code currentCount} across ACTIVE units for a farm. Returns {@code null} when no active
   * units exist. Snapshot — ignores period.
   */
  @Query(
      "SELECT SUM(u.currentCount) FROM ProductionUnit u WHERE u.farmId = :farmId "
          + "AND u.status = com.avicare.livestock.domain.UnitStatus.ACTIVE")
  Long sumCurrentCountActiveByFarmId(@Param("farmId") Long farmId);
}
