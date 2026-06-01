package com.avicare.parameters.repository;

import com.avicare.parameters.domain.AlertThreshold;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/** Data access for {@link AlertThreshold}. */
public interface AlertThresholdRepository extends JpaRepository<AlertThreshold, Long> {

  List<AlertThreshold> findByFarmId(Long farmId);

  Optional<AlertThreshold> findByFarmIdAndThresholdType(Long farmId, String thresholdType);
}
