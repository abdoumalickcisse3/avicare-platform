package com.avicare.partner.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

/**
 * A materialized network alert addressed to a partner (couche « Garder »). Partner and farm are
 * bare id references (no cross-context {@code @ManyToOne}). Exactly one {@code ACTIVE} row exists
 * per {@code (partnerId, dedupKey)} — enforced by a partial unique index — so a daily re-scan is
 * idempotent; when the condition clears the scanner flips the row to {@code RESOLVED}.
 *
 * <p>Timestamps are DB-owned (trigger). No soft delete: the lifecycle is {@code ACTIVE → RESOLVED}.
 *
 * <p>Trust boundary: a row only ever exists for a farm that shares the scope the alert derives
 * from, and {@code body} carries nothing beyond what that scope allows.
 */
@Entity
@Table(name = "partner_alerts")
@Getter
@Setter
@NoArgsConstructor
@ToString
public class PartnerAlert {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "partner_id", nullable = false)
  private Long partnerId;

  @Column(name = "farm_id", nullable = false)
  private Long farmId;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private AlertCategory category;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private AlertSeverity severity;

  @Column(nullable = false)
  private String title;

  @Column private String body;

  @Column(name = "dedup_key", nullable = false)
  private String dedupKey;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private AlertStatus status = AlertStatus.ACTIVE;

  @Column(name = "created_at", insertable = false, updatable = false)
  private LocalDateTime createdAt;

  @Column(name = "updated_at", insertable = false, updatable = false)
  private LocalDateTime updatedAt;

  @Column(name = "resolved_at")
  private LocalDateTime resolvedAt;
}
