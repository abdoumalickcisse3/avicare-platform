package com.avicare.admin.repository;

import com.avicare.admin.domain.RequestTrace;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Reads and retention of {@link RequestTrace} (console {@code /console/traces}).
 *
 * <p>The console search goes through {@link RequestTraceSearch} and {@code findAll(Specification,
 * Pageable)} — see that record for why one all-in-one JPQL query is the wrong tool here.
 */
public interface RequestTraceRepository
    extends JpaRepository<RequestTrace, Long>, JpaSpecificationExecutor<RequestTrace> {

  /** Every hop recorded under one correlation id, oldest first (a retry shares the id). */
  List<RequestTrace> findByRequestIdOrderByStartedAtAsc(String requestId);

  /** Retention: traces are a debugging aid, not an archive. */
  @Modifying
  @Query("DELETE FROM RequestTrace t WHERE t.startedAt < :cutoff")
  int deleteOlderThan(@Param("cutoff") LocalDateTime cutoff);
}
