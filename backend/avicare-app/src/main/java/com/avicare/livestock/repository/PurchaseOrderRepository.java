package com.avicare.livestock.repository;

import com.avicare.livestock.domain.PurchaseOrder;
import com.avicare.livestock.domain.PurchaseOrderStatus;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PurchaseOrderRepository extends JpaRepository<PurchaseOrder, Long> {

  List<PurchaseOrder> findByFarmIdOrderByOrderDateDescIdDesc(Long farmId);

  List<PurchaseOrder> findByFarmIdAndStatusOrderByOrderDateDescIdDesc(
      Long farmId, PurchaseOrderStatus status);

  Optional<PurchaseOrder> findByFarmIdAndId(Long farmId, Long id);

  Optional<PurchaseOrder> findByFarmIdAndOrderNumber(Long farmId, String orderNumber);

  /**
   * Highest sequence number used by a farm for a given {@code BC-YYYY-} prefix (0 when none), so
   * the service can mint the next {@code BC-YYYY-NNN}. Native — parses the trailing digits.
   */
  @Query(
      value =
          "SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM '[0-9]+$') AS INTEGER)), 0) "
              + "FROM purchase_orders WHERE farm_id = :farmId AND order_number LIKE :prefix",
      nativeQuery = true)
  int findMaxSequence(@Param("farmId") Long farmId, @Param("prefix") String prefix);
}
