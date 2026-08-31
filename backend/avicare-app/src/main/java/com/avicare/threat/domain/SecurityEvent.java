package com.avicare.threat.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import java.util.Map;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * One thing worth remembering about who is knocking.
 *
 * <p>Append-only by use, not by trigger: unlike the staff audit trail this is operational data, and
 * a retention policy on it is a reasonable thing to want later.
 *
 * <p>{@code email} is kept even when it matches no account — an attempt against an address that
 * does not exist is precisely the signal that someone is guessing.
 */
@Entity
@Table(name = "security_events")
@Getter
@Setter
@NoArgsConstructor
public class SecurityEvent {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Enumerated(EnumType.STRING)
  @Column(name = "event_type", nullable = false)
  private SecurityEventType eventType;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private ThreatSeverity severity;

  @Column(name = "ip_address", nullable = false)
  private String ipAddress;

  @Column(name = "user_id")
  private Long userId;

  @Column private String email;

  @Column(name = "user_agent")
  private String userAgent;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(nullable = false)
  private Map<String, Object> details = Map.of();

  /** What the platform did about it: {@code blocked}, {@code warned}, or nothing. */
  @Column(name = "action_taken")
  private String actionTaken;

  @Column(name = "created_at", insertable = false, updatable = false)
  private LocalDateTime createdAt;
}
