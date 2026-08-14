package com.avicare.assistant.audit;

import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

/** Append-only store of assistant interactions (V31). */
public interface AssistantAuditRepository extends JpaRepository<AssistantAudit, Long> {

  List<AssistantAudit> findByFarmIdOrderByCreatedAtDesc(Long farmId, Pageable pageable);
}
