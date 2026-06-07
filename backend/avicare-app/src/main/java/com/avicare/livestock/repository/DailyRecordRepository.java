package com.avicare.livestock.repository;

import com.avicare.livestock.domain.DailyRecord;
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
}
