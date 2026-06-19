package com.avicare.livestock.repository;

import com.avicare.livestock.domain.Sale;
import com.avicare.livestock.domain.SaleStatus;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SaleRepository extends JpaRepository<Sale, Long> {

  List<Sale> findByFarmIdOrderBySaleDateDescIdDesc(Long farmId);

  List<Sale> findByFarmIdAndStatusOrderBySaleDateDescIdDesc(Long farmId, SaleStatus status);

  List<Sale> findByFarmIdAndClientIdOrderBySaleDateDescIdDesc(Long farmId, Long clientId);

  Optional<Sale> findByFarmIdAndId(Long farmId, Long id);

  /**
   * Highest sequence used by a farm for a given {@code V-YYYY-} prefix (0 when none), so the
   * service can mint the next {@code V-YYYY-NNN} (D24). Native — parses the trailing digits.
   */
  @Query(
      value =
          "SELECT COALESCE(MAX(CAST(SUBSTRING(sale_number FROM '[0-9]+$') AS INTEGER)), 0) "
              + "FROM sales WHERE farm_id = :farmId AND sale_number LIKE :prefix",
      nativeQuery = true)
  int findMaxSequence(@Param("farmId") Long farmId, @Param("prefix") String prefix);
}
