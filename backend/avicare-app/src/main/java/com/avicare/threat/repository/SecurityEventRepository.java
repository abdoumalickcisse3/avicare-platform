package com.avicare.threat.repository;

import com.avicare.threat.domain.SecurityEvent;
import com.avicare.threat.domain.SecurityEventType;
import com.avicare.threat.domain.ThreatSeverity;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** The security timeline (console {@code /console/securite}). */
public interface SecurityEventRepository extends JpaRepository<SecurityEvent, Long> {

  List<SecurityEvent> findTop200ByCreatedAtAfterOrderByCreatedAtDesc(LocalDateTime since);

  /** How many times this address failed to sign in recently — the brute-force decision. */
  @Query(
      """
      SELECT COUNT(e) FROM SecurityEvent e
       WHERE e.ipAddress = :ip AND e.eventType = :type AND e.createdAt > :since
      """)
  long countRecent(
      @Param("ip") String ip,
      @Param("type") SecurityEventType type,
      @Param("since") LocalDateTime since);

  long countBySeverityAndCreatedAtAfter(ThreatSeverity severity, LocalDateTime since);

  long countByEventTypeAndCreatedAtAfter(SecurityEventType eventType, LocalDateTime since);
}
