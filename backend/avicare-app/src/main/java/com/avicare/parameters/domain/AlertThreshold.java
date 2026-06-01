package com.avicare.parameters.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

/** A per-farm alert threshold (e.g. mortality rate) with a severity. One row per (farm, type). */
@Entity
@Table(
    name = "alert_thresholds",
    uniqueConstraints = @UniqueConstraint(columnNames = {"farm_id", "threshold_type"}))
@Getter
@Setter
@NoArgsConstructor
@ToString
public class AlertThreshold {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "farm_id", nullable = false)
  private Long farmId;

  @Column(name = "threshold_type", nullable = false)
  private String thresholdType;

  @Column(name = "threshold_value", nullable = false)
  private BigDecimal thresholdValue;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private AlertSeverity severity;

  @Column(name = "is_active", nullable = false)
  private boolean active = true;

  @Column(name = "created_at", insertable = false, updatable = false)
  private LocalDateTime createdAt;

  @Column(name = "updated_at", insertable = false, updatable = false)
  private LocalDateTime updatedAt;
}
