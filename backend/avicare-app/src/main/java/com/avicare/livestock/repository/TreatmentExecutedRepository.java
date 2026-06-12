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
}
