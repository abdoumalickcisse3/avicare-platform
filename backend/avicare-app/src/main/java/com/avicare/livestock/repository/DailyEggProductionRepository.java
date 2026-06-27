package com.avicare.livestock.repository;

import com.avicare.livestock.domain.DailyEggProduction;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Data access for {@link DailyEggProduction}. The unit is referenced through the {@code
 * productionUnit} association, so the queries navigate {@code productionUnit.id} explicitly.
 */
public interface DailyEggProductionRepository extends JpaRepository<DailyEggProduction, Long> {

  @Query(
      "SELECT d FROM DailyEggProduction d WHERE d.productionUnit.id = :unitId "
          + "AND d.productionDate = :date")
  Optional<DailyEggProduction> findByProductionUnitIdAndProductionDate(
      @Param("unitId") Long unitId, @Param("date") LocalDate date);

  @Query(
      "SELECT d FROM DailyEggProduction d WHERE d.productionUnit.id = :unitId "
          + "ORDER BY d.productionDate DESC")
  List<DailyEggProduction> findByProductionUnitIdOrderByProductionDateDesc(
      @Param("unitId") Long unitId);

  @Query(
      "SELECT d FROM DailyEggProduction d WHERE d.productionUnit.id = :unitId "
          + "AND d.productionDate BETWEEN :start AND :end ORDER BY d.productionDate DESC")
  List<DailyEggProduction> findByProductionUnitIdAndProductionDateBetween(
      @Param("unitId") Long unitId, @Param("start") LocalDate start, @Param("end") LocalDate end);

  // ── Dashboard aggregations (Task 2.1, Spec B) ────────────────────────────

  /**
   * Average laying rate (percent) across all layer units of a farm within the inclusive period
   * [{@code from}, {@code to}]. Each row in {@code daily_egg_productions} contributes one {@code
   * laying_rate_pct} value; the farm-level rate is the unweighted average. Returns {@code null}
   * when no rows exist in the window (no layer units or no day has been closed yet).
   */
  @Query(
      "SELECT AVG(d.layingRatePct) FROM DailyEggProduction d "
          + "WHERE d.productionUnit.id IN "
          + "  (SELECT u.id FROM ProductionUnit u WHERE u.farmId = :farmId) "
          + "AND d.productionDate BETWEEN :from AND :to")
  Double avgLayingRateByFarmAndPeriod(
      @Param("farmId") Long farmId, @Param("from") LocalDate from, @Param("to") LocalDate to);

  /**
   * Total eggs collected per calendar day within [{@code from}, {@code to}] for a farm, ordered by
   * date ascending. Each row is {@code [LocalDate productionDate, Long totalEggs]}. Days with no
   * closed production records are absent.
   */
  @Query(
      "SELECT d.productionDate, SUM(d.totalEggsCollected) FROM DailyEggProduction d "
          + "WHERE d.productionUnit.id IN "
          + "  (SELECT u.id FROM ProductionUnit u WHERE u.farmId = :farmId) "
          + "AND d.productionDate BETWEEN :from AND :to "
          + "GROUP BY d.productionDate ORDER BY d.productionDate ASC")
  List<Object[]> sumEggsByDayForFarm(
      @Param("farmId") Long farmId, @Param("from") LocalDate from, @Param("to") LocalDate to);
}
