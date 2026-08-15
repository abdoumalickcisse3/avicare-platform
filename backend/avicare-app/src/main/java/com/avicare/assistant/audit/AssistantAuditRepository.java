package com.avicare.assistant.audit;

import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Append-only store of assistant interactions (V31). */
public interface AssistantAuditRepository extends JpaRepository<AssistantAudit, Long> {

  List<AssistantAudit> findByFarmIdOrderByCreatedAtDesc(Long farmId, Pageable pageable);

  /** How many interactions a user has logged since {@code since} — the daily-quota meter. */
  long countByUserIdAndCreatedAtGreaterThanEqual(Long userId, LocalDateTime since);

  /**
   * The user's most recent ANSWER interactions on the farm since {@code since} (newest first) —
   * short-term conversational memory for read follow-ups.
   */
  @Query(
      "SELECT a FROM AssistantAudit a WHERE a.farmId = :farmId AND a.userId = :userId "
          + "AND a.kind = 'ANSWER' AND a.createdAt >= :since ORDER BY a.createdAt DESC")
  List<AssistantAudit> recentAnswers(
      @Param("farmId") Long farmId,
      @Param("userId") Long userId,
      @Param("since") LocalDateTime since,
      Pageable pageable);
}
