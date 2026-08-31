package com.avicare.integrity.repository;

import com.avicare.integrity.domain.IntegrityFinding;
import com.avicare.integrity.domain.Severity;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

/** Findings, open and closed (console {@code /console/integrite}). */
public interface IntegrityFindingRepository
    extends JpaRepository<IntegrityFinding, Long>, JpaSpecificationExecutor<IntegrityFinding> {

  /** The open finding for this exact claim, if there is one — the sweep updates it in place. */
  Optional<IntegrityFinding> findByCheckKeyAndEntityTypeAndEntityIdAndResolvedAtIsNull(
      String checkKey, String entityType, Long entityId);

  /** Every open finding a given check currently claims, to close the ones that came back clean. */
  List<IntegrityFinding> findByCheckKeyAndResolvedAtIsNull(String checkKey);

  List<IntegrityFinding> findBySeverityAndResolvedAtIsNullAndNotifiedAtIsNull(Severity severity);

  long countBySeverityAndResolvedAtIsNull(Severity severity);

  Page<IntegrityFinding> findByResolvedAtIsNullOrderBySeverityDescDetectedAtDesc(Pageable pageable);
}
