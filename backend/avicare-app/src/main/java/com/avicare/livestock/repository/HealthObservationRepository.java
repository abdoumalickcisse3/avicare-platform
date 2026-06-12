package com.avicare.livestock.repository;

import com.avicare.livestock.domain.HealthObservation;
import com.avicare.livestock.domain.Severity;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HealthObservationRepository extends JpaRepository<HealthObservation, Long> {

  List<HealthObservation> findByProductionUnitIdOrderByObservationDateDesc(Long productionUnitId);

  List<HealthObservation> findByProductionUnitIdAndSeverityInOrderByObservationDateDesc(
      Long productionUnitId, Collection<Severity> severities);
}
