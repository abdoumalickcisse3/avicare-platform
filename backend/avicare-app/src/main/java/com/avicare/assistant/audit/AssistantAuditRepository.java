package com.avicare.assistant.audit;

import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

/** Append-only store of assistant interactions (V31). */
public interface AssistantAuditRepository extends JpaRepository<AssistantAudit, Long> {

  List<AssistantAudit> findByFarmIdOrderByCreatedAtDesc(Long farmId, Pageable pageable);

  /** How many interactions a user has logged since {@code since} — the daily-quota meter. */
  long countByUserIdAndCreatedAtGreaterThanEqual(Long userId, LocalDateTime since);
}
