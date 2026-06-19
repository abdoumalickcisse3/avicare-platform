package com.avicare.livestock.repository;

import com.avicare.livestock.domain.Delivery;
import com.avicare.livestock.domain.DeliveryStatus;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DeliveryRepository extends JpaRepository<Delivery, Long> {

  List<Delivery> findByFarmIdOrderByDeliveryDateDescIdDesc(Long farmId);

  List<Delivery> findByFarmIdAndStatusOrderByDeliveryDateDescIdDesc(
      Long farmId, DeliveryStatus status);

  List<Delivery> findByFarmIdAndOrderIdOrderByIdDesc(Long farmId, Long orderId);

  Optional<Delivery> findByFarmIdAndId(Long farmId, Long id);

  /**
   * Highest sequence used by a farm for a given {@code LIV-YYYY-} prefix (0 when none), so the
   * service can mint the next {@code LIV-YYYY-NNN} (D24). Native — parses the trailing digits.
   */
  @Query(
      value =
          "SELECT COALESCE(MAX(CAST(SUBSTRING(delivery_number FROM '[0-9]+$') AS INTEGER)), 0) "
              + "FROM deliveries WHERE farm_id = :farmId AND delivery_number LIKE :prefix",
      nativeQuery = true)
  int findMaxSequence(@Param("farmId") Long farmId, @Param("prefix") String prefix);
}
