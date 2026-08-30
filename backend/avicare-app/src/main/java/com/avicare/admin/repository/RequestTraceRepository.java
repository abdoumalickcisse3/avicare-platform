package com.avicare.admin.repository;

import com.avicare.admin.domain.RequestTrace;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Reads and retention of {@link RequestTrace} (console {@code /console/traces}). */
public interface RequestTraceRepository extends JpaRepository<RequestTrace, Long> {

  /** Every hop recorded under one correlation id, oldest first (a retry shares the id). */
  List<RequestTrace> findByRequestIdOrderByStartedAtAsc(String requestId);

  /**
   * Console search. Every criterion is optional and ANDed; {@code errorsOnly} keeps the responses a
   * support session actually cares about. Written as a single JPQL query rather than a
   * Specification because the filter set is closed and small — a spec builder here would be more
   * machinery than the six {@code IS NULL} guards it replaces.
   */
  @Query(
      """
      SELECT t FROM RequestTrace t
       WHERE (:requestId IS NULL OR t.requestId = :requestId)
         AND (:email IS NULL OR LOWER(t.userEmail) LIKE LOWER(CONCAT('%', :email, '%')))
         AND (:farmId IS NULL OR t.farmId = :farmId)
         AND (:path IS NULL OR t.path LIKE CONCAT('%', :path, '%'))
         AND (:status IS NULL OR t.statusCode = :status)
         AND (:errorsOnly = FALSE OR t.statusCode >= 400)
         AND (:from IS NULL OR t.startedAt >= :from)
         AND (:to IS NULL OR t.startedAt <= :to)
       ORDER BY t.startedAt DESC
      """)
  Page<RequestTrace> search(
      @Param("requestId") String requestId,
      @Param("email") String email,
      @Param("farmId") Long farmId,
      @Param("path") String path,
      @Param("status") Integer status,
      @Param("errorsOnly") boolean errorsOnly,
      @Param("from") LocalDateTime from,
      @Param("to") LocalDateTime to,
      Pageable pageable);

  /** Retention: traces are a debugging aid, not an archive. */
  @Modifying
  @Query("DELETE FROM RequestTrace t WHERE t.startedAt < :cutoff")
  int deleteOlderThan(@Param("cutoff") LocalDateTime cutoff);
}
