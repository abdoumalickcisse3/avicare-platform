package com.avicare.livestock.repository;

import com.avicare.livestock.domain.LifecycleEvent;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Data access for {@link LifecycleEvent}. */
public interface LifecycleEventRepository extends JpaRepository<LifecycleEvent, Long> {

  List<LifecycleEvent> findByProductionUnitId(Long productionUnitId);

  List<LifecycleEvent> findByProductionUnitIdAndEventType(Long productionUnitId, String eventType);

  /**
   * Mobile replay lookup (doc 08 §9): find the event already recorded for this client-generated
   * key.
   */
  Optional<LifecycleEvent> findByClientRef(UUID clientRef);

  // ── Dashboard aggregations (Task 2.1, Spec B) ────────────────────────────

  /**
   * Sum of {@code quantity_delta} for all {@code CREATED} lifecycle events on non-soft-deleted
   * units of a farm. Represents the total initial effectif placed on the farm (denominator for the
   * mortality rate). Returns 0 when no units exist. Native SQL — {@link LifecycleEvent} carries
   * only the unit id (no JPA association to cross), so a plain join is required.
   */
  @Query(
      value =
          "SELECT CAST(COALESCE(SUM(e.quantity_delta), 0) AS BIGINT) "
              + "FROM lifecycle_events e "
              + "JOIN production_units u ON u.id = e.production_unit_id "
              + "WHERE u.farm_id = :farmId "
              + "AND u.deleted_at IS NULL "
              + "AND e.event_type = 'CREATED'",
      nativeQuery = true)
  long sumInitialCountByFarm(@Param("farmId") Long farmId);

  /**
   * Sum of {@code quantity_delta} for all {@code CREATED} lifecycle events on a single
   * non-soft-deleted production unit. Represents the unit's initial headcount (finance per-unit
   * analytics, B4). Returns 0 when no CREATED event exists or unit is soft-deleted.
   */
  @Query(
      value =
          "SELECT CAST(COALESCE(SUM(e.quantity_delta), 0) AS BIGINT) "
              + "FROM lifecycle_events e "
              + "JOIN production_units pu ON pu.id = e.production_unit_id "
              + "WHERE pu.id = :unitId "
              + "AND pu.deleted_at IS NULL "
              + "AND e.event_type = 'CREATED'",
      nativeQuery = true)
  long sumInitialCountByUnit(@Param("unitId") Long unitId);

  /**
   * Recent whitelisted lifecycle events for a farm, most recent first, capped by {@code pageable}.
   */
  @Query(
      "SELECT e FROM LifecycleEvent e WHERE e.productionUnitId IN "
          + "  (SELECT u.id FROM ProductionUnit u WHERE u.farmId = :farmId) "
          + "AND e.eventType IN :types ORDER BY e.occurredAt DESC")
  List<LifecycleEvent> findRecentByFarmAndTypes(
      @Param("farmId") Long farmId, @Param("types") Collection<String> types, Pageable pageable);

  /**
   * Most recent event per farm, in ONE query. The platform-wide support views list every farm at
   * once, so asking farm by farm would be an N+1 over the whole tenant base.
   *
   * <p>Each row is {@code [farmId, occurredAt]}.
   */
  @Query(
      "SELECT u.farmId, MAX(e.occurredAt) FROM LifecycleEvent e, ProductionUnit u "
          + "WHERE e.productionUnitId = u.id AND u.farmId IN :farmIds "
          + "GROUP BY u.farmId")
  List<Object[]> findLastEventPerFarm(@Param("farmIds") Collection<Long> farmIds);
}
