package com.avicare.livestock.repository;

import com.avicare.livestock.domain.TreatmentExecuted;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TreatmentExecutedRepository extends JpaRepository<TreatmentExecuted, Long> {

  List<TreatmentExecuted> findByProductionUnitIdOrderByStartDateDesc(Long productionUnitId);

  List<TreatmentExecuted> findByProductionUnitIdAndTreatmentKey(
      Long productionUnitId, String treatmentKey);

  /** Treatments whose meat or eggs withdrawal is still running on {@code today}. */
  @Query(
      "SELECT t FROM TreatmentExecuted t WHERE t.productionUnit.id = :unitId "
          + "AND (t.withdrawalEndDateMeat >= :today OR t.withdrawalEndDateEggs >= :today) "
          + "ORDER BY t.startDate DESC")
  List<TreatmentExecuted> findActiveWithdrawals(
      @Param("unitId") Long unitId, @Param("today") LocalDate today);

  // ── Dashboard aggregations (Task 2.1, Spec B) ────────────────────────────

  /**
   * Count of treatments started on units of a farm within the inclusive period [{@code from},
   * {@code to}]. Uses {@code start_date} as the period anchor.
   */
  @Query(
      "SELECT COUNT(t) FROM TreatmentExecuted t "
          + "WHERE t.productionUnit.id IN "
          + "  (SELECT u.id FROM ProductionUnit u WHERE u.farmId = :farmId) "
          + "AND t.startDate BETWEEN :from AND :to")
  long countByFarmAndPeriod(
      @Param("farmId") Long farmId, @Param("from") LocalDate from, @Param("to") LocalDate to);
}
