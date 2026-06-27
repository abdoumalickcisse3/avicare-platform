package com.avicare.livestock.repository;

import com.avicare.livestock.domain.Order;
import com.avicare.livestock.domain.OrderStatus;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OrderRepository extends JpaRepository<Order, Long> {

  List<Order> findByFarmIdOrderByOrderDateDescIdDesc(Long farmId);

  List<Order> findByFarmIdAndStatusOrderByOrderDateDescIdDesc(Long farmId, OrderStatus status);

  List<Order> findByFarmIdAndClientIdOrderByOrderDateDescIdDesc(Long farmId, Long clientId);

  Optional<Order> findByFarmIdAndId(Long farmId, Long id);

  /**
   * Highest sequence number used by a farm for a given {@code ORD-YYYY-} prefix (0 when none), so
   * the service can mint the next {@code ORD-YYYY-NNN} (D24). Native — parses the trailing digits.
   */
  @Query(
      value =
          "SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM '[0-9]+$') AS INTEGER)), 0) "
              + "FROM orders WHERE farm_id = :farmId AND order_number LIKE :prefix",
      nativeQuery = true)
  int findMaxSequence(@Param("farmId") Long farmId, @Param("prefix") String prefix);

  // ── Dashboard aggregations (Task 1.1, Spec B) ────────────────────────────

  /**
   * Count of orders that are still in the worklist (PENDING, CONFIRMED, or IN_PROGRESS) for a farm.
   * Snapshot KPI — ignores period. DELIVERED and CANCELLED orders are excluded.
   */
  @Query(
      "SELECT COUNT(o) FROM Order o WHERE o.farmId = :farmId "
          + "AND o.status IN (com.avicare.livestock.domain.OrderStatus.PENDING, "
          + "com.avicare.livestock.domain.OrderStatus.CONFIRMED, "
          + "com.avicare.livestock.domain.OrderStatus.IN_PROGRESS)")
  long countToDeliver(@Param("farmId") Long farmId);
}
