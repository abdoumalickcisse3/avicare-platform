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
}
