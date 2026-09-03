package com.avicare.livestock.repository;

import com.avicare.livestock.domain.SaleItem;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SaleItemRepository extends JpaRepository<SaleItem, Long> {

  List<SaleItem> findBySaleIdOrderById(Long saleId);

  /**
   * Total revenue (COMPLETED sales) attributed to a production unit, for finance per-unit analytics
   * (B4).
   */
  @Query(
      "SELECT COALESCE(SUM(si.lineTotalXof), 0) FROM SaleItem si "
          + "WHERE si.sale.farmId = :farmId AND si.productionUnitId = :unitId "
          + "AND si.sale.status = com.avicare.livestock.domain.SaleStatus.COMPLETED")
  long sumRevenueForUnit(@Param("farmId") Long farmId, @Param("unitId") Long unitId);

  /** Same sum restricted to a window, by sale date. */
  @Query(
      "SELECT COALESCE(SUM(si.lineTotalXof), 0) FROM SaleItem si "
          + "WHERE si.sale.farmId = :farmId AND si.productionUnitId = :unitId "
          + "AND si.sale.status = com.avicare.livestock.domain.SaleStatus.COMPLETED "
          + "AND si.sale.saleDate BETWEEN :from AND :to")
  long sumRevenueForUnitBetween(
      @Param("farmId") Long farmId,
      @Param("unitId") Long unitId,
      @Param("from") LocalDate from,
      @Param("to") LocalDate to);
}
