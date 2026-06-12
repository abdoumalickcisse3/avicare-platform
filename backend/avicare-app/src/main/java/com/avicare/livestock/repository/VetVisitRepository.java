package com.avicare.livestock.repository;

import com.avicare.livestock.domain.VetVisit;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface VetVisitRepository extends JpaRepository<VetVisit, Long> {

  List<VetVisit> findByProductionUnitIdOrderByVisitDateDesc(Long productionUnitId);

  List<VetVisit> findByVeterinarianId(Long veterinarianId);

  /** Follow-ups due for a farm's units within a window (feeds future alerts). */
  @Query(
      "SELECT v FROM VetVisit v WHERE v.productionUnit.farmId = :farmId "
          + "AND v.followUpNeeded = true AND v.followUpDate BETWEEN :from AND :to "
          + "ORDER BY v.followUpDate")
  List<VetVisit> findUpcomingFollowUps(
      @Param("farmId") Long farmId, @Param("from") LocalDate from, @Param("to") LocalDate to);
}
