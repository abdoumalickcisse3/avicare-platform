package com.avicare.livestock.repository;

import com.avicare.livestock.domain.Sale;
import com.avicare.livestock.domain.SaleStatus;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
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

  // ── Dashboard aggregations (Task 1.1, Spec B) ────────────────────────────

  /**
   * Total revenue (sum of {@code totalXof} on COMPLETED sales) within the inclusive period [{@code
   * from}, {@code to}] for a farm. Returns {@code null} when no matching sales exist.
   */
  @Query(
      "SELECT SUM(s.totalXof) FROM Sale s WHERE s.farmId = :farmId "
          + "AND s.saleDate BETWEEN :from AND :to "
          + "AND s.status = com.avicare.livestock.domain.SaleStatus.COMPLETED")
  Long sumRevenueByPeriod(
      @Param("farmId") Long farmId, @Param("from") LocalDate from, @Param("to") LocalDate to);

  /**
   * Revenue per calendar day within [{@code from}, {@code to}]. Each row is {@code [LocalDate
   * saleDate, Long total]}, ordered by date ascending. Days with no sales are absent.
   */
  @Query(
      "SELECT s.saleDate, SUM(s.totalXof) FROM Sale s WHERE s.farmId = :farmId "
          + "AND s.saleDate BETWEEN :from AND :to "
          + "AND s.status = com.avicare.livestock.domain.SaleStatus.COMPLETED "
          + "GROUP BY s.saleDate ORDER BY s.saleDate ASC")
  List<Object[]> sumRevenueByDay(
      @Param("farmId") Long farmId, @Param("from") LocalDate from, @Param("to") LocalDate to);

  /**
   * Revenue per named client within [{@code from}, {@code to}], sorted descending (top buyers
   * first). Walk-in sales (null client) are excluded. Each row is {@code [Long clientId, String
   * displayName, Long total]}. Use {@link Pageable} to cap the result set (e.g. top 5).
   */
  @Query(
      "SELECT s.client.id, s.client.displayName, SUM(s.totalXof) FROM Sale s "
          + "WHERE s.farmId = :farmId AND s.saleDate BETWEEN :from AND :to "
          + "AND s.status = com.avicare.livestock.domain.SaleStatus.COMPLETED "
          + "AND s.client IS NOT NULL "
          + "GROUP BY s.client.id, s.client.displayName "
          + "ORDER BY SUM(s.totalXof) DESC")
  List<Object[]> topClientsByRevenue(
      @Param("farmId") Long farmId,
      @Param("from") LocalDate from,
      @Param("to") LocalDate to,
      Pageable pageable);
}
