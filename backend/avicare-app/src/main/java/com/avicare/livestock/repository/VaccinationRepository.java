package com.avicare.livestock.repository;

import com.avicare.livestock.domain.Vaccination;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface VaccinationRepository extends JpaRepository<Vaccination, Long> {

  List<Vaccination> findByProductionUnitIdOrderByAdministeredDateDesc(Long productionUnitId);

  List<Vaccination> findByProductionUnitIdAndVaccineKey(Long productionUnitId, String vaccineKey);

  Optional<Vaccination> findByProductionUnitIdAndVaccineKeyAndAdministeredDate(
      Long productionUnitId, String vaccineKey, LocalDate administeredDate);

  List<Vaccination> findByProductionUnitIdAndAdministeredDateBetween(
      Long productionUnitId, LocalDate from, LocalDate to);

  long countByProductionUnitId(Long productionUnitId);

  // ── Dashboard aggregations (Task 2.1, Spec B) ────────────────────────────

  /**
   * Count of vaccinations administered on units of a farm within the inclusive period [{@code
   * from}, {@code to}].
   */
  @Query(
      "SELECT COUNT(v) FROM Vaccination v "
          + "WHERE v.productionUnit.id IN "
          + "  (SELECT u.id FROM ProductionUnit u WHERE u.farmId = :farmId) "
          + "AND v.administeredDate BETWEEN :from AND :to")
  long countByFarmAndPeriod(
      @Param("farmId") Long farmId, @Param("from") LocalDate from, @Param("to") LocalDate to);
}
