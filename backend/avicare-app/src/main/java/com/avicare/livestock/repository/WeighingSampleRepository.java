package com.avicare.livestock.repository;

import com.avicare.livestock.domain.WeighingSample;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Data access for {@link WeighingSample}. Soft-deleted samples are filtered by the entity's
 * {@code @SQLRestriction}.
 */
public interface WeighingSampleRepository extends JpaRepository<WeighingSample, Long> {

  List<WeighingSample> findByPoultryBatchIdOrderBySampleDateDesc(Long poultryBatchId);

  Optional<WeighingSample> findFirstByPoultryBatchIdOrderBySampleDateDesc(Long poultryBatchId);
}
