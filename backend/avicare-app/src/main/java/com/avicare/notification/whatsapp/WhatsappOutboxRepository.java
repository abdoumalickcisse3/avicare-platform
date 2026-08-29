package com.avicare.notification.whatsapp;

import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Repository for the WhatsApp outbox (Sprint C1 Phase 2). */
public interface WhatsappOutboxRepository extends JpaRepository<WhatsappOutbox, Long> {

  /** Oldest pending messages first, capped (dispatcher batch). */
  List<WhatsappOutbox> findTop50ByStatusOrderByCreatedAtAsc(OutboxStatus status);

  List<WhatsappOutbox> findTop20ByStatusOrderByCreatedAtDesc(OutboxStatus status);

  long countByStatus(OutboxStatus status);

  @Query("SELECT COUNT(o) FROM WhatsappOutbox o WHERE o.status = :status AND o.createdAt >= :since")
  long countByStatusSince(
      @Param("status") OutboxStatus status, @Param("since") LocalDateTime since);

  @Query(
      """
      SELECT o.source AS source, COUNT(o) AS total
      FROM WhatsappOutbox o
      WHERE o.createdAt >= :since AND o.status = com.avicare.notification.whatsapp.OutboxStatus.SENT
      GROUP BY o.source
      """)
  List<SourceCount> countBySourceSince(@Param("since") LocalDateTime since);

  @Query(
      """
      SELECT o.farmId AS farmId, COUNT(o) AS total
      FROM WhatsappOutbox o
      WHERE o.createdAt >= :since
        AND o.farmId IS NOT NULL
        AND o.status = com.avicare.notification.whatsapp.OutboxStatus.SENT
      GROUP BY o.farmId
      ORDER BY COUNT(o) DESC
      """)
  List<FarmCount> countByFarmSince(@Param("since") LocalDateTime since);

  /** Projection: how many messages each source produced. */
  interface SourceCount {
    String getSource();

    long getTotal();
  }

  /** Projection: how many messages were sent on each farm's behalf. */
  interface FarmCount {
    Long getFarmId();

    long getTotal();
  }
}
