package com.avicare.admin.repository;

import com.avicare.admin.domain.AdminAuditLog;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Repository for {@link AdminAuditLog}. Reads and inserts only — the table refuses updates and
 * deletes at the database level, so the inherited {@code delete*} methods would fail by design.
 */
public interface AdminAuditLogRepository extends JpaRepository<AdminAuditLog, Long> {

  Page<AdminAuditLog> findByActorUserIdOrderByCreatedAtDesc(Long actorUserId, Pageable pageable);

  Page<AdminAuditLog> findByTenantIdOrderByCreatedAtDesc(Long tenantId, Pageable pageable);

  /**
   * Most recent entry for one action on one target. The append-only trail is the proof that an
   * export happened — no second table to keep in sync with it.
   */
  Optional<AdminAuditLog> findFirstByActionAndTargetIdOrderByCreatedAtDesc(
      String action, Long targetId);

  /** Everything the trail recorded under one correlation id (console trace detail). */
  List<AdminAuditLog> findByRequestIdOrderByCreatedAtAsc(String requestId);

  /**
   * Recent entries whose action starts with {@code prefix} — the flag screen reads its own history
   * from the trail rather than keeping a second journal in step with it.
   */
  List<AdminAuditLog> findTop30ByActionStartingWithOrderByCreatedAtDesc(String prefix);
}
