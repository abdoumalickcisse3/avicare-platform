package com.avicare.livestock.repository;

import com.avicare.livestock.domain.DailyRecord;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Data access for {@link DailyRecord}. The unit is referenced through the {@code productionUnit}
 * association, so the queries navigate {@code productionUnit.id} explicitly.
 */
public interface DailyRecordRepository extends JpaRepository<DailyRecord, Long> {

  @Query(
      "SELECT d FROM DailyRecord d WHERE d.productionUnit.id = :unitId ORDER BY d.recordDate DESC")
  List<DailyRecord> findByProductionUnitIdOrderByRecordDateDesc(@Param("unitId") Long unitId);

  @Query("SELECT d FROM DailyRecord d WHERE d.productionUnit.id = :unitId AND d.recordDate = :date")
  Optional<DailyRecord> findByProductionUnitIdAndRecordDate(
      @Param("unitId") Long unitId, @Param("date") LocalDate date);

  @Query(
      "SELECT COALESCE(SUM(d.mortalityCount), 0) FROM DailyRecord d "
          + "WHERE d.productionUnit.id = :unitId AND d.recordDate BETWEEN :start AND :end")
  int sumMortalityBetween(
      @Param("unitId") Long unitId, @Param("start") LocalDate start, @Param("end") LocalDate end);

  @Query(
      "SELECT COALESCE(SUM(d.feedKg), 0) FROM DailyRecord d "
          + "WHERE d.productionUnit.id = :unitId AND d.recordDate <= :date")
  BigDecimal sumFeedKgUpTo(@Param("unitId") Long unitId, @Param("date") LocalDate date);

  @Query(
      "SELECT COALESCE(SUM(d.waterL), 0) FROM DailyRecord d "
          + "WHERE d.productionUnit.id = :unitId AND d.recordDate <= :date")
  BigDecimal sumWaterLUpTo(@Param("unitId") Long unitId, @Param("date") LocalDate date);

  // ── Dashboard aggregations (Task 2.1, Spec B) ────────────────────────────

  /**
   * Total mortality count across all non-soft-deleted units of a farm within the inclusive period
   * [{@code from}, {@code to}]. Returns {@code null} when no daily records match (no farms, no
   * records in window).
   */
  @Query(
      "SELECT SUM(d.mortalityCount) FROM DailyRecord d "
          + "WHERE d.productionUnit.id IN "
          + "  (SELECT u.id FROM ProductionUnit u WHERE u.farmId = :farmId) "
          + "AND d.recordDate BETWEEN :from AND :to")
  Long sumMortalityByFarmAndPeriod(
      @Param("farmId") Long farmId, @Param("from") LocalDate from, @Param("to") LocalDate to);

  /**
   * Mortality count per calendar day within [{@code from}, {@code to}] for a farm, ordered by date
   * ascending. Each row is {@code [LocalDate recordDate, Long mortalitySum]}. Days with no records
   * are absent.
   */
  @Query(
      "SELECT d.recordDate, SUM(d.mortalityCount) FROM DailyRecord d "
          + "WHERE d.productionUnit.id IN "
          + "  (SELECT u.id FROM ProductionUnit u WHERE u.farmId = :farmId) "
          + "AND d.recordDate BETWEEN :from AND :to "
          + "GROUP BY d.recordDate ORDER BY d.recordDate ASC")
  List<Object[]> sumMortalityByDayForFarm(
      @Param("farmId") Long farmId, @Param("from") LocalDate from, @Param("to") LocalDate to);

  /**
   * Total feed (kg) across all units of a farm within [{@code from}, {@code to}]. COALESCE to 0 so
   * the caller distinguishes "no records" via {@link #countFeedDaysByFarmAndPeriod}.
   */
  @Query(
      "SELECT COALESCE(SUM(d.feedKg), 0) FROM DailyRecord d "
          + "WHERE d.productionUnit.id IN "
          + "  (SELECT u.id FROM ProductionUnit u WHERE u.farmId = :farmId) "
          + "AND d.recordDate BETWEEN :from AND :to")
  BigDecimal sumFeedKgByFarmAndPeriod(
      @Param("farmId") Long farmId, @Param("from") LocalDate from, @Param("to") LocalDate to);

  /** Number of distinct calendar days with a daily record for a farm within the window. */
  @Query(
      "SELECT COUNT(DISTINCT d.recordDate) FROM DailyRecord d "
          + "WHERE d.productionUnit.id IN "
          + "  (SELECT u.id FROM ProductionUnit u WHERE u.farmId = :farmId) "
          + "AND d.recordDate BETWEEN :from AND :to")
  long countFeedDaysByFarmAndPeriod(
      @Param("farmId") Long farmId, @Param("from") LocalDate from, @Param("to") LocalDate to);
}
