package com.avicare.livestock.repository;

import com.avicare.livestock.domain.GrowthPerformance;
import java.time.LocalDate;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/** Data access for the computed {@link GrowthPerformance} snapshots. */
public interface GrowthPerformanceRepository extends JpaRepository<GrowthPerformance, Long> {

  Optional<GrowthPerformance> findByPoultryBatchIdAndSnapshotDate(
      Long poultryBatchId, LocalDate snapshotDate);

  Optional<GrowthPerformance> findFirstByPoultryBatchIdOrderBySnapshotDateDesc(Long poultryBatchId);
}
