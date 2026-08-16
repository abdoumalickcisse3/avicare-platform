package com.avicare.notification.domain;

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
import lombok.ToString;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * A materialized notification (Sprint C1). Farm-scoped — {@code farmId} is a bare id reference (no
 * cross-context {@code @ManyToOne}, per the vision's context isolation rule). A detected alert
 * condition materializes exactly one {@code ACTIVE} row per {@code dedupKey}; when the condition
 * clears the scanner flips it to {@code RESOLVED} and stamps {@code resolvedAt}.
 *
 * <p>{@code sourceRef} holds the deep-link payload (unitId/itemId/invoiceId…) mapped to the {@code
 * jsonb} column via {@code @JdbcTypeCode(SqlTypes.JSON)} (same pattern as {@code parameters} and
 * {@code assistant}). Timestamps are DB-owned (trigger); no soft delete (the lifecycle is {@code
 * ACTIVE → RESOLVED}).
 */
@Entity
@Table(name = "notifications")
@Getter
@Setter
@NoArgsConstructor
@ToString
public class Notification {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "farm_id", nullable = false)
  private Long farmId;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private NotificationCategory category;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private NotificationSeverity severity;

  @Column(nullable = false)
  private String title;

  @Column private String body;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "source_ref")
  private Map<String, Object> sourceRef;

  @Column(name = "dedup_key", nullable = false)
  private String dedupKey;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private NotificationStatus status = NotificationStatus.ACTIVE;

  @Column(name = "created_at", insertable = false, updatable = false)
  private LocalDateTime createdAt;

  @Column(name = "updated_at", insertable = false, updatable = false)
  private LocalDateTime updatedAt;

  @Column(name = "resolved_at")
  private LocalDateTime resolvedAt;
}
