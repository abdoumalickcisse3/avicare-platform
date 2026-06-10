package com.avicare.livestock.repository;

import com.avicare.livestock.domain.EggCollection;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Data access for {@link EggCollection}. The unit is referenced through the {@code productionUnit}
 * association, so the queries navigate {@code productionUnit.id} explicitly.
 */
public interface EggCollectionRepository extends JpaRepository<EggCollection, Long> {

  @Query(
      "SELECT e FROM EggCollection e WHERE e.productionUnit.id = :unitId "
          + "AND e.collectionDate = :date AND e.timeslotKey = :timeslotKey")
  Optional<EggCollection> findByProductionUnitIdAndCollectionDateAndTimeslotKey(
      @Param("unitId") Long unitId,
      @Param("date") LocalDate date,
      @Param("timeslotKey") String timeslotKey);

  @Query(
      "SELECT e FROM EggCollection e WHERE e.productionUnit.id = :unitId "
          + "ORDER BY e.collectionDate DESC, e.timeslotKey ASC")
  List<EggCollection> findByProductionUnitIdOrderByCollectionDateDescTimeslotKeyAsc(
      @Param("unitId") Long unitId);

  @Query(
      "SELECT e FROM EggCollection e WHERE e.productionUnit.id = :unitId "
          + "AND e.collectionDate BETWEEN :start AND :end "
          + "ORDER BY e.collectionDate DESC, e.timeslotKey ASC")
  List<EggCollection> findByProductionUnitIdAndCollectionDateBetween(
      @Param("unitId") Long unitId, @Param("start") LocalDate start, @Param("end") LocalDate end);

  @Query(
      "SELECT COALESCE(SUM(e.totalEggs), 0) FROM EggCollection e "
          + "WHERE e.productionUnit.id = :unitId AND e.collectionDate BETWEEN :start AND :end")
  long sumTotalEggsBetween(
      @Param("unitId") Long unitId, @Param("start") LocalDate start, @Param("end") LocalDate end);

  @Query(
      "SELECT COALESCE(SUM(e.brokenEggs), 0) FROM EggCollection e "
          + "WHERE e.productionUnit.id = :unitId AND e.collectionDate BETWEEN :start AND :end")
  long sumBrokenEggsBetween(
      @Param("unitId") Long unitId, @Param("start") LocalDate start, @Param("end") LocalDate end);
}
